import { useState, useCallback } from 'react';
import type { Puzzle, Clue } from '../types/puzzle';

interface CurrentClue {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface PuzzleStateHook {
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  handleCellClick: (row: number, col: number) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  currentWord: { row: number; col: number }[] | null;
  currentClue: CurrentClue | null;
}

/**
 * Custom hook for managing puzzle solving state
 * Handles cell selection, direction toggle, letter input, and navigation
 */
export function usePuzzleState(puzzle: Puzzle): PuzzleStateHook {
  const [userEntries, setUserEntries] = useState<Map<string, string>>(() => new Map());
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');

  /**
   * Find the clue that contains the selected cell in the given direction
   */
  const findClueForCell = useCallback(
    (
      row: number,
      col: number,
      dir: 'across' | 'down'
    ): Clue | null => {
      const clues = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;

      for (const clue of clues) {
        if (dir === 'across') {
          // Check if cell is in this across clue: same row, within column range
          if (
            row === clue.row &&
            col >= clue.col &&
            col < clue.col + clue.length
          ) {
            return clue;
          }
        } else {
          // Check if cell is in this down clue: same column, within row range
          if (
            col === clue.col &&
            row >= clue.row &&
            row < clue.row + clue.length
          ) {
            return clue;
          }
        }
      }

      return null;
    },
    [puzzle]
  );

  /**
   * Get the cells that make up the current word and the associated clue
   */
  const getCurrentWordAndClue = useCallback((): {
    cells: { row: number; col: number }[];
    clue: CurrentClue;
  } | null => {
    if (!selectedCell) return null;

    // Find the clue for the selected cell
    const clue = findClueForCell(selectedCell.row, selectedCell.col, direction);
    if (!clue) return null;

    // Build array of cells from the clue
    const cells: { row: number; col: number }[] = [];

    if (direction === 'across') {
      for (let i = 0; i < clue.length; i++) {
        cells.push({ row: clue.row, col: clue.col + i });
      }
    } else {
      for (let i = 0; i < clue.length; i++) {
        cells.push({ row: clue.row + i, col: clue.col });
      }
    }

    return {
      cells,
      clue: {
        number: clue.number,
        direction: clue.direction,
        text: clue.text,
      },
    };
  }, [puzzle, selectedCell, direction, findClueForCell]);

  /**
   * Handle cell click - select cell or toggle direction if clicking same cell
   */
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      // Skip black cells
      if (puzzle.grid[row][col].isBlack) return;

      // If clicking the same cell, toggle direction
      if (selectedCell?.row === row && selectedCell?.col === col) {
        setDirection((prev) => (prev === 'across' ? 'down' : 'across'));
      } else {
        setSelectedCell({ row, col });
      }
    },
    [puzzle, selectedCell]
  );

  /**
   * Find the next valid cell in the given direction (skipping black cells)
   */
  const findNextCell = useCallback(
    (
      fromRow: number,
      fromCol: number,
      deltaRow: number,
      deltaCol: number
    ): { row: number; col: number } | null => {
      let row = fromRow + deltaRow;
      let col = fromCol + deltaCol;

      // Keep moving until we find a valid cell or hit the edge
      while (row >= 0 && row < puzzle.height && col >= 0 && col < puzzle.width) {
        if (!puzzle.grid[row][col].isBlack) {
          return { row, col };
        }
        row += deltaRow;
        col += deltaCol;
      }

      return null;
    },
    [puzzle]
  );

  /**
   * Move to the next cell in the current direction after entering a letter
   */
  const autoAdvance = useCallback(
    (fromRow: number, fromCol: number): void => {
      const deltaRow = direction === 'down' ? 1 : 0;
      const deltaCol = direction === 'across' ? 1 : 0;

      const nextCell = findNextCell(fromRow, fromCol, deltaRow, deltaCol);
      if (nextCell) {
        setSelectedCell(nextCell);
      }
      // If no next cell, stay in place
    },
    [direction, findNextCell]
  );

  /**
   * Handle keyboard events for navigation and letter input
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!selectedCell) return;

      const { key } = event;

      // Handle letter keys (A-Z)
      if (/^[a-zA-Z]$/.test(key)) {
        event.preventDefault();
        const cellKey = `${selectedCell.row},${selectedCell.col}`;

        setUserEntries((prev) => {
          const newEntries = new Map(prev);
          newEntries.set(cellKey, key.toUpperCase());
          return newEntries;
        });

        // Auto-advance to next cell
        autoAdvance(selectedCell.row, selectedCell.col);
        return;
      }

      // Handle Backspace - clear current cell and move back
      if (key === 'Backspace') {
        event.preventDefault();
        const cellKey = `${selectedCell.row},${selectedCell.col}`;
        const currentEntry = userEntries.get(cellKey);

        if (currentEntry) {
          // If current cell has a letter, just clear it
          setUserEntries((prev) => {
            const newEntries = new Map(prev);
            newEntries.delete(cellKey);
            return newEntries;
          });
        } else {
          // If current cell is empty, move back and clear that cell
          const deltaRow = direction === 'down' ? -1 : 0;
          const deltaCol = direction === 'across' ? -1 : 0;
          const prevCell = findNextCell(selectedCell.row, selectedCell.col, deltaRow, deltaCol);

          if (prevCell) {
            setSelectedCell(prevCell);
            const prevCellKey = `${prevCell.row},${prevCell.col}`;
            setUserEntries((prev) => {
              const newEntries = new Map(prev);
              newEntries.delete(prevCellKey);
              return newEntries;
            });
          }
        }
        return;
      }

      // Handle Arrow keys
      let deltaRow = 0;
      let deltaCol = 0;

      switch (key) {
        case 'ArrowUp':
          deltaRow = -1;
          break;
        case 'ArrowDown':
          deltaRow = 1;
          break;
        case 'ArrowLeft':
          deltaCol = -1;
          break;
        case 'ArrowRight':
          deltaCol = 1;
          break;
        default:
          return; // Not an arrow key
      }

      event.preventDefault();
      const nextCell = findNextCell(selectedCell.row, selectedCell.col, deltaRow, deltaCol);
      if (nextCell) {
        setSelectedCell(nextCell);
      }
    },
    [selectedCell, userEntries, direction, autoAdvance, findNextCell]
  );

  // Compute current word and clue
  const wordAndClue = getCurrentWordAndClue();

  return {
    userEntries,
    selectedCell,
    direction,
    handleCellClick,
    handleKeyDown,
    currentWord: wordAndClue?.cells ?? null,
    currentClue: wordAndClue?.clue ?? null,
  };
}
