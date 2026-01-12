import { useState, useCallback, useEffect } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { Puzzle, Clue } from '../types/puzzle';
import { useCrdtPuzzle } from './useCrdtPuzzle';
import type { ConnectionState } from '../crdt/webrtcProvider';

interface CurrentClue {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface PuzzleStateHookOptions {
  /** Puzzle to store in CRDT for sharing (sharer provides this) */
  puzzle?: Puzzle | null;
  /** Callback when puzzle is received from CRDT (recipient receives via this) */
  onPuzzleReceived?: (puzzle: Puzzle) => void;
}

interface PuzzleStateHook {
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
  handleCellClick: (row: number, col: number) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  currentWord: { row: number; col: number }[] | null;
  currentClue: CurrentClue | null;
  ready: boolean;
  connectionState: ConnectionState;
  /** Yjs Awareness for presence tracking (null when not in P2P mode) */
  awareness: Awareness | null;
}

/**
 * Custom hook for managing puzzle solving state
 * Handles cell selection, direction toggle, letter input, and navigation
 * Uses CRDT-backed entries for persistence and multiplayer sync
 *
 * @param puzzle - The puzzle data
 * @param puzzleId - Unique identifier for the puzzle
 * @param roomId - Optional room ID for P2P collaboration
 * @param options - Optional puzzle sync options for sharing/receiving puzzle data
 */
export function usePuzzleState(
  puzzle: Puzzle,
  puzzleId: string,
  roomId?: string,
  options?: PuzzleStateHookOptions
): PuzzleStateHook {
  // Use CRDT-backed entries with optional P2P sync and puzzle sharing
  const {
    entries: userEntries,
    ready,
    setEntry,
    clearEntry,
    connectionState,
    awareness,
  } = useCrdtPuzzle(puzzleId, roomId, {
    puzzle: options?.puzzle,
    onPuzzleReceived: options?.onPuzzleReceived,
  });
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');

  // Sync cursor position to awareness when selection or direction changes
  useEffect(() => {
    if (!awareness) return;

    if (selectedCell) {
      awareness.setLocalStateField('cursor', {
        row: selectedCell.row,
        col: selectedCell.col,
        direction,
      });
    } else {
      awareness.setLocalStateField('cursor', null);
    }
  }, [awareness, selectedCell, direction]);

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

    // Build array of cells from the clue (skipping black cells for safety)
    const cells: { row: number; col: number }[] = [];

    if (direction === 'across') {
      for (let i = 0; i < clue.length; i++) {
        const col = clue.col + i;
        if (col < puzzle.width && !puzzle.grid[clue.row][col].isBlack) {
          cells.push({ row: clue.row, col });
        }
      }
    } else {
      for (let i = 0; i < clue.length; i++) {
        const row = clue.row + i;
        if (row < puzzle.height && !puzzle.grid[row][clue.col].isBlack) {
          cells.push({ row, col: clue.col });
        }
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
   * Only toggles direction if the alternate direction has a valid clue
   */
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      // Skip black cells
      if (puzzle.grid[row][col].isBlack) return;

      // If clicking the same cell, toggle direction only if alternate has a clue
      if (selectedCell?.row === row && selectedCell?.col === col) {
        const alternateDirection = direction === 'across' ? 'down' : 'across';
        const alternateClue = findClueForCell(row, col, alternateDirection);
        if (alternateClue) {
          setDirection(alternateDirection);
        }
        // If no alternate clue, stay in current direction
      } else {
        // When selecting a new cell, prefer a direction that has a clue
        const acrossClue = findClueForCell(row, col, 'across');
        const downClue = findClueForCell(row, col, 'down');

        if (acrossClue && !downClue) {
          setDirection('across');
        } else if (downClue && !acrossClue) {
          setDirection('down');
        }
        // If both or neither exist, keep current direction

        setSelectedCell({ row, col });
      }
    },
    [puzzle, selectedCell, direction, findClueForCell]
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
   * Find the first cell in a row that has a clue in the given direction
   */
  const findFirstCellInRowWithClue = useCallback(
    (row: number, dir: 'across' | 'down'): { row: number; col: number } | null => {
      for (let col = 0; col < puzzle.width; col++) {
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir)) {
          return { row, col };
        }
      }
      return null;
    },
    [puzzle, findClueForCell]
  );

