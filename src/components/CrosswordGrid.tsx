import type { Puzzle } from '../types/puzzle';
import './CrosswordGrid.css';

interface CrosswordGridProps {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  onCellClick: (row: number, col: number) => void;
}

/**
 * CrosswordGrid renders the puzzle grid with cells that can display letters
 */
export function CrosswordGrid({
  puzzle,
  userEntries,
  selectedCell,
  direction,
  onCellClick,
}: CrosswordGridProps) {
  /**
   * Check if a cell is part of the currently selected word
   */
  const isInSelectedWord = (row: number, col: number): boolean => {
    if (!selectedCell) return false;

    const cell = puzzle.grid[row][col];
    if (cell.isBlack) return false;

    // Find the word boundaries for the selected cell
    if (direction === 'across') {
      // Check if same row and within the word bounds
      if (row !== selectedCell.row) return false;

      // Find start of word (go left until black cell or edge)
      let wordStart = selectedCell.col;
      while (wordStart > 0 && !puzzle.grid[row][wordStart - 1].isBlack) {
        wordStart--;
      }

      // Find end of word (go right until black cell or edge)
      let wordEnd = selectedCell.col;
      while (wordEnd < puzzle.width - 1 && !puzzle.grid[row][wordEnd + 1].isBlack) {
        wordEnd++;
      }

      return col >= wordStart && col <= wordEnd;
    } else {
      // down direction
      if (col !== selectedCell.col) return false;

      // Find start of word (go up until black cell or edge)
      let wordStart = selectedCell.row;
      while (wordStart > 0 && !puzzle.grid[wordStart - 1][col].isBlack) {
        wordStart--;
      }

      // Find end of word (go down until black cell or edge)
      let wordEnd = selectedCell.row;
      while (wordEnd < puzzle.height - 1 && !puzzle.grid[wordEnd + 1][col].isBlack) {
        wordEnd++;
      }

      return row >= wordStart && row <= wordEnd;
    }
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
        const inWord = isInSelectedWord(cell.row, cell.col);
        const userEntry = userEntries.get(key);

        const cellClasses = [
          'crossword-cell',
          cell.isBlack ? 'black' : 'white',
          isSelected ? 'selected' : '',
          inWord && !isSelected ? 'in-word' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={key}
            className={cellClasses}
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
