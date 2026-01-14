import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Toaster } from 'sonner';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { ClueBarSkeleton } from './components/ClueBarSkeleton';
import { PuzzleSkeleton } from './components/PuzzleSkeleton';
import { KeyboardSkeleton } from './components/KeyboardSkeleton';
import { ShareDialog } from './components/ShareDialog';
import { JoinDialog } from './components/JoinDialog';
import { SuccessDialog } from './components/SuccessDialog';
import { SettingsMenu } from './components/SettingsMenu';
import { LibraryView } from './components/Library';
import { SolveLayout, SolveHeader } from './components/Layout';
import { CrosswordKeyboard } from './components/Keyboard';
import { usePuzzleState } from './hooks/usePuzzleState';
import { useZoomZones } from './hooks/useZoomZones';
import { usePuzzleClueReferenceMap } from './hooks/usePuzzleClueReferenceMap';
import { useClueReferences } from './hooks/useClueReferences';
import { useVerification } from './hooks/useVerification';
import { useCompletionDetection } from './hooks/useCompletionDetection';
import { usePlayTime } from './hooks/usePlayTime';
import { useHistoryNavigation, type DialogType } from './hooks/useHistoryNavigation';
import { useMinimumLoadingTime } from './hooks/useMinimumLoadingTime';
import { useCollaborators } from './collaboration/useCollaborators';
import { useFollowCollaborator } from './collaboration/useFollowCollaborator';
import { useLocalUser } from './collaboration/useLocalUser';
import { samplePuzzle } from './lib/samplePuzzle';
import { saveCurrentPuzzle, loadPuzzleById, savePuzzle } from './lib/puzzleStorage';
import {
  parseShareUrl,
  parseLegacyRoomUrl,
  generateTimelineId,
  buildShareUrl,
  updateUrlHash,
  clearUrlHash,
} from './collaboration/sessionUrl';
import {
  getCurrentTimeline,
  hasLocalProgress,
  saveTimelineMapping,
  getLocalEntryCount,
} from './collaboration/timelineStorage';
import { createPuzzleStore } from './crdt/puzzleStore';
import type { Puzzle } from './types/puzzle';
import './App.css';

/**
 * Generate a stable puzzle ID from puzzle metadata.
 * Uses title as the primary identifier for now.
 * This ensures each puzzle gets isolated storage.
 */