  /**
   * Find the first cell in a column that has a clue in the given direction
   */
  const findFirstCellInColWithClue = useCallback(
    (col: number, dir: 'across' | 'down'): { row: number; col: number } | null => {
      for (let row = 0; row < puzzle.height; row++) {
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir)) {
          return { row, col };
        }
      }
      return null;
    },
    [puzzle, findClueForCell]
  );

  /**
   * Find next cell that has a clue in the current direction
   */
  const findNextCellWithClue = useCallback(
    (
      fromRow: number,
      fromCol: number,
      deltaRow: number,
      deltaCol: number,
      dir: 'across' | 'down'
    ): { row: number; col: number } | null => {
      let row = fromRow + deltaRow;
      let col = fromCol + deltaCol;

      while (row >= 0 && row < puzzle.height && col >= 0 && col < puzzle.width) {
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir)) {
          return { row, col };
        }
        row += deltaRow;
        col += deltaCol;
      }

      return null;
    },
    [puzzle, findClueForCell]
  );

  /**
   * Move to the next cell in the current direction after entering a letter
   * Only moves to cells that have a clue in the current direction
   * Wraps to next row/column when reaching the end
   */
  const autoAdvance = useCallback(
    (fromRow: number, fromCol: number): void => {
      const deltaRow = direction === 'down' ? 1 : 0;
      const deltaCol = direction === 'across' ? 1 : 0;

      // First try to find next cell in same row/column with a clue
      const nextCell = findNextCellWithClue(fromRow, fromCol, deltaRow, deltaCol, direction);
      if (nextCell) {
        setSelectedCell(nextCell);
        return;
      }

      // At end of row/column - wrap to next row/column
      if (direction === 'across') {
        // Try next rows until we find one with a cell that has an across clue
        for (let nextRow = fromRow + 1; nextRow < puzzle.height; nextRow++) {
          const cell = findFirstCellInRowWithClue(nextRow, 'across');
          if (cell) {
            setSelectedCell(cell);
            return;
          }
        }
        // If no more rows, wrap to first row
        for (let nextRow = 0; nextRow <= fromRow; nextRow++) {
          const cell = findFirstCellInRowWithClue(nextRow, 'across');
          if (cell) {
            setSelectedCell(cell);
            return;
          }
        }
      } else {
        // Try next columns until we find one with a cell that has a down clue
        for (let nextCol = fromCol + 1; nextCol < puzzle.width; nextCol++) {
          const cell = findFirstCellInColWithClue(nextCol, 'down');
          if (cell) {
            setSelectedCell(cell);
            return;
          }
        }
        // If no more columns, wrap to first column
        for (let nextCol = 0; nextCol <= fromCol; nextCol++) {
          const cell = findFirstCellInColWithClue(nextCol, 'down');
          if (cell) {
            setSelectedCell(cell);
            return;
          }
        }
      }
    },
    [direction, findNextCellWithClue, findFirstCellInRowWithClue, findFirstCellInColWithClue, puzzle]
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

        // Use CRDT-backed setEntry
        setEntry(selectedCell.row, selectedCell.col, key.toUpperCase());

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
          // If current cell has a letter, just clear it (CRDT-backed)
          clearEntry(selectedCell.row, selectedCell.col);
        } else {
          // If current cell is empty, move back and clear that cell
          const deltaRow = direction === 'down' ? -1 : 0;
          const deltaCol = direction === 'across' ? -1 : 0;
          const prevCell = findNextCell(selectedCell.row, selectedCell.col, deltaRow, deltaCol);

          if (prevCell) {
            setSelectedCell(prevCell);
            // Clear previous cell (CRDT-backed)
            clearEntry(prevCell.row, prevCell.col);
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
    [selectedCell, userEntries, direction, autoAdvance, findNextCell, setEntry, clearEntry]
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
    ready,
    connectionState,
    awareness,
  };
}
