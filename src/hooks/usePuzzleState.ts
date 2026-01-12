import { useState, useCallback, useEffect } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { Puzzle, Clue } from '../types/puzzle';
import { useCrdtPuzzle } from './useCrdtPuzzle';
import type { ConnectionState } from '../crdt/webrtcProvider';
import type { VerifiedMap, ErrorsMap } from '../crdt/puzzleDoc';

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
  /** Set of verified cell keys ("row,col") */
  verifiedCells: Set<string>;
  /** Set of error cell keys ("row,col") */
  errorCells: Set<string>;
  /** Raw verified map for useVerification hook */
  verifiedMap: VerifiedMap | null;
  /** Raw errors map for useVerification hook */
  errorsMap: ErrorsMap | null;
  /** Raw Y.Doc for useVerification hook */
  doc: Y.Doc | null;
  /** Raw entries map for useVerification hook */
  entriesMap: Y.Map<string> | null;
  /** Whether auto-check mode is enabled (synced via CRDT) */
  autoCheckEnabled: boolean;
  /** Toggle auto-check mode (synced via CRDT) */
  setAutoCheck: (enabled: boolean) => void;
  /** Navigate to previous clue in current direction */
  goToPrevClue: () => void;
  /** Navigate to next clue in current direction */
  goToNextClue: () => void;
  /** Whether there is a previous clue */
  hasPrevClue: boolean;
  /** Whether there is a next clue */
  hasNextClue: boolean;
  /** Type a letter in the current cell (for virtual keyboard) */
  typeLetter: (letter: string) => void;
  /** Handle backspace action (for virtual keyboard) */
  handleBackspace: () => void;
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
    verifiedCells,
    errorCells,
    verifiedMap,
    errorsMap,
    doc,
    entriesMap,
    autoCheckEnabled,
    setAutoCheck,
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
   * Skips verified cells (they are locked and cannot be edited)
   */
  const findFirstCellInRowWithClue = useCallback(
    (row: number, dir: 'across' | 'down'): { row: number; col: number } | null => {
      for (let col = 0; col < puzzle.width; col++) {
        const key = `${row},${col}`;
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir) && !verifiedCells.has(key)) {
          return { row, col };
        }
      }
      return null;
    },
    [puzzle, findClueForCell, verifiedCells]
  );

  /**
   * Find the first cell in a column that has a clue in the given direction
   * Skips verified cells (they are locked and cannot be edited)
   */
  const findFirstCellInColWithClue = useCallback(
    (col: number, dir: 'across' | 'down'): { row: number; col: number } | null => {
      for (let row = 0; row < puzzle.height; row++) {
        const key = `${row},${col}`;
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir) && !verifiedCells.has(key)) {
          return { row, col };
        }
      }
      return null;
    },
    [puzzle, findClueForCell, verifiedCells]
  );

  /**
   * Find next cell that has a clue in the current direction
   * Skips verified cells (they are locked and cannot be edited)
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
        const key = `${row},${col}`;

        // Skip black cells and verified cells
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir) && !verifiedCells.has(key)) {
          return { row, col };
        }
        row += deltaRow;
        col += deltaCol;
      }

      return null;
    },
    [puzzle, findClueForCell, verifiedCells]
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
   * Type a letter in the current cell (for virtual keyboard).
   * Same behavior as physical keyboard letter input.
   */
  const typeLetter = useCallback(
    (letter: string) => {
      if (!selectedCell) return;

      const cellKey = `${selectedCell.row},${selectedCell.col}`;

      // Block editing verified cells - just advance without editing
      if (verifiedCells.has(cellKey)) {
        autoAdvance(selectedCell.row, selectedCell.col);
        return;
      }

      // Use CRDT-backed setEntry
      setEntry(selectedCell.row, selectedCell.col, letter.toUpperCase());

      // Auto-advance to next cell
      autoAdvance(selectedCell.row, selectedCell.col);
    },
    [selectedCell, verifiedCells, setEntry, autoAdvance]
  );

  /**
   * Find previous non-verified cell for backspace navigation
   */
  const findPrevNonVerifiedCell = useCallback(
    (fromRow: number, fromCol: number): { row: number; col: number } | null => {
      const deltaRow = direction === 'down' ? -1 : 0;
      const deltaCol = direction === 'across' ? -1 : 0;
      let row = fromRow + deltaRow;
      let col = fromCol + deltaCol;

      while (row >= 0 && row < puzzle.height && col >= 0 && col < puzzle.width) {
        const key = `${row},${col}`;
        if (!puzzle.grid[row][col].isBlack && !verifiedCells.has(key)) {
          return { row, col };
        }
        row += deltaRow;
        col += deltaCol;
      }
      return null;
    },
    [puzzle, direction, verifiedCells]
  );

  /**
   * Handle backspace action (for virtual keyboard).
   * Same behavior as physical backspace key.
   */
  const handleBackspaceAction = useCallback(() => {
    if (!selectedCell) return;

    const cellKey = `${selectedCell.row},${selectedCell.col}`;

    // Block deleting verified cells - find previous non-verified cell
    if (verifiedCells.has(cellKey)) {
      const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);
      if (prevCell) {
        setSelectedCell(prevCell);
      }
      return;
    }

    const currentEntry = userEntries.get(cellKey);

    if (currentEntry) {
      // If current cell has a letter, just clear it (CRDT-backed)
      clearEntry(selectedCell.row, selectedCell.col);
    } else {
      // If current cell is empty, move back to previous non-verified cell and clear it
      const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);

      if (prevCell) {
        const prevKey = `${prevCell.row},${prevCell.col}`;
        // Only clear if not verified
        if (!verifiedCells.has(prevKey)) {
          setSelectedCell(prevCell);
          clearEntry(prevCell.row, prevCell.col);
        } else {
          setSelectedCell(prevCell);
        }
      }
    }
  }, [selectedCell, userEntries, verifiedCells, clearEntry, findPrevNonVerifiedCell]);

  /**
   * Handle keyboard events for navigation and letter input
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!selectedCell) return;

      const { key } = event;
      const cellKey = `${selectedCell.row},${selectedCell.col}`;

      // Handle letter keys (A-Z)
      if (/^[a-zA-Z]$/.test(key)) {
        event.preventDefault();

        // Block editing verified cells - just advance without editing
        if (verifiedCells.has(cellKey)) {
          autoAdvance(selectedCell.row, selectedCell.col);
          return;
        }

        // Use CRDT-backed setEntry
        setEntry(selectedCell.row, selectedCell.col, key.toUpperCase());

        // Auto-advance to next cell
        autoAdvance(selectedCell.row, selectedCell.col);
        return;
      }

      // Handle Backspace - clear current cell and move back
      if (key === 'Backspace') {
        event.preventDefault();

        // Block deleting verified cells - find previous non-verified cell
        if (verifiedCells.has(cellKey)) {
          const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);
          if (prevCell) {
            setSelectedCell(prevCell);
          }
          return;
        }

        const currentEntry = userEntries.get(cellKey);

        if (currentEntry) {
          // If current cell has a letter, just clear it (CRDT-backed)
          clearEntry(selectedCell.row, selectedCell.col);
        } else {
          // If current cell is empty, move back to previous non-verified cell and clear it
          const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);

          if (prevCell) {
            const prevKey = `${prevCell.row},${prevCell.col}`;
            // Only clear if not verified
            if (!verifiedCells.has(prevKey)) {
              setSelectedCell(prevCell);
              clearEntry(prevCell.row, prevCell.col);
            } else {
              setSelectedCell(prevCell);
            }
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
    [selectedCell, userEntries, direction, autoAdvance, findNextCell, findPrevNonVerifiedCell, setEntry, clearEntry, verifiedCells]
  );

  // Compute current word and clue
  const wordAndClue = getCurrentWordAndClue();

  /**
   * Get sorted list of clue numbers for the current direction.
   */
  const getClueNumbers = useCallback((): number[] => {
    const clues = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
    return clues.map((c) => c.number).sort((a, b) => a - b);
  }, [puzzle, direction]);

  /**
   * Get the current clue number based on selected cell.
   */
  const getCurrentClueNumber = useCallback((): number | null => {
    if (!selectedCell) return null;
    const clue = findClueForCell(selectedCell.row, selectedCell.col, direction);
    return clue?.number ?? null;
  }, [selectedCell, direction, findClueForCell]);

  /**
   * Navigate to a clue by its number. Selects the first cell of that clue.
   */
  const goToClue = useCallback(
    (clueNumber: number) => {
      const clues = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const clue = clues.find((c) => c.number === clueNumber);
      if (clue) {
        setSelectedCell({ row: clue.row, col: clue.col });
      }
    },
    [puzzle, direction]
  );

  /**
   * Navigate to the previous clue in the current direction.
   */
  const goToPrevClue = useCallback(() => {
    const clueNumbers = getClueNumbers();
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) return;

    const currentIndex = clueNumbers.indexOf(currentNum);
    if (currentIndex > 0) {
      goToClue(clueNumbers[currentIndex - 1]);
    }
  }, [getClueNumbers, getCurrentClueNumber, goToClue]);

  /**
   * Navigate to the next clue in the current direction.
   */
  const goToNextClue = useCallback(() => {
    const clueNumbers = getClueNumbers();
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) return;

    const currentIndex = clueNumbers.indexOf(currentNum);
    if (currentIndex >= 0 && currentIndex < clueNumbers.length - 1) {
      goToClue(clueNumbers[currentIndex + 1]);
    }
  }, [getClueNumbers, getCurrentClueNumber, goToClue]);

  // Compute whether prev/next clue navigation is available
  const clueNavState = (() => {
    const clueNumbers = getClueNumbers();
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) {
      return { hasPrev: false, hasNext: false };
    }
    const currentIndex = clueNumbers.indexOf(currentNum);
    return {
      hasPrev: currentIndex > 0,
      hasNext: currentIndex >= 0 && currentIndex < clueNumbers.length - 1,
    };
  })();

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
    verifiedCells,
    errorCells,
    verifiedMap,
    errorsMap,
    doc,
    entriesMap,
    autoCheckEnabled,
    setAutoCheck,
    goToPrevClue,
    goToNextClue,
    hasPrevClue: clueNavState.hasPrev,
    hasNextClue: clueNavState.hasNext,
    typeLetter,
    handleBackspace: handleBackspaceAction,
  };
}
