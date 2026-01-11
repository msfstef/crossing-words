import { useState, useCallback } from 'react';
import type { Puzzle } from '../types/puzzle';

interface PuzzleStateHook {
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  handleCellClick: (row: number, col: number) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  currentWord: { cells: { row: number; col: number }[] } | null;
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
   * Get the cells that make up the current word based on selected cell and direction
   */
  const getCurrentWord = useCallback((): { cells: { row: number; col: number }[] } | null => {
    if (!selectedCell) return null;

    const cells: { row: number; col: number }[] = [];

    if (direction === 'across') {
      // Find start of word
      let startCol = selectedCell.col;
      while (startCol > 0 && !puzzle.grid[selectedCell.row][startCol - 1].isBlack) {
        startCol--;
      }

      // Find end and collect all cells
      let col = startCol;
      while (col < puzzle.width && !puzzle.grid[selectedCell.row][col].isBlack) {
        cells.push({ row: selectedCell.row, col });
        col++;
      }
    } else {
      // Find start of word (going up)
      let startRow = selectedCell.row;
      while (startRow > 0 && !puzzle.grid[startRow - 1][selectedCell.col].isBlack) {
        startRow--;
      }

      // Find end and collect all cells
      let row = startRow;
      while (row < puzzle.height && !puzzle.grid[row][selectedCell.col].isBlack) {
        cells.push({ row, col: selectedCell.col });
        row++;
      }
    }

    return cells.length > 0 ? { cells } : null;
  }, [puzzle, selectedCell, direction]);

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
   * Move back to the previous cell in the current direction
   */
  const moveBack = useCallback(
    (fromRow: number, fromCol: number): void => {
      const deltaRow = direction === 'down' ? -1 : 0;
      const deltaCol = direction === 'across' ? -1 : 0;

      const prevCell = findNextCell(fromRow, fromCol, deltaRow, deltaCol);
      if (prevCell) {
        setSelectedCell(prevCell);
      }
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

  return {
    userEntries,
    selectedCell,
    direction,
    handleCellClick,
    handleKeyDown,
    currentWord: getCurrentWord(),
  };
}
