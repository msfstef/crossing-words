import type { Puzzle } from '../types/puzzle';
import './CrosswordGrid.css';

interface CrosswordGridProps {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  currentWord: { row: number; col: number }[] | null;
  onCellClick: (row: number, col: number) => void;
}

/**
 * CrosswordGrid renders the puzzle grid with cells that can display letters
 */
export function CrosswordGrid({
  puzzle,
  userEntries,
  selectedCell,
  currentWord,
  onCellClick,
}: CrosswordGridProps) {
  /**
   * Check if a cell is part of the currently selected word
   */
  const isInCurrentWord = (row: number, col: number): boolean => {
    if (!currentWord) return false;
    return currentWord.some((cell) => cell.row === row && cell.col === col);
  };

  return (
    <div
      className="crossword-grid"
      style={{
        gridTemplateColumns: `repeat(${puzzle.width}, 1fr)`,
        gridTemplateRows: `repeat(${puzzle.height}, 1fr)`,
      }}
    >
      {puzzle.grid.flat().map((cell) => {
        const key = `${cell.row},${cell.col}`;
        const isSelected = selectedCell?.row === cell.row && selectedCell?.col === cell.col;
        const inWord = isInCurrentWord(cell.row, cell.col);
        const userEntry = userEntries.get(key);

        const cellClasses = [
          'crossword-cell',
          cell.isBlack ? 'cell--black' : 'cell--white',
          isSelected ? 'cell--selected' : '',
          inWord && !isSelected ? 'cell--in-word' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={key}
            className={cellClasses}
            data-row={cell.row}
            data-col={cell.col}
            onClick={() => !cell.isBlack && onCellClick(cell.row, cell.col)}
          >
            {cell.clueNumber && <span className="clue-number">{cell.clueNumber}</span>}
            {!cell.isBlack && <span className="cell-letter">{userEntry || ''}</span>}
          </div>
        );
      })}
    </div>
  );
}
