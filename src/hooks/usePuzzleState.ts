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
  /** Toggle direction between across and down (if alternate clue exists) */
  toggleDirection: () => void;
  /** Handle swipe navigation (for mobile touch gestures) */
  handleSwipeNavigation: (direction: 'left' | 'right' | 'up' | 'down') => void;
  /** Set the selected cell (exposed for follow functionality) */
  setSelectedCell: (cell: { row: number; col: number } | null) => void;
  /** Set the direction (exposed for follow functionality) */
  setDirection: (direction: 'across' | 'down') => void;
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

  // Auto-select first clue when puzzle becomes ready
  useEffect(() => {
    // Only run when ready and no cell is selected
    if (!ready || selectedCell) return;

    // Find first across clue
    const firstAcross = puzzle.clues.across[0];
    if (firstAcross) {
      setSelectedCell({ row: firstAcross.row, col: firstAcross.col });
      setDirection('across');
      return;
    }

    // If no across clues, try first down clue
    const firstDown = puzzle.clues.down[0];
    if (firstDown) {
      setSelectedCell({ row: firstDown.row, col: firstDown.col });
      setDirection('down');
    }
    // If no clues at all, leave unselected (shouldn't happen with valid puzzles)
  }, [ready, puzzle.clues.across, puzzle.clues.down]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: selectedCell intentionally excluded to prevent re-runs after user navigates

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
   * Toggle direction between across and down.
   * Only toggles if current cell has a clue in the alternate direction.
   */
  const toggleDirection = useCallback(() => {
    if (!selectedCell) return;

    const alternateDirection = direction === 'across' ? 'down' : 'across';
    const alternateClue = findClueForCell(selectedCell.row, selectedCell.col, alternateDirection);

    if (alternateClue) {
      setDirection(alternateDirection);
    }
    // If no alternate clue, do nothing
  }, [selectedCell, direction, findClueForCell]);

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
   * Find next cell that has a clue in the current direction
   * Skips verified cells and filled cells
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

        // Skip black cells, verified cells, and filled cells
        if (!puzzle.grid[row][col].isBlack && findClueForCell(row, col, dir) && !verifiedCells.has(key) && !userEntries.get(key)) {
          return { row, col };
        }
        row += deltaRow;
        col += deltaCol;
      }

      return null;
    },
    [puzzle, findClueForCell, verifiedCells, userEntries]
  );

  /**
   * Find the first empty cell in a clue. If all cells are filled, return the first cell.
   * @param clue - The clue to search
   * @param dir - The direction of the clue
   * @returns The first empty cell, or the first cell if all filled
   */
  const findFirstEmptyCellInClue = useCallback(
    (clue: Clue, dir: 'across' | 'down', excludeCell?: { row: number; col: number }): { row: number; col: number } => {
      if (dir === 'across') {
        for (let i = 0; i < clue.length; i++) {
          const col = clue.col + i;
          const key = `${clue.row},${col}`;
          // Skip the cell if it matches excludeCell
          if (excludeCell && clue.row === excludeCell.row && col === excludeCell.col) {
            continue;
          }
          if (col < puzzle.width &&
              !puzzle.grid[clue.row][col].isBlack &&
              !verifiedCells.has(key) &&
              !userEntries.get(key)) {
            return { row: clue.row, col };
          }
        }
      } else {
        for (let i = 0; i < clue.length; i++) {
          const row = clue.row + i;
          const key = `${row},${clue.col}`;
          // Skip the cell if it matches excludeCell
          if (excludeCell && row === excludeCell.row && clue.col === excludeCell.col) {
            continue;
          }
          if (row < puzzle.height &&
              !puzzle.grid[row][clue.col].isBlack &&
              !verifiedCells.has(key) &&
              !userEntries.get(key)) {
            return { row, col: clue.col };
          }
        }
      }
      // If all cells are filled, return the first cell
      return { row: clue.row, col: clue.col };
    },
    [puzzle, verifiedCells, userEntries]
  );

  /**
   * Count how many empty cells a clue has (excluding verified cells).
   * @param clue - The clue to check
   * @param dir - The direction of the clue
   * @returns Number of empty cells
   */
  const countEmptyCellsInClue = useCallback(
    (clue: Clue, dir: 'across' | 'down', excludeCell?: { row: number; col: number }): number => {
      let count = 0;
      if (dir === 'across') {
        for (let i = 0; i < clue.length; i++) {
          const col = clue.col + i;
          const key = `${clue.row},${col}`;
          // Skip the cell if it matches excludeCell
          if (excludeCell && clue.row === excludeCell.row && col === excludeCell.col) {
            continue;
          }
          if (col < puzzle.width &&
              !puzzle.grid[clue.row][col].isBlack &&
              !verifiedCells.has(key) &&
              !userEntries.get(key)) {
            count++;
          }
        }
      } else {
        for (let i = 0; i < clue.length; i++) {
          const row = clue.row + i;
          const key = `${row},${clue.col}`;
          // Skip the cell if it matches excludeCell
          if (excludeCell && row === excludeCell.row && clue.col === excludeCell.col) {
            continue;
          }
          if (row < puzzle.height &&
              !puzzle.grid[row][clue.col].isBlack &&
              !verifiedCells.has(key) &&
              !userEntries.get(key)) {
            count++;
          }
        }
      }
      return count;
    },
    [puzzle, verifiedCells, userEntries]
  );

  /**
   * Find the next clue that has empty cells, searching by clue number order.
   * @param currentClueNumber - The current clue number
   * @param dir - The direction to search
   * @param searchOtherDirection - If true, also search the other direction after current direction
   * @returns The next clue with empty cells, or null if none found
   */
  const findNextClueWithEmptyCells = useCallback(
    (
      currentClueNumber: number,
      dir: 'across' | 'down',
      searchOtherDirection: boolean = false
    ): { clue: Clue; direction: 'across' | 'down' } | null => {
      const clues = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const sortedClues = [...clues].sort((a, b) => a.number - b.number);

      // Find clues after current clue number in current direction
      for (const clue of sortedClues) {
        if (clue.number > currentClueNumber && countEmptyCellsInClue(clue, dir) > 0) {
          return { clue, direction: dir };
        }
      }

      // Wrap around to beginning of current direction
      for (const clue of sortedClues) {
        if (clue.number <= currentClueNumber && countEmptyCellsInClue(clue, dir) > 0) {
          return { clue, direction: dir };
        }
      }

      // If searchOtherDirection is true, search the other direction
      if (searchOtherDirection) {
        const otherDir = dir === 'across' ? 'down' : 'across';
        const otherClues = otherDir === 'across' ? puzzle.clues.across : puzzle.clues.down;
        const sortedOtherClues = [...otherClues].sort((a, b) => a.number - b.number);

        for (const clue of sortedOtherClues) {
          if (countEmptyCellsInClue(clue, otherDir) > 0) {
            return { clue, direction: otherDir };
          }
        }
      }

      return null;
    },
    [puzzle, countEmptyCellsInClue]
  );

  /**
   * Check if the current cell is the last cell (rightmost for across, bottommost for down) in the clue.
   * @param row - Current row
   * @param col - Current column
   * @param dir - Current direction
   * @returns True if this is the last cell in the clue
   */
  const isLastCellInClue = useCallback(
    (row: number, col: number, dir: 'across' | 'down'): boolean => {
      const clue = findClueForCell(row, col, dir);
      if (!clue) return false;

      if (dir === 'across') {
        // Last cell is at clue.col + clue.length - 1
        return col === clue.col + clue.length - 1;
      } else {
        // Last cell is at clue.row + clue.length - 1
        return row === clue.row + clue.length - 1;
      }
    },
    [findClueForCell]
  );

  /**
   * Move to the next cell in the current direction after entering a letter.
   * Implements smart navigation based on whether we filled the last cell in the clue.
   */
  const autoAdvance = useCallback(
    (fromRow: number, fromCol: number): void => {
      const currentClue = findClueForCell(fromRow, fromCol, direction);
      if (!currentClue) return;

      const isLast = isLastCellInClue(fromRow, fromCol, direction);

      if (isLast) {
        // We just filled the last cell (rightmost/bottommost) in the clue
        // Count how many empty cells remain in this clue (AFTER the current fill)
        // Exclude the current cell since it was just filled (state hasn't updated yet)
        const excludeCell = { row: fromRow, col: fromCol };
        const emptyCellsInCurrentClue = countEmptyCellsInClue(currentClue, direction, excludeCell);

        if (emptyCellsInCurrentClue > 0) {
          // Clue has other empty cells - go to first empty cell in same clue
          const cell = findFirstEmptyCellInClue(currentClue, direction, excludeCell);
          setSelectedCell(cell);
        } else {
          // This was the only missing cell or all cells are now filled
          // Go to next empty cell in next clue with empty cells
          const nextClueWithEmpty = findNextClueWithEmptyCells(
            currentClue.number,
            direction,
            true // Search other direction too
          );

          if (nextClueWithEmpty) {
            const cell = findFirstEmptyCellInClue(nextClueWithEmpty.clue, nextClueWithEmpty.direction);
            setSelectedCell(cell);
            setDirection(nextClueWithEmpty.direction);
          } else {
            // All cells filled - go to first cell of next clue in current direction
            const clues = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
            const sortedClues = [...clues].sort((a, b) => a.number - b.number);
            const currentIndex = sortedClues.findIndex((c) => c.number === currentClue.number);

            if (currentIndex >= 0 && currentIndex < sortedClues.length - 1) {
              const nextClue = sortedClues[currentIndex + 1];
              setSelectedCell({ row: nextClue.row, col: nextClue.col });
            }
          }
        }
      } else {
        // Not the last cell - normal auto-advance within the clue
        const deltaRow = direction === 'down' ? 1 : 0;
        const deltaCol = direction === 'across' ? 1 : 0;

        // Find next cell in same clue
        const nextCell = findNextCellWithClue(fromRow, fromCol, deltaRow, deltaCol, direction);
        if (nextCell) {
          setSelectedCell(nextCell);
        }
      }
    },
    [
      direction,
      findClueForCell,
      isLastCellInClue,
      countEmptyCellsInClue,
      findFirstEmptyCellInClue,
      findNextClueWithEmptyCells,
      findNextCellWithClue,
      puzzle,
    ]
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

      // Handle Space bar - toggle direction
      if (key === ' ') {
        event.preventDefault();
        toggleDirection();
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
    [selectedCell, userEntries, direction, autoAdvance, findNextCell, findPrevNonVerifiedCell, setEntry, clearEntry, verifiedCells, toggleDirection]
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
   * Navigate to a clue by its number.
   * Selects the first empty cell of that clue, or first cell if all filled.
   */
  const goToClue = useCallback(
    (clueNumber: number, dir?: 'across' | 'down') => {
      const targetDir = dir ?? direction;
      const clues = targetDir === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const clue = clues.find((c) => c.number === clueNumber);
      if (clue) {
        const cell = findFirstEmptyCellInClue(clue, targetDir);
        setSelectedCell(cell);
        if (dir !== undefined) {
          setDirection(dir);
        }
      }
    },
    [puzzle, direction, findFirstEmptyCellInClue]
  );

  /**
   * Navigate to the previous clue in the current direction.
   * Goes to the first empty cell of the previous clue, or first cell if all filled.
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
   * Goes to the first empty cell of the next clue (following clue number order),
   * searching current orientation first, then other orientation.
   * If all cells are filled, goes to the first cell of the next clue.
   */
  const goToNextClue = useCallback(() => {
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) return;

    // Find next clue with empty cells, searching both directions
    const nextClueWithEmpty = findNextClueWithEmptyCells(currentNum, direction, true);

    if (nextClueWithEmpty) {
      // Go to the first empty cell of this clue
      const cell = findFirstEmptyCellInClue(nextClueWithEmpty.clue, nextClueWithEmpty.direction);
      setSelectedCell(cell);
      setDirection(nextClueWithEmpty.direction);
    } else {
      // All cells filled - just go to next clue in current direction
      const clueNumbers = getClueNumbers();
      const currentIndex = clueNumbers.indexOf(currentNum);
      if (currentIndex >= 0 && currentIndex < clueNumbers.length - 1) {
        goToClue(clueNumbers[currentIndex + 1]);
      }
    }
  }, [getCurrentClueNumber, findNextClueWithEmptyCells, findFirstEmptyCellInClue, direction, getClueNumbers, goToClue]);

  // ============================================
  // Swipe Navigation Functions
  // ============================================

  /**
   * Find the next across clue that starts in the same row.
   * Used for horizontal swipe when on an across clue.
   *
   * @param row - The row to search in
   * @param currentCol - Current column position (start of current clue)
   * @param delta - Direction: +1 for right, -1 for left
   * @returns The clue object, or null if none found
   */
  const findNextAcrossClueInRow = useCallback(
    (row: number, currentCol: number, delta: number): Clue | null => {
      // Get all across clues in this row
      const cluesInRow = puzzle.clues.across.filter((c) => c.row === row);

      if (delta > 0) {
        // Moving right: find the first clue that starts after currentCol
        const sorted = cluesInRow.sort((a, b) => a.col - b.col);
        for (const clue of sorted) {
          if (clue.col > currentCol) {
            return clue;
          }
        }
      } else {
        // Moving left: find the last clue that starts before currentCol
        const sorted = cluesInRow.sort((a, b) => b.col - a.col);
        for (const clue of sorted) {
          if (clue.col < currentCol) {
            return clue;
          }
        }
      }

      return null;
    },
    [puzzle.clues.across]
  );

  /**
   * Find the next across clue in the same column (searching vertically).
   * Used for vertical swipe when on an across clue.
   * Searches from the leftmost cell of the current clue.
   *
   * @param col - The column to search in (leftmost cell of current clue)
   * @param currentRow - Current row position
   * @param delta - Direction: +1 for down, -1 for up
   * @returns The clue object, or null if none found
   */
  const findNextAcrossClueInColumn = useCallback(
    (col: number, currentRow: number, delta: number): Clue | null => {
      // Find across clues whose span includes this column
      const cluesInColumn = puzzle.clues.across.filter(
        (c) => c.col <= col && c.col + c.length > col
      );

      if (delta > 0) {
        // Moving down: find the first clue that starts after currentRow
        const sorted = cluesInColumn.sort((a, b) => a.row - b.row);
        for (const clue of sorted) {
          if (clue.row > currentRow) {
            return clue;
          }
        }
      } else {
        // Moving up: find the last clue that starts before currentRow
        const sorted = cluesInColumn.sort((a, b) => b.row - a.row);
        for (const clue of sorted) {
          if (clue.row < currentRow) {
            return clue;
          }
        }
      }

      return null;
    },
    [puzzle.clues.across]
  );

  /**
   * Find the next down clue that starts in the same column.
   * Used for vertical swipe when on a down clue.
   *
   * @param col - The column to search in
   * @param currentRow - Current row position (start of current clue)
   * @param delta - Direction: +1 for down, -1 for up
   * @returns The clue object, or null if none found
   */
  const findNextDownClueInColumn = useCallback(
    (col: number, currentRow: number, delta: number): Clue | null => {
      // Get all down clues in this column
      const cluesInColumn = puzzle.clues.down.filter((c) => c.col === col);

      if (delta > 0) {
        // Moving down: find the first clue that starts after currentRow
        const sorted = cluesInColumn.sort((a, b) => a.row - b.row);
        for (const clue of sorted) {
          if (clue.row > currentRow) {
            return clue;
          }
        }
      } else {
        // Moving up: find the last clue that starts before currentRow
        const sorted = cluesInColumn.sort((a, b) => b.row - a.row);
        for (const clue of sorted) {
          if (clue.row < currentRow) {
            return clue;
          }
        }
      }

      return null;
    },
    [puzzle.clues.down]
  );

  /**
   * Find the next down clue in the same row (searching horizontally).
   * Used for horizontal swipe when on a down clue.
   * Searches from the topmost cell of the current clue.
   *
   * @param row - The row to search in (topmost cell of current clue)
   * @param currentCol - Current column position
   * @param delta - Direction: +1 for right, -1 for left
   * @returns The clue object, or null if none found
   */
  const findNextDownClueInRow = useCallback(
    (row: number, currentCol: number, delta: number): Clue | null => {
      // Find down clues whose span includes this row
      const cluesInRow = puzzle.clues.down.filter(
        (c) => c.row <= row && c.row + c.length > row
      );

      if (delta > 0) {
        // Moving right: find the first clue that starts after currentCol
        const sorted = cluesInRow.sort((a, b) => a.col - b.col);
        for (const clue of sorted) {
          if (clue.col > currentCol) {
            return clue;
          }
        }
      } else {
        // Moving left: find the last clue that starts before currentCol
        const sorted = cluesInRow.sort((a, b) => b.col - a.col);
        for (const clue of sorted) {
          if (clue.col < currentCol) {
            return clue;
          }
        }
      }

      return null;
    },
    [puzzle.clues.down]
  );

  /**
   * Handle swipe navigation.
   * Routes to appropriate navigation function based on current direction and swipe direction.
   * Goes to the first empty cell of the target clue, or first cell if all filled.
   *
   * @param swipeDirection - The direction of the swipe gesture
   */
  const handleSwipeNavigation = useCallback(
    (swipeDirection: 'left' | 'right' | 'up' | 'down') => {
      if (!selectedCell) return;

      // Get current clue to find its start position
      const currentClue = findClueForCell(selectedCell.row, selectedCell.col, direction);
      if (!currentClue) return;

      const isAcross = direction === 'across';
      const isHorizontalSwipe = swipeDirection === 'left' || swipeDirection === 'right';

      let nextClue: Clue | null = null;

      if (isAcross && isHorizontalSwipe) {
        // Case 1: Across clue + horizontal swipe → move within same row
        const delta = swipeDirection === 'right' ? 1 : -1;
        nextClue = findNextAcrossClueInRow(currentClue.row, currentClue.col, delta);
      } else if (isAcross && !isHorizontalSwipe) {
        // Case 2: Across clue + vertical swipe → from leftmost cell, move vertically
        const delta = swipeDirection === 'down' ? 1 : -1;
        nextClue = findNextAcrossClueInColumn(currentClue.col, currentClue.row, delta);
      } else if (!isAcross && !isHorizontalSwipe) {
        // Case 3: Down clue + vertical swipe → move within same column
        const delta = swipeDirection === 'down' ? 1 : -1;
        nextClue = findNextDownClueInColumn(currentClue.col, currentClue.row, delta);
      } else {
        // Case 4: Down clue + horizontal swipe → from topmost cell, move horizontally
        const delta = swipeDirection === 'right' ? 1 : -1;
        nextClue = findNextDownClueInRow(currentClue.row, currentClue.col, delta);
      }

      if (nextClue) {
        // Go to first empty cell in the clue, or first cell if all filled
        const nextCell = findFirstEmptyCellInClue(nextClue, nextClue.direction);
        setSelectedCell(nextCell);
      }
    },
    [
      selectedCell,
      direction,
      findClueForCell,
      findNextAcrossClueInRow,
      findNextAcrossClueInColumn,
      findNextDownClueInColumn,
      findNextDownClueInRow,
      findFirstEmptyCellInClue,
    ]
  );

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
    toggleDirection,
    handleSwipeNavigation,
    setSelectedCell,
    setDirection,
  };
}
