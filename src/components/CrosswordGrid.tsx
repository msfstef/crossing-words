import { useMemo } from 'react';
import type { Puzzle, Clue } from '../types/puzzle';
import type { Collaborator } from '../collaboration/types';
import './CrosswordGrid.css';

interface CrosswordGridProps {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  currentWord: { row: number; col: number }[] | null;
  onCellClick: (row: number, col: number) => void;
  /** Collaborators to show word highlights for */
  collaborators?: Collaborator[];
}

/**
 * Find the clue that contains a cell in the given direction.
 */
function findClueForCell(
  puzzle: Puzzle,
  row: number,
  col: number,
  dir: 'across' | 'down'
): Clue | null {
  const clues = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;

  for (const clue of clues) {
    if (dir === 'across') {
      // Check if cell is in this across clue: same row, within column range
      if (row === clue.row && col >= clue.col && col < clue.col + clue.length) {
        return clue;
      }
    } else {
      // Check if cell is in this down clue: same column, within row range
      if (col === clue.col && row >= clue.row && row < clue.row + clue.length) {
        return clue;
      }
    }
  }

  return null;
}

/**
 * Get all cells in the word containing the given cell position.
 */
function getWordCells(
  puzzle: Puzzle,
  row: number,
  col: number,
  direction: 'across' | 'down'
): { row: number; col: number }[] {
  const clue = findClueForCell(puzzle, row, col, direction);
  if (!clue) return [];

  const cells: { row: number; col: number }[] = [];

  if (direction === 'across') {
    for (let i = 0; i < clue.length; i++) {
      const c = clue.col + i;
      if (c < puzzle.width && !puzzle.grid[clue.row][c].isBlack) {
        cells.push({ row: clue.row, col: c });
      }
    }
  } else {
    for (let i = 0; i < clue.length; i++) {
      const r = clue.row + i;
      if (r < puzzle.height && !puzzle.grid[r][clue.col].isBlack) {
        cells.push({ row: r, col: clue.col });
      }
    }
  }

  return cells;
}

/**
 * Convert hex color to rgba with specified alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  collaborators = [],
}: CrosswordGridProps) {
  /**
   * Check if a cell is part of the currently selected word
   */
  const isInCurrentWord = (row: number, col: number): boolean => {
    if (!currentWord) return false;
    return currentWord.some((cell) => cell.row === row && cell.col === col);
  };

  /**
   * Build a map of cell positions to collaborator colors for word highlighting.
   * First collaborator with a cursor on that word "wins" the color.
   */
  const collaboratorHighlights = useMemo(() => {
    const highlights = new Map<string, string>();

    for (const collab of collaborators) {
      if (!collab.cursor) continue;

      const { row, col, direction } = collab.cursor;
      const wordCells = getWordCells(puzzle, row, col, direction);

      for (const cell of wordCells) {
        const key = `${cell.row},${cell.col}`;
        // Only set if no other collaborator claimed this cell
        if (!highlights.has(key)) {
          highlights.set(key, collab.user.color);
        }
      }
    }

    return highlights;
  }, [puzzle, collaborators]);

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

        // Get collaborator highlight color for this cell (if any)
        const collaboratorColor = collaboratorHighlights.get(key);
        // Only show collaborator highlight if not in local user's current word
        const hasCollaboratorHighlight = collaboratorColor && !inWord && !isSelected;

        const cellClasses = [
          'crossword-cell',
          cell.isBlack ? 'cell--black' : 'cell--white',
          isSelected ? 'cell--selected' : '',
          inWord && !isSelected ? 'cell--in-word' : '',
          hasCollaboratorHighlight ? 'cell--collaborator' : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Build inline style for collaborator highlight (dynamic color)
        const cellStyle = hasCollaboratorHighlight
          ? { backgroundColor: hexToRgba(collaboratorColor, 0.25) }
          : undefined;

        return (
          <div
            key={key}
            className={cellClasses}
            style={cellStyle}
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
