import { useState, useCallback } from 'react';
import { CrosswordGrid } from './components/CrosswordGrid';
import { samplePuzzle } from './lib/samplePuzzle';
import './App.css';

function App() {
  const [userEntries] = useState<Map<string, string>>(() => new Map());
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      // If clicking the same cell, toggle direction
      if (selectedCell?.row === row && selectedCell?.col === col) {
        setDirection((prev) => (prev === 'across' ? 'down' : 'across'));
      } else {
        setSelectedCell({ row, col });
      }
    },
    [selectedCell]
  );

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
          onCellClick={handleCellClick}
        />
      </main>
    </div>
  );
}

export default App;