function getPuzzleId(puzzle: Puzzle): string {
  // Use title as puzzle ID, sanitized for storage key use
  return puzzle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Parse session info from URL hash.
 * Supports new format: #puzzle=X&timeline=Y
 * Falls back to legacy format: #room=X
 */
function getSessionFromHash(): { puzzleIdFromUrl?: string; timelineId?: string } {
  // Try new format first
  const shareUrl = parseShareUrl();
  if (shareUrl) {
    return {
      puzzleIdFromUrl: shareUrl.puzzleId,
      timelineId: shareUrl.timelineId,
    };
  }

  // Fall back to legacy format
  const legacyRoomId = parseLegacyRoomUrl();
  if (legacyRoomId) {
    return {
      timelineId: legacyRoomId,
    };
  }

  return {};
}

function App() {
  // View state: library (home) or solve (puzzle view)
  // Default to library unless URL has timeline (shared session)
  const initialSession = getSessionFromHash();
  const [activeView, setActiveView] = useState<'library' | 'solve'>(
    initialSession.timelineId ? 'solve' : 'library'
  );

  // Start with null puzzle - will be set when opening from library or joining shared session
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [activePuzzleId, setActivePuzzleId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Session state: timeline ID for P2P collaboration
  // Initially undefined - will be set after checking for conflicts with URL timeline
  const [timelineId, setTimelineId] = useState<string | undefined>(undefined);

  // Track the timeline ID from URL that needs conflict checking
  const [pendingUrlTimeline, setPendingUrlTimeline] = useState<string | null>(
    () => initialSession.timelineId ?? null
  );

  // Track the puzzle ID from URL (for joining sessions where we don't have the puzzle)
  const [urlPuzzleId, setUrlPuzzleId] = useState<string | null>(
    () => initialSession.puzzleIdFromUrl ?? null
  );

  // Track if we're waiting for a puzzle from a sharer
  const [waitingForPuzzle, setWaitingForPuzzle] = useState(
    Boolean(initialSession.timelineId && initialSession.puzzleIdFromUrl)
  );

  // Track if initial session load is complete (needed to avoid race condition)
  const [initialLoadComplete, setInitialLoadComplete] = useState(
    // If no URL session, we're already done with initial load
    !initialSession.timelineId || !initialSession.puzzleIdFromUrl
  );

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Join dialog state for merge/start-fresh choice
  const [joinDialogState, setJoinDialogState] = useState<{
    isOpen: boolean;
    pendingTimelineId: string | null;
    localEntryCount: number;
  }>({
    isOpen: false,
    pendingTimelineId: null,
    localEntryCount: 0,
  });

  // Handle shared session URL on initial load
  useEffect(() => {
    const handleSharedSession = async () => {
      const session = getSessionFromHash();

      // If URL has a puzzle ID, check if we have it or need to wait for it
      if (session.puzzleIdFromUrl && session.timelineId) {
        // Try to load this specific puzzle from storage
        const storedPuzzle = await loadPuzzleById(session.puzzleIdFromUrl);
        if (storedPuzzle) {
          // We have the puzzle - use it
          setPuzzle(storedPuzzle);
          setActivePuzzleId(session.puzzleIdFromUrl);
          setActiveView('solve');
          setUrlPuzzleId(null);
          setWaitingForPuzzle(false);
        } else {
          // We don't have this puzzle - we'll need to wait for it from the sharer
          setActiveView('solve');
          setActivePuzzleId(session.puzzleIdFromUrl);
          setWaitingForPuzzle(true);
        }
      }
      // Mark initial load as complete so pending timeline processing can proceed
      setInitialLoadComplete(true);
    };

    handleSharedSession();
  }, []);

  // Generate stable puzzle ID for CRDT storage
  // Use URL puzzle ID when waiting for a puzzle from sharer
  const puzzleId = waitingForPuzzle && urlPuzzleId ? urlPuzzleId : activePuzzleId;

  // Listen for hash changes to detect shared timeline from URL
  useEffect(() => {
    const handleHashChange = async () => {
      const session = getSessionFromHash();
      const newTimeline = session.timelineId ?? null;
      const newPuzzleId = session.puzzleIdFromUrl ?? null;

      // If timeline is already active or being processed, skip
      if (newTimeline === timelineId || newTimeline === pendingUrlTimeline) {
        return;
      }

      // Set pending timeline - will be processed by the effect below
      if (newTimeline) {
        setPendingUrlTimeline(newTimeline);
        setActiveView('solve');

        // If coming from library view (no puzzle loaded), also load the puzzle
        if (newPuzzleId && !puzzle) {
          const storedPuzzle = await loadPuzzleById(newPuzzleId);
          if (storedPuzzle) {
            setPuzzle(storedPuzzle);
            setActivePuzzleId(newPuzzleId);
          } else {
            // We don't have this puzzle - wait for it from sharer
            setActivePuzzleId(newPuzzleId);
            setUrlPuzzleId(newPuzzleId);
            setWaitingForPuzzle(true);
          }
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [timelineId, pendingUrlTimeline, puzzle]);

  // Process pending URL timeline when puzzle is loaded
  // This checks for conflicts and shows dialog if needed
  useEffect(() => {
    // Skip if no pending timeline or already active
    if (!pendingUrlTimeline || pendingUrlTimeline === timelineId) {
      return;
    }

    // Wait for initial load to complete before processing
    // This avoids race condition where we join immediately before knowing
    // if we have local progress for the puzzle
    if (!initialLoadComplete) {
      return;
    }

    // If we're waiting for a puzzle from the sharer, just join immediately
    // (no local progress to worry about)
    if (waitingForPuzzle && urlPuzzleId) {
      setTimelineId(pendingUrlTimeline);
      setPendingUrlTimeline(null);
      return;
    }

    // Skip if no puzzle ID yet (still loading)
    if (!puzzleId) {
      return;
    }

    let cancelled = false;

    const processJoin = async () => {
      // Check if user has existing progress for this puzzle
      const localTimeline = getCurrentTimeline(puzzleId);
      const hasProgress = await hasLocalProgress(puzzleId);

      if (cancelled) return;

      // If user has local progress AND it's a different timeline, show dialog
      if (hasProgress && localTimeline !== pendingUrlTimeline) {
        const entryCount = await getLocalEntryCount(puzzleId);
        if (cancelled) return;

        setJoinDialogState({
          isOpen: true,
          pendingTimelineId: pendingUrlTimeline,
          localEntryCount: entryCount,
        });
        // Don't clear pending yet - will be cleared when user makes a choice
      } else {
        // No conflict - just join the shared timeline
        setTimelineId(pendingUrlTimeline);
        await saveTimelineMapping(puzzleId, pendingUrlTimeline);
        // Clear pending after successful join
        setPendingUrlTimeline(null);
      }
    };

    processJoin();

    return () => {
      cancelled = true;
    };
  }, [pendingUrlTimeline, puzzleId, timelineId, waitingForPuzzle, urlPuzzleId, initialLoadComplete]);

  /**
   * Handle merge choice from JoinDialog.
   * Connect to shared room with local state intact - Yjs merges automatically.
   */
  const handleJoinMerge = useCallback(async () => {
    const { pendingTimelineId } = joinDialogState;
    if (!pendingTimelineId || !puzzleId) return;

    // Just switch to the shared timeline - Yjs CRDT will merge states
    // when both docs connect to the same room
    setTimelineId(pendingTimelineId);
    await saveTimelineMapping(puzzleId, pendingTimelineId);
    updateUrlHash(puzzleId, pendingTimelineId);

    // Clear dialog and pending URL state
    setPendingUrlTimeline(null);
    setJoinDialogState({
      isOpen: false,
      pendingTimelineId: null,
      localEntryCount: 0,
    });
  }, [joinDialogState, puzzleId]);

  /**
   * Handle start-fresh choice from JoinDialog.
   * Clear local state before connecting to shared session.
   */
  const handleJoinStartFresh = useCallback(async () => {
    const { pendingTimelineId } = joinDialogState;
    if (!pendingTimelineId || !puzzleId) return;

    // Clear local data by creating a temporary store and clearing it
    const tempStore = createPuzzleStore(puzzleId);
    await tempStore.ready;
    await tempStore.clearData();
    tempStore.destroy();

    // Now switch to the shared timeline with fresh state
    setTimelineId(pendingTimelineId);
    await saveTimelineMapping(puzzleId, pendingTimelineId);
    updateUrlHash(puzzleId, pendingTimelineId);

    // Clear dialog and pending URL state
    setPendingUrlTimeline(null);
    setJoinDialogState({
      isOpen: false,
      pendingTimelineId: null,
      localEntryCount: 0,
    });
  }, [joinDialogState, puzzleId]);

  /**
   * Handle cancel choice from JoinDialog.
   * Stay on local timeline, remove shared timeline from URL.
   */
  const handleJoinCancel = useCallback(() => {
    // Clear the URL hash to remove the shared timeline
    clearUrlHash();

    // Clear dialog and pending URL state
    setPendingUrlTimeline(null);
    setJoinDialogState({
      isOpen: false,
      pendingTimelineId: null,
      localEntryCount: 0,
    });
  }, []);

  // Derive roomId for P2P: combine puzzleId and timelineId for unique room
  // Only create P2P session when timelineId is present
  const roomId = puzzleId && timelineId ? `${puzzleId}:${timelineId}` : undefined;

  /**
   * Handle receiving puzzle data from CRDT sync.
   * Called when joining a shared session where we don't have the puzzle locally.
   * Stores the timeline mapping so future opens of this puzzle rejoin the same timeline.
   */
  const handlePuzzleReceived = useCallback((receivedPuzzle: Puzzle) => {
    console.log('[App] Received puzzle from CRDT:', receivedPuzzle.title);

    // Update puzzle state
    setPuzzle(receivedPuzzle);
    setWaitingForPuzzle(false);
    setUrlPuzzleId(null);

    // Save the received puzzle for future use
    const newPuzzleId = getPuzzleId(receivedPuzzle);
    setActivePuzzleId(newPuzzleId);
    savePuzzle(newPuzzleId, receivedPuzzle).catch((err) => {
      console.error('Failed to save received puzzle:', err);
    });
    // Also save as current puzzle
    saveCurrentPuzzle(receivedPuzzle).catch((err) => {
      console.error('Failed to save current puzzle:', err);
    });

    // Store the timeline mapping for future rejoins
    // timelineId is already set from pendingUrlTimeline when waitingForPuzzle
    if (timelineId) {
      saveTimelineMapping(newPuzzleId, timelineId);
    }
  }, [timelineId]);

  // Memoize puzzle sync options to avoid unnecessary effect re-runs
  const puzzleSyncOptions = useMemo(() => ({
    // Provide puzzle for sharing when we have one (and not waiting for one)
    puzzle: waitingForPuzzle ? null : puzzle,
    // Provide callback for receiving when we're waiting for a puzzle
    onPuzzleReceived: waitingForPuzzle ? handlePuzzleReceived : undefined,
  }), [puzzle, waitingForPuzzle, handlePuzzleReceived]);

  const {
    userEntries,
    selectedCell,
    direction,
    currentWord,
    currentClue,
    handleCellClick,
    handleKeyDown,
    ready,
    awareness,
    verifiedCells,
    errorCells,
    verifiedMap,
    errorsMap,
    doc,
    entriesMap,
    autoCheckEnabled,
    setAutoCheck,
    goToPrevClue,
    goToNextClue,
    hasPrevClue,
    hasNextClue,
    typeLetter,
    handleBackspace,
    toggleDirection,
    handleSwipeNavigation,
    setSelectedCell,
    setDirection,
    clearAllEntries,
  } = usePuzzleState(puzzle ?? samplePuzzle, puzzleId || 'loading', roomId, puzzleSyncOptions);

  // Build set of current word cells for reference highlight exclusion
  const currentWordCells = useMemo(() => {
    if (!currentWord) return new Set<string>();
    return new Set(currentWord.map((cell) => `${cell.row},${cell.col}`));
  }, [currentWord]);

  // Pre-compute all clue references at puzzle load time for O(1) lookup
  const clueReferenceMap = usePuzzleClueReferenceMap(puzzle);

  // Use clue reference hook for highlighting referenced clues (O(1) lookup)
  const { referencedClueCells, letterReferenceCells } = useClueReferences({
    clueReferenceMap,
    currentClue,
    currentWordCells,
  });

  // Use verification hook for check/reveal actions
  const {
    checkLetter,
    checkWord,
    checkPuzzle,
    revealLetter,
    revealWord,
    revealPuzzle,
    verifyAllCells,
  } = useVerification({
    puzzle: puzzle ?? samplePuzzle,
    entries: userEntries,
    entriesMap: entriesMap!,
    verifiedMap: verifiedMap!,
    errorsMap: errorsMap!,
    doc: doc!,
    currentWord,
    selectedCell,
  });

  // Completion detection - only active when puzzle is loaded and ready
  const { isComplete, justCompleted } = useCompletionDetection({
    puzzle: puzzle ?? samplePuzzle,
    userEntries,
    disabled: !puzzle || !ready,
  });

  // Play time tracking - syncs per-client duration to CRDT with max-wins semantics
  const { formattedDuration } = usePlayTime({
    doc,
    enabled: ready && puzzle !== null && !isComplete,
  });

  // Success dialog state
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Track previous entries for auto-check comparison
  const prevEntriesRef = useRef<Map<string, string>>(new Map());

  // Auto-check on entry change (when enabled)
  // Watches all entry changes, not just selected cell, since cursor auto-advances
  useEffect(() => {
    if (!autoCheckEnabled || !puzzle || !errorsMap) return;

    // Find cells where entry changed
    userEntries.forEach((entry, key) => {
      const prevEntry = prevEntriesRef.current.get(key);
      if (entry !== prevEntry && !verifiedCells.has(key)) {
        const [row, col] = key.split(',').map(Number);
        const cell = puzzle.grid[row][col];
        if (entry !== cell.letter) {
          errorsMap.set(key, true);
        } else {
          errorsMap.delete(key);
        }
      }
    });

    // Update previous entries ref
    prevEntriesRef.current = new Map(userEntries);
  }, [autoCheckEnabled, userEntries, puzzle, verifiedCells, errorsMap]);

  // Track collaborators and show join/leave toasts (toasts handled inside hook)
  const collaborators = useCollaborators(awareness);
  // Get local user info for consistent styling with what collaborators see
  const localUser = useLocalUser(awareness);

  // Follow collaborator functionality - sync cursor to followed collaborator
  const { followedCollaborator, toggleFollow, disableFollow } = useFollowCollaborator(
    collaborators,
    awareness,
    useCallback((row: number, col: number, dir: 'across' | 'down') => {
      setSelectedCell({ row, col });
      setDirection(dir);
    }, [setSelectedCell, setDirection])
  );

  // Wrap user interaction handlers to disable follow mode on local movement
  const handleCellClickWithFollow = useCallback((row: number, col: number) => {
    disableFollow();
    handleCellClick(row, col);
  }, [disableFollow, handleCellClick]);

  const handleKeyDownWithFollow = useCallback((event: KeyboardEvent) => {
    // Only disable follow for navigation/input keys, not meta keys
    const isNavigationOrInput = /^[a-zA-Z]$/.test(event.key) ||
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', ' '].includes(event.key);

    if (isNavigationOrInput) {
      disableFollow();
    }
    handleKeyDown(event);
  }, [disableFollow, handleKeyDown]);

  const goToPrevClueWithFollow = useCallback(() => {
    disableFollow();
    goToPrevClue();
  }, [disableFollow, goToPrevClue]);

  const goToNextClueWithFollow = useCallback(() => {
    disableFollow();
    goToNextClue();
  }, [disableFollow, goToNextClue]);

  const toggleDirectionWithFollow = useCallback(() => {
    disableFollow();
    toggleDirection();
  }, [disableFollow, toggleDirection]);

  const handleSwipeNavigationWithFollow = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    disableFollow();
    handleSwipeNavigation(dir);
  }, [disableFollow, handleSwipeNavigation]);

  const typeLetterWithFollow = useCallback((letter: string) => {
    disableFollow();
    typeLetter(letter);
  }, [disableFollow, typeLetter]);

  const handleBackspaceWithFollow = useCallback(() => {
    disableFollow();
    handleBackspace();
  }, [disableFollow, handleBackspace]);

  /**
   * Handle dialog dismissal from back button navigation.
   * This callback is invoked by useHistoryNavigation when back is pressed with a dialog open.
   */
  const handleDismissDialog = useCallback((dialogType: DialogType) => {
    switch (dialogType) {
      case 'share':
        setShowShareDialog(false);
        break;
      case 'success':
        setShowSuccessDialog(false);
        break;
      case 'join':
        // Treat back button as cancel for join dialog
        handleJoinCancel();
        break;
      // 'download' is handled in LibraryView
    }
  }, [handleJoinCancel]);

  // History navigation for native-like back button behavior
  const {
    pushSolveView,
    pushDialog,
    cleanupDialogState,
  } = useHistoryNavigation({
    activeView,
    puzzleId,
    timelineId,
    onNavigateToLibrary: useCallback(() => {
      // Navigate to library via back button
      clearUrlHash();
      setTimelineId(undefined);
      setActiveView('library');
      setPuzzle(null);
      setActivePuzzleId('');
    }, []),
    onDismissDialog: handleDismissDialog,
  });

  // Show success dialog and verify all cells when puzzle is completed
  useEffect(() => {
    if (justCompleted) {
      verifyAllCells();
      pushDialog('success');
      setShowSuccessDialog(true);
    }
  }, [justCompleted, verifyAllCells, pushDialog]);

  // Track JoinDialog open state for history integration
  const prevJoinDialogOpenRef = useRef(joinDialogState.isOpen);
  useEffect(() => {
    const wasOpen = prevJoinDialogOpenRef.current;
    const isOpen = joinDialogState.isOpen;

    // Push dialog state when JoinDialog opens
    if (!wasOpen && isOpen) {
      pushDialog('join');
    }
    // Note: We don't call cleanupDialogState for JoinDialog because the handlers
    // (handleJoinMerge, handleJoinStartFresh, handleJoinCancel) already manage
    // the URL hash and state. Calling history.back() would restore the old URL
    // with the hash, which would re-trigger the dialog.

    prevJoinDialogOpenRef.current = isOpen;
  }, [joinDialogState.isOpen, pushDialog]);

  // Detect touch device for virtual keyboard display
  // Uses pointer: coarse media query which matches touch devices
  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsTouchDevice(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Zoom mode state
  const [isZoomMode, setIsZoomMode] = useState(false);

  // Pre-computed zoom zones for stable viewports
  const { getViewportForClue, getEdgeIndicators } = useZoomZones(puzzle);

  /**
   * Get the full Clue object for the current clue.
   * Needed because currentClue from usePuzzleState only has number/direction/text.
   */
  const fullCurrentClue = useMemo(() => {
    if (!puzzle || !currentClue) return null;
    const clues = currentClue.direction === 'across'
      ? puzzle.clues.across
      : puzzle.clues.down;
    return clues.find(c => c.number === currentClue.number) ?? null;
  }, [puzzle, currentClue]);

  /**
   * Get stable viewport region for zoom mode using pre-computed zones.
   * Zones are computed once when puzzle loads to avoid jarring viewport changes.
   */
  const zoomViewport = useMemo(() => {
    if (!isZoomMode || !fullCurrentClue) {
      return null;
    }
    return getViewportForClue(fullCurrentClue);
  }, [isZoomMode, fullCurrentClue, getViewportForClue]);

  /**
   * Edge indicators for the current zoom viewport.
   * Shows which edges have hidden content beyond the viewport.
   */
  const edgeIndicators = useMemo(() => {
    if (!zoomViewport) {
      return null;
    }
    return getEdgeIndicators(zoomViewport);
  }, [zoomViewport, getEdgeIndicators]);

  // Toggle zoom mode
  const handleToggleZoom = useCallback(() => {
    setIsZoomMode(prev => !prev);
  }, []);

  /**
   * Handle Share button click.
   * Timeline is already generated when opening puzzle, so just build URL and show dialog.
   */
  const handleShare = useCallback(() => {
    if (!puzzle || !puzzleId || !timelineId) return;

    // Build share URL and open dialog
    const url = buildShareUrl(puzzleId, timelineId);
    setShareUrl(url);
    pushDialog('share');
    setShowShareDialog(true);
  }, [puzzle, puzzleId, timelineId, pushDialog]);

  /**
   * Handle opening a puzzle from the library.
   * Checks for existing timeline (returning to puzzle) or generates new one.
   * This enables session resumption - closing and reopening puts you back in the same P2P room.
   */
  const handleOpenPuzzle = useCallback((loadedPuzzle: Puzzle, loadedPuzzleId: string) => {
    setPuzzle(loadedPuzzle);
    setActivePuzzleId(loadedPuzzleId);
    setActiveView('solve');
    setError(null);

    // Check for existing timeline (returning to puzzle)
    const existingTimeline = getCurrentTimeline(loadedPuzzleId);

    if (existingTimeline) {
      // Rejoin existing timeline
      setTimelineId(existingTimeline);
      // Push history entry for back navigation
      pushSolveView(loadedPuzzleId, existingTimeline);
    } else {
      // New puzzle session - generate timeline
      const newTimelineId = generateTimelineId();
      setTimelineId(newTimelineId);
      saveTimelineMapping(loadedPuzzleId, newTimelineId);
      // Push history entry for back navigation
      pushSolveView(loadedPuzzleId, newTimelineId);
    }

    // Persist as current puzzle
    saveCurrentPuzzle(loadedPuzzle).catch((err) => {
      console.error('Failed to save puzzle:', err);
    });
  }, [pushSolveView]);

  /**
   * Handle going back to library from solve view.
   */
  const handleBackToLibrary = useCallback(() => {
    // Clear the URL hash when leaving a puzzle
    clearUrlHash();
    // Reset timeline since we're leaving the puzzle
    setTimelineId(undefined);
    // Switch to library view
    setActiveView('library');
    // Clear puzzle state
    setPuzzle(null);
    setActivePuzzleId('');
    // Reset zoom mode (ephemeral, not persisted)
    setIsZoomMode(false);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Add keyboard event listener to document (only in solve view)
  useEffect(() => {
    if (activeView !== 'solve') return;

    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDownWithFollow(event);
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeView, handleKeyDownWithFollow]);

  // Build grid content
  // Show skeleton only when waiting for puzzle data (not for CRDT ready state)
  // This allows instant display when puzzle is cached, with entries filling in from CRDT
  // NOTE: This hook must be called before any early returns to maintain consistent hook order
  const isActuallyLoading = waitingForPuzzle || !puzzle;
  const isLoading = useMinimumLoadingTime(isActuallyLoading, 250);

  // Render Library view
  if (activeView === 'library') {
    return (
      <>
        <LibraryView
          onOpenPuzzle={handleOpenPuzzle}
          onError={handleError}
        />
        {error && (
          <div className="error-banner error-banner--floating">
            <span className="error-banner__message">{error}</span>
            <button
              type="button"
              onClick={dismissError}
              className="error-banner__dismiss"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}
        <Toaster position="bottom-center" theme="dark" />
      </>
    );
  }

  // Build settings menu for header
  const settingsMenuContent = puzzle && ready ? (
    <SettingsMenu
      onCheckLetter={checkLetter}
      onCheckWord={checkWord}
      onCheckPuzzle={checkPuzzle}
      onRevealLetter={revealLetter}
      onRevealWord={revealWord}
      onRevealPuzzle={revealPuzzle}
      autoCheckEnabled={autoCheckEnabled}
      onAutoCheckToggle={() => setAutoCheck(!autoCheckEnabled)}
      onReset={clearAllEntries}
      isZoomMode={isZoomMode}
      onToggleZoom={handleToggleZoom}
    />
  ) : (
    <SettingsMenu />
  );

  const gridContent = (
    <>
      {isLoading ? (
        <>
          <PuzzleSkeleton />
          {waitingForPuzzle && (
            <div className="puzzle-status-overlay">
              <span className="puzzle-status-overlay__text">Joining shared session...</span>
            </div>
          )}
        </>
      ) : puzzle ? (
        <>
          {error && (
            <div className="error-banner">
              <span className="error-banner__message">{error}</span>
              <button
                type="button"
                onClick={dismissError}
                className="error-banner__dismiss"
                aria-label="Dismiss error"
              >
                &times;
              </button>
            </div>
          )}

          <div className="puzzle-grid-area">
            <div className="puzzle-grid-header">
              <h2 className="puzzle-title-above-grid">{puzzle.title}</h2>
              {puzzle.author && <p className="puzzle-author">by {puzzle.author}</p>}
            </div>

            <div className="puzzle-grid-wrapper">
              <CrosswordGrid
                puzzle={puzzle}
                userEntries={userEntries}
                selectedCell={selectedCell}
                direction={direction}
                currentWord={currentWord}
                onCellClick={handleCellClickWithFollow}
                collaborators={collaborators}
                localUserColor={localUser.color}
                verifiedCells={verifiedCells}
                errorCells={errorCells}
                onSwipe={handleSwipeNavigationWithFollow}
                isTouchDevice={isTouchDevice}
                referencedClueCells={referencedClueCells}
                letterReferenceCells={letterReferenceCells}
                isZoomMode={isZoomMode}
                zoomViewport={zoomViewport}
                edgeIndicators={edgeIndicators}
                onToggleZoom={handleToggleZoom}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  // Render Solve view with new layout
  return (
    <>
      <SolveLayout
        header={
          <SolveHeader
            onBack={handleBackToLibrary}
            onShare={handleShare}
            collaborators={collaborators}
            settingsMenu={settingsMenuContent}
            followedCollaborator={followedCollaborator}
            onToggleFollow={toggleFollow}
          />
        }
        grid={gridContent}
        clueBar={
          isLoading ? (
            <ClueBarSkeleton />
          ) : (
            <ClueBar
              clue={currentClue}
              onPrevClue={goToPrevClueWithFollow}
              onNextClue={goToNextClueWithFollow}
              hasPrev={hasPrevClue}
              hasNext={hasNextClue}
              onToggleDirection={toggleDirectionWithFollow}
            />
          )
        }
        keyboard={
          isLoading ? (
            <KeyboardSkeleton />
          ) : (
            <CrosswordKeyboard
              onKeyPress={typeLetterWithFollow}
              onBackspace={handleBackspaceWithFollow}
            />
          )
        }
      />

      {/* Share dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => {
          setShowShareDialog(false);
          cleanupDialogState('share');
        }}
        shareUrl={shareUrl}
        puzzleTitle={puzzle?.title ?? 'Crossword Puzzle'}
      />

      {/* Join dialog for merge/start-fresh choice */}
      <JoinDialog
        isOpen={joinDialogState.isOpen}
        puzzleTitle={puzzle?.title ?? 'Crossword Puzzle'}
        localEntryCount={joinDialogState.localEntryCount}
        onMerge={handleJoinMerge}
        onStartFresh={handleJoinStartFresh}
        onCancel={handleJoinCancel}
      />

      {/* Success dialog for puzzle completion */}
      <SuccessDialog
        isOpen={showSuccessDialog}
        onClose={() => {
          setShowSuccessDialog(false);
          cleanupDialogState('success');
        }}
        onBackToLibrary={() => {
          setShowSuccessDialog(false);
          // Navigate to library via React state and clear URL hash
          handleBackToLibrary();
          // Go back 2 entries in history (past dialog and solve entries) to library
          // This prevents browser back from returning to puzzle with stale hash
          window.history.go(-2);
        }}
        puzzleTitle={puzzle?.title ?? 'Crossword Puzzle'}
        collaboratorCount={collaborators.length}
        duration={formattedDuration}
      />

      {/* Toast notifications */}
      <Toaster position="bottom-center" theme="dark" />
    </>
  );
}

export default App;
