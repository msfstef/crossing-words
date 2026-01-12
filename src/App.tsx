import { useEffect, useState, useCallback, useMemo } from 'react';
import { Toaster } from 'sonner';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { CollaboratorAvatars } from './components/CollaboratorAvatars';
import { FilePicker } from './components/FilePicker';
import { PuzzleDownloader } from './components/PuzzleDownloader';
import { ShareDialog } from './components/ShareDialog';
import { JoinDialog } from './components/JoinDialog';
import { usePuzzleState } from './hooks/usePuzzleState';
import { useCollaborators } from './collaboration/useCollaborators';
import { samplePuzzle } from './lib/samplePuzzle';
import { loadCurrentPuzzle, saveCurrentPuzzle, loadPuzzleById, savePuzzle } from './lib/puzzleStorage';
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
  // Start with null to indicate loading state, then load saved or sample puzzle
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Session state: timeline ID for P2P collaboration
  // Initially undefined - will be set after checking for conflicts with URL timeline
  const [timelineId, setTimelineId] = useState<string | undefined>(undefined);

  // Track the timeline ID from URL that needs conflict checking
  const [pendingUrlTimeline, setPendingUrlTimeline] = useState<string | null>(
    () => getSessionFromHash().timelineId ?? null
  );

  // Track the puzzle ID from URL (for joining sessions where we don't have the puzzle)
  const [urlPuzzleId, setUrlPuzzleId] = useState<string | null>(
    () => getSessionFromHash().puzzleIdFromUrl ?? null
  );

  // Track if we're waiting for a puzzle from a sharer
  const [waitingForPuzzle, setWaitingForPuzzle] = useState(false);

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

  // Load saved puzzle on startup, considering URL parameters
  useEffect(() => {
    const loadPuzzle = async () => {
      const session = getSessionFromHash();

      // If URL has a puzzle ID, check if we have it or need to wait for it
      if (session.puzzleIdFromUrl && session.timelineId) {
        // Try to load this specific puzzle from storage
        const storedPuzzle = await loadPuzzleById(session.puzzleIdFromUrl);
        if (storedPuzzle) {
          // We have the puzzle - use it
          setPuzzle(storedPuzzle);
          setUrlPuzzleId(null); // Clear URL puzzle ID since we found it
          return;
        }

        // We don't have this puzzle - we'll need to wait for it from the sharer
        // For now, set the puzzle ID from URL so the CRDT hook can connect
        // and receive the puzzle via sync
        setWaitingForPuzzle(true);
        // Keep urlPuzzleId set so we know what room to join
        return;
      }

      // Normal flow: load saved puzzle or use sample
      const savedPuzzle = await loadCurrentPuzzle();
      setPuzzle(savedPuzzle ?? samplePuzzle);
    };

    loadPuzzle();
  }, []);

  // Generate stable puzzle ID for CRDT storage
  // Use URL puzzle ID when waiting for a puzzle from sharer
  const puzzleId = waitingForPuzzle && urlPuzzleId ? urlPuzzleId : (puzzle ? getPuzzleId(puzzle) : '');

  // Listen for hash changes to detect shared timeline from URL
  useEffect(() => {
    const handleHashChange = () => {
      const session = getSessionFromHash();
      const newTimeline = session.timelineId ?? null;

      // If timeline is already active or being processed, skip
      if (newTimeline === timelineId || newTimeline === pendingUrlTimeline) {
        return;
      }

      // Set pending timeline - will be processed by the effect below
      if (newTimeline) {
        setPendingUrlTimeline(newTimeline);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [timelineId, pendingUrlTimeline]);

  // Process pending URL timeline when puzzle is loaded
  // This checks for conflicts and shows dialog if needed
  useEffect(() => {
    // Skip if no pending timeline or already active
    if (!pendingUrlTimeline || pendingUrlTimeline === timelineId) {
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
  }, [pendingUrlTimeline, puzzleId, timelineId, waitingForPuzzle, urlPuzzleId]);

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
   */
  const handlePuzzleReceived = useCallback((receivedPuzzle: Puzzle) => {
    console.log('[App] Received puzzle from CRDT:', receivedPuzzle.title);

    // Update puzzle state
    setPuzzle(receivedPuzzle);
    setWaitingForPuzzle(false);
    setUrlPuzzleId(null);

    // Save the received puzzle for future use
    const newPuzzleId = getPuzzleId(receivedPuzzle);
    savePuzzle(newPuzzleId, receivedPuzzle).catch((err) => {
      console.error('Failed to save received puzzle:', err);
    });
    // Also save as current puzzle
    saveCurrentPuzzle(receivedPuzzle).catch((err) => {
      console.error('Failed to save current puzzle:', err);
    });
  }, []);

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
    connectionState,
    awareness,
  } = usePuzzleState(puzzle ?? samplePuzzle, puzzleId || 'loading', roomId, puzzleSyncOptions);

  // Track collaborators and show join/leave toasts (toasts handled inside hook)
  const collaborators = useCollaborators(awareness);

  /**
   * Handle Share button click.
   * Generates timeline ID if needed and opens the share dialog.
   */
  const handleShare = useCallback(() => {
    if (!puzzle || !puzzleId) return;

    // Generate timeline ID if we don't have one yet
    let currentTimelineId = timelineId;
    if (!currentTimelineId) {
      currentTimelineId = generateTimelineId();
      setTimelineId(currentTimelineId);
      // Update URL hash so current user is also in the room
      updateUrlHash(puzzleId, currentTimelineId);
    }

    // Build share URL and open dialog
    const url = buildShareUrl(puzzleId, currentTimelineId);
    setShareUrl(url);
    setShowShareDialog(true);
  }, [puzzle, puzzleId, timelineId]);

  const handlePuzzleLoaded = useCallback((newPuzzle: Puzzle) => {
    setPuzzle(newPuzzle);
    setError(null);
    // Persist the puzzle to IndexedDB
    saveCurrentPuzzle(newPuzzle).catch((err) => {
      console.error('Failed to save puzzle:', err);
    });
  }, []);

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const dismissError = () => {
    setError(null);
  };

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Add keyboard event listener to document
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Crossing Words</h1>
        <p className="tagline">Collaborative crossword puzzles</p>
        <div className="puzzle-import">
          <FilePicker
            onPuzzleLoaded={handlePuzzleLoaded}
            onError={handleError}
          />
          <span className="puzzle-import__separator">or</span>
          <PuzzleDownloader
            onPuzzleLoaded={handlePuzzleLoaded}
            onError={handleError}
          />
        </div>

        {/* Share button and collaboration info */}
        <div className="header-actions">
          {/* Collaborator avatars - only show in P2P mode with collaborators */}
          {timelineId && collaborators.length > 0 && (
            <CollaboratorAvatars collaborators={collaborators} />
          )}

          {/* Share button - visible when puzzle is loaded */}
          {puzzle && (
            <button
              type="button"
              className="share-button"
              onClick={handleShare}
              aria-label="Share puzzle"
            >
              Share
            </button>
          )}
        </div>
      </header>

      {/* Connection indicator - only show in P2P mode */}
      {roomId && (
        <div
          className={`connection-indicator connection-indicator--${connectionState}`}
          data-connection-state={connectionState}
        >
          <span className="connection-indicator__dot" />
          <span className="connection-indicator__label">
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'disconnected' && 'Offline'}
          </span>
        </div>
      )}

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

      <main className="puzzle-container" key={puzzle?.title ?? 'loading'}>
        {waitingForPuzzle ? (
          <div className="puzzle-loading">
            <p>Joining shared session...</p>
            <p className="puzzle-loading__subtitle">Waiting for puzzle data from host</p>
          </div>
        ) : !puzzle ? (
          <div className="puzzle-loading">Loading...</div>
        ) : (
          <>
            <h2 className="puzzle-title">{puzzle.title}</h2>
            {puzzle.author && <p className="puzzle-author">by {puzzle.author}</p>}

            {!ready ? (
              <div className="puzzle-loading">Loading puzzle state...</div>
            ) : (
              <>
                <CrosswordGrid
                  puzzle={puzzle}
                  userEntries={userEntries}
                  selectedCell={selectedCell}
                  direction={direction}
                  currentWord={currentWord}
                  onCellClick={handleCellClick}
                  collaborators={collaborators}
                />

                <ClueBar clue={currentClue} />
              </>
            )}
          </>
        )}
      </main>

      {/* Share dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
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

      {/* Toast notifications */}
      <Toaster position="bottom-center" theme="dark" />
    </div>
  );
}

export default App;
