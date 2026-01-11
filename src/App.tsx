import { useEffect, useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { CollaboratorAvatars } from './components/CollaboratorAvatars';
import { FilePicker } from './components/FilePicker';
import { PuzzleDownloader } from './components/PuzzleDownloader';
import { ShareDialog } from './components/ShareDialog';
import { usePuzzleState } from './hooks/usePuzzleState';
import { useCollaborators } from './collaboration/useCollaborators';
import { samplePuzzle } from './lib/samplePuzzle';
import { loadCurrentPuzzle, saveCurrentPuzzle } from './lib/puzzleStorage';
import {
  parseShareUrl,
  parseLegacyRoomUrl,
  generateTimelineId,
  buildShareUrl,
  updateUrlHash,
} from './collaboration/sessionUrl';
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
  const [timelineId, setTimelineId] = useState<string | undefined>(
    () => getSessionFromHash().timelineId
  );

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Load saved puzzle on startup
  useEffect(() => {
    loadCurrentPuzzle().then((savedPuzzle) => {
      setPuzzle(savedPuzzle ?? samplePuzzle);
    });
  }, []);

  // Listen for hash changes to update session state
  useEffect(() => {
    const handleHashChange = () => {
      const session = getSessionFromHash();
      setTimelineId(session.timelineId);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Generate stable puzzle ID for CRDT storage
  const puzzleId = puzzle ? getPuzzleId(puzzle) : '';

  // Derive roomId for P2P: combine puzzleId and timelineId for unique room
  // Only create P2P session when timelineId is present
  const roomId = puzzleId && timelineId ? `${puzzleId}:${timelineId}` : undefined;

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
  } = usePuzzleState(puzzle ?? samplePuzzle, puzzleId || 'loading', roomId);

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
        {!puzzle ? (
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

      {/* Toast notifications */}
      <Toaster position="bottom-center" theme="dark" />
    </div>
  );
}

export default App;
