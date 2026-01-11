import { useEffect, useState, useCallback } from 'react';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { FilePicker } from './components/FilePicker';
import { PuzzleDownloader } from './components/PuzzleDownloader';
import { usePuzzleState } from './hooks/usePuzzleState';
import { samplePuzzle } from './lib/samplePuzzle';
import { loadCurrentPuzzle, saveCurrentPuzzle } from './lib/puzzleStorage';
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

function App() {
  // Start with null to indicate loading state, then load saved or sample puzzle
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved puzzle on startup
  useEffect(() => {
    loadCurrentPuzzle().then((savedPuzzle) => {
      setPuzzle(savedPuzzle ?? samplePuzzle);
    });
  }, []);

  // Generate stable puzzle ID for CRDT storage
  const puzzleId = puzzle ? getPuzzleId(puzzle) : '';

  const {
    userEntries,
    selectedCell,
    direction,
    currentWord,
    currentClue,
    handleCellClick,
    handleKeyDown,
    ready,
  } = usePuzzleState(puzzle ?? samplePuzzle, puzzleId || 'loading');

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
      </header>

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
                />

                <ClueBar clue={currentClue} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
