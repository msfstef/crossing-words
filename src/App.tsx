import { useEffect, useState } from 'react';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { FilePicker } from './components/FilePicker';
import { PuzzleDownloader } from './components/PuzzleDownloader';
import { usePuzzleState } from './hooks/usePuzzleState';
import { samplePuzzle } from './lib/samplePuzzle';
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
  const [puzzle, setPuzzle] = useState<Puzzle>(samplePuzzle);
  const [error, setError] = useState<string | null>(null);

  // Generate stable puzzle ID for CRDT storage
  const puzzleId = getPuzzleId(puzzle);

  const {
    userEntries,
    selectedCell,
    direction,
    currentWord,
    currentClue,
    handleCellClick,
    handleKeyDown,
    ready,
  } = usePuzzleState(puzzle, puzzleId);

  const handlePuzzleLoaded = (newPuzzle: Puzzle) => {
    setPuzzle(newPuzzle);
    setError(null);
  };

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

      <main className="puzzle-container" key={puzzle.title}>
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
      </main>
    </div>
  );
}

export default App;
