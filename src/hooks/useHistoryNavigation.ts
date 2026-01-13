import { useEffect, useCallback, useRef } from 'react';

/**
 * State object stored in browser history for navigation tracking.
 */
export interface HistoryState {
  type: 'library' | 'solve' | 'dialog';
  dialogType?: 'share' | 'success' | 'download' | 'join';
  puzzleId?: string;
  timelineId?: string;
}

/**
 * Type guard to check if a value is a valid HistoryState.
 */
function isHistoryState(state: unknown): state is HistoryState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return s.type === 'library' || s.type === 'solve' || s.type === 'dialog';
}

/**
 * Dialog types that can be managed by history navigation.
 */
export type DialogType = 'share' | 'success' | 'download' | 'join';

interface UseHistoryNavigationOptions {
  /** Current active view */
  activeView: 'library' | 'solve';
  /** Current puzzle ID (when in solve view) */
  puzzleId: string | undefined;
  /** Current timeline ID (when in solve view) */
  timelineId: string | undefined;
  /** Callback when back button should navigate to library */
  onNavigateToLibrary: () => void;
  /** Dialog dismiss callbacks */
  onDismissDialog: (type: DialogType) => void;
}

interface UseHistoryNavigationResult {
  /** Push a new history entry when navigating to solve view */
  pushSolveView: (puzzleId: string, timelineId: string) => void;
  /** Push a new history entry when opening a dialog */
  pushDialog: (type: DialogType) => void;
  /** Clean up history entry when dialog is closed programmatically (not via back) */
  cleanupDialogState: (type: DialogType) => void;
}

/**
 * Hook for managing browser history navigation in the PWA.
 *
 * Provides native-like back button behavior:
 * - Back from solve view returns to library
 * - Back with open dialog dismisses the dialog
 *
 * Handles edge case where dialogs are closed programmatically (via X button)
 * by cleaning up phantom history entries.
 */
export function useHistoryNavigation({
  activeView,
  puzzleId,
  timelineId,
  onNavigateToLibrary,
  onDismissDialog,
}: UseHistoryNavigationOptions): UseHistoryNavigationResult {
  // Track whether we're handling a popstate event to avoid cleanup loops
  const handlingPopstateRef = useRef(false);
  // Track current dialog type in history (if any)
  const currentDialogRef = useRef<DialogType | null>(null);

  // Initialize history state on mount only
  // We intentionally use the initial values and don't re-run on changes
  useEffect(() => {
    const currentState = window.history.state;

    // Only initialize if no valid state exists
    if (!isHistoryState(currentState)) {
      const initialState: HistoryState = activeView === 'solve'
        ? { type: 'solve', puzzleId, timelineId }
        : { type: 'library' };

      window.history.replaceState(initialState, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - intentionally ignore changes

  // Handle popstate (back/forward button)
  useEffect(() => {
    const handlePopstate = (event: PopStateEvent) => {
      handlingPopstateRef.current = true;
      const state = event.state as HistoryState | null;

      // If we had a dialog open, it means back was pressed to close it
      if (currentDialogRef.current) {
        const dialogType = currentDialogRef.current;
        currentDialogRef.current = null;
        onDismissDialog(dialogType);
        handlingPopstateRef.current = false;
        return;
      }

      // Handle view navigation
      if (state?.type === 'library' || !state) {
        // Check if URL has a hash indicating a solve session
        // If so, don't navigate to library - let the hashchange handler process it
        const hash = window.location.hash;
        if (hash && hash.includes('puzzle=') && hash.includes('timeline=')) {
          handlingPopstateRef.current = false;
          return;
        }
        onNavigateToLibrary();
      }
      // If state is 'solve', the view should already be solve (forward navigation)
      // No action needed as the URL hash will trigger the existing hashchange handler

      handlingPopstateRef.current = false;
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [onNavigateToLibrary, onDismissDialog]);

  /**
   * Push history entry when navigating from library to solve view.
   */
  const pushSolveView = useCallback((newPuzzleId: string, newTimelineId: string) => {
    const state: HistoryState = {
      type: 'solve',
      puzzleId: newPuzzleId,
      timelineId: newTimelineId,
    };
    const hash = `#puzzle=${encodeURIComponent(newPuzzleId)}&timeline=${newTimelineId}`;
    window.history.pushState(state, '', hash);
  }, []);

  /**
   * Push history entry when opening a dialog.
   */
  const pushDialog = useCallback((type: DialogType) => {
    currentDialogRef.current = type;
    const state: HistoryState = {
      type: 'dialog',
      dialogType: type,
      puzzleId,
      timelineId,
    };
    // Keep the current URL when pushing dialog state
    window.history.pushState(state, '');
  }, [puzzleId, timelineId]);

  /**
   * Clean up phantom history entry when dialog is closed programmatically.
   * Call this when a dialog is closed via X button (not via back button).
   */
  const cleanupDialogState = useCallback((type: DialogType) => {
    // Only clean up if we're not already handling a popstate
    // and if there's a matching dialog in history
    if (!handlingPopstateRef.current && currentDialogRef.current === type) {
      currentDialogRef.current = null;
      // Go back to remove the phantom dialog state from history
      window.history.back();
    }
  }, []);

  return {
    pushSolveView,
    pushDialog,
    cleanupDialogState,
  };
}
