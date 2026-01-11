import { useEffect } from 'react';
import { CrosswordGrid } from './components/CrosswordGrid';
import { ClueBar } from './components/ClueBar';
import { usePuzzleState } from './hooks/usePuzzleState';
import { samplePuzzle } from './lib/samplePuzzle';
import './App.css';

function App() {
  const {
    userEntries,
    selectedCell,
    direction,
    currentWord,
    currentClue,
    handleCellClick,
    handleKeyDown,
  } = usePuzzleState(samplePuzzle);

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
      </header>

      <main className="puzzle-container">
        <h2 className="puzzle-title">{samplePuzzle.title}</h2>
        {samplePuzzle.author && <p className="puzzle-author">by {samplePuzzle.author}</p>}

        <CrosswordGrid
          puzzle={samplePuzzle}
          userEntries={userEntries}
          selectedCell={selectedCell}
          direction={direction}
          currentWord={currentWord}
          onCellClick={handleCellClick}
        />

        <ClueBar clue={currentClue} />
      </main>
    </div>
  );
}

export default App;
