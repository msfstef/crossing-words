import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { Puzzle, Clue } from '../types/puzzle';
import { useCrdtPuzzle } from './useCrdtPuzzle';
import type { ConnectionState } from '../crdt/webrtcProvider';
import type { VerifiedMap, ErrorsMap } from '../crdt/puzzleDoc';
import type { PuzzleMetadata, PuzzleWithMetadata } from '../collaboration/puzzleSync';

interface CurrentClue {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface PuzzleStateHookOptions {
  /** Puzzle to store in CRDT for sharing (sharer provides this) */
  puzzle?: Puzzle | null;
  /** Metadata (source, date) for the puzzle being shared */
  metadata?: PuzzleMetadata;
  /** Callback when puzzle is received from CRDT (recipient receives via this) */
  onPuzzleReceived?: (result: PuzzleWithMetadata) => void;
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
  /** Clear all entries (reset puzzle) */
  clearAllEntries: () => void;
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
    clearAllEntries,
  } = useCrdtPuzzle(puzzleId, roomId, {
    puzzle: options?.puzzle,
    metadata: options?.metadata,
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Necessary: initialize cell selection on puzzle load
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
   * Check if the current cell is the first cell (leftmost for across, topmost for down) in the clue.
   * @param row - Current row
   * @param col - Current column
   * @param dir - Current direction
   * @returns True if this is the first cell in the clue
   */
  const isFirstCellInClue = useCallback(
    (row: number, col: number, dir: 'across' | 'down'): boolean => {
      const clue = findClueForCell(row, col, dir);
      if (!clue) return false;

      if (dir === 'across') {
        return col === clue.col;
      } else {
        return row === clue.row;
      }
    },
    [findClueForCell]
  );

  /**
   * Find the last cell of a clue. If all cells are verified, return the last cell anyway.
   * @param clue - The clue to search
   * @param dir - The direction of the clue
   * @returns The last cell position
   */
  const findLastCellInClue = useCallback(
    (clue: Clue, dir: 'across' | 'down'): { row: number; col: number } => {
      if (dir === 'across') {
        // Find the last non-verified cell, working backwards
        for (let i = clue.length - 1; i >= 0; i--) {
          const col = clue.col + i;
          const key = `${clue.row},${col}`;
          if (col < puzzle.width &&
              !puzzle.grid[clue.row][col].isBlack &&
              !verifiedCells.has(key)) {
            return { row: clue.row, col };
          }
        }
        // All cells verified, return last cell anyway
        return { row: clue.row, col: clue.col + clue.length - 1 };
      } else {
        // Find the last non-verified cell, working backwards
        for (let i = clue.length - 1; i >= 0; i--) {
          const row = clue.row + i;
          const key = `${row},${clue.col}`;
          if (row < puzzle.height &&
              !puzzle.grid[row][clue.col].isBlack &&
              !verifiedCells.has(key)) {
            return { row, col: clue.col };
          }
        }
        // All cells verified, return last cell anyway
        return { row: clue.row + clue.length - 1, col: clue.col };
      }
    },
    [puzzle, verifiedCells]
  );

  /**
   * Move to the next cell in the current direction after entering a letter.
   *
   * Logic:
   * 1. If empty cells remain in current clue → go to next empty cell (may wrap within clue)
   * 2. If current clue is complete → jump to next clue with empty cells (by clue number)
   * 3. If ALL puzzle cells filled → stay in place
   */
  const autoAdvance = useCallback(
    (fromRow: number, fromCol: number): void => {
      const currentClue = findClueForCell(fromRow, fromCol, direction);
      if (!currentClue) return;

      // Exclude the current cell since it was just filled (state hasn't updated yet)
      const excludeCell = { row: fromRow, col: fromCol };
      const emptyCellsInCurrentClue = countEmptyCellsInClue(currentClue, direction, excludeCell);

      if (emptyCellsInCurrentClue > 0) {
        // Clue has other empty cells - find next empty cell
        // First try to find one after current position
        const deltaRow = direction === 'down' ? 1 : 0;
        const deltaCol = direction === 'across' ? 1 : 0;
        const nextCellInDirection = findNextCellWithClue(fromRow, fromCol, deltaRow, deltaCol, direction);

        if (nextCellInDirection) {
          // Check if this cell is empty (considering we just filled fromRow, fromCol)
          const nextKey = `${nextCellInDirection.row},${nextCellInDirection.col}`;
          const isNextEmpty = !userEntries.get(nextKey) && !verifiedCells.has(nextKey);

          if (isNextEmpty) {
            setSelectedCell(nextCellInDirection);
            return;
          }
        }

        // No empty cells after us, wrap to first empty in clue
        const cell = findFirstEmptyCellInClue(currentClue, direction, excludeCell);
        setSelectedCell(cell);
      } else {
        // Current clue is complete - jump to next clue with empty cells
        const nextClueWithEmpty = findNextClueWithEmptyCells(
          currentClue.number,
          direction,
          true // Search other direction too
        );

        if (nextClueWithEmpty) {
          const cell = findFirstEmptyCellInClue(nextClueWithEmpty.clue, nextClueWithEmpty.direction);
          setSelectedCell(cell);
          setDirection(nextClueWithEmpty.direction);
        }
        // If no clue has empty cells, stay in place (all puzzle complete)
      }
    },
    [
      direction,
      findClueForCell,
      countEmptyCellsInClue,
      findFirstEmptyCellInClue,
      findNextClueWithEmptyCells,
      findNextCellWithClue,
      userEntries,
      verifiedCells,
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
   * Navigate to the previous clue's last cell. Used for backspace at start of clue.
   * Returns the target cell and direction, or null if at the very first clue of the first orientation.
   */
  const getPreviousClueLastCell = useCallback((): {
    cell: { row: number; col: number };
    dir: 'across' | 'down';
  } | null => {
    if (!selectedCell) return null;

    const currentClue = findClueForCell(selectedCell.row, selectedCell.col, direction);
    if (!currentClue) return null;

    // Get clue numbers for current and other direction
    const acrossClueNumbers = [...puzzle.clues.across].map(c => c.number).sort((a, b) => a - b);
    const downClueNumbers = [...puzzle.clues.down].map(c => c.number).sort((a, b) => a - b);

    const currentClueNumbers = direction === 'across' ? acrossClueNumbers : downClueNumbers;
    const otherClueNumbers = direction === 'across' ? downClueNumbers : acrossClueNumbers;
    const otherDir = direction === 'across' ? 'down' : 'across';

    const currentIndex = currentClueNumbers.indexOf(currentClue.number);

    // Try previous clue in current direction
    if (currentIndex > 0) {
      const prevClueNum = currentClueNumbers[currentIndex - 1];
      const clues = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const prevClue = clues.find(c => c.number === prevClueNum);
      if (prevClue) {
        const cell = findLastCellInClue(prevClue, direction);
        return { cell, dir: direction };
      }
    }

    // At the first clue in current direction - wrap to other direction
    if (otherClueNumbers.length > 0) {
      const lastClueNum = otherClueNumbers[otherClueNumbers.length - 1];
      const otherClues = otherDir === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const lastClue = otherClues.find(c => c.number === lastClueNum);
      if (lastClue) {
        const cell = findLastCellInClue(lastClue, otherDir);
        return { cell, dir: otherDir };
      }
    }

    // No previous clue at all, wrap to last clue in current direction
    if (currentClueNumbers.length > 0) {
      const lastClueNum = currentClueNumbers[currentClueNumbers.length - 1];
      const clues = direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
      const lastClue = clues.find(c => c.number === lastClueNum);
      if (lastClue) {
        const cell = findLastCellInClue(lastClue, direction);
        return { cell, dir: direction };
      }
    }

    return null;
  }, [selectedCell, direction, puzzle, findClueForCell, findLastCellInClue]);

  /**
   * Handle backspace action (for virtual keyboard).
   * Same behavior as physical backspace key.
   *
   * Behavior:
   * - Filled cell: Clear it, stay in place
   * - Empty cell: Move back one cell (don't clear previous)
   * - First cell of clue: Navigate to previous clue's last cell (don't clear)
   * - First cell of first clue: Wrap to last cell of last clue
   * - Verified cells: Skip over them when moving backwards
   */
  const handleBackspaceAction = useCallback(() => {
    if (!selectedCell) return;

    const cellKey = `${selectedCell.row},${selectedCell.col}`;

    // Block deleting verified cells - just move back
    if (verifiedCells.has(cellKey)) {
      const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);
      if (prevCell) {
        setSelectedCell(prevCell);
      } else {
        // At first cell of clue and it's verified - go to previous clue
        const prevClueCell = getPreviousClueLastCell();
        if (prevClueCell) {
          setSelectedCell(prevClueCell.cell);
          setDirection(prevClueCell.dir);
        }
      }
      return;
    }

    const currentEntry = userEntries.get(cellKey);

    // Clear the current cell if it has a letter
    if (currentEntry) {
      clearEntry(selectedCell.row, selectedCell.col);
    }

    // Always move back (whether cell was filled or empty)
    const isAtFirstCell = isFirstCellInClue(selectedCell.row, selectedCell.col, direction);

    if (isAtFirstCell) {
      // At the first cell of the clue - navigate to previous clue's last cell
      const prevClueCell = getPreviousClueLastCell();
      if (prevClueCell) {
        setSelectedCell(prevClueCell.cell);
        setDirection(prevClueCell.dir);
      }
    } else {
      // Not at first cell - move back within the clue
      const prevCell = findPrevNonVerifiedCell(selectedCell.row, selectedCell.col);
      if (prevCell) {
        setSelectedCell(prevCell);
      }
    }
  }, [selectedCell, userEntries, verifiedCells, clearEntry, findPrevNonVerifiedCell, isFirstCellInClue, direction, getPreviousClueLastCell]);

  // Compute current word and clue - memoized to prevent unnecessary re-renders
  // The result object reference stays stable when inputs don't change,
  // ensuring Grid and ClueBar update in the same render cycle
  const wordAndClue = useMemo(
    () => getCurrentWordAndClue(),
    [getCurrentWordAndClue]
  );

  /**
   * Get sorted list of clue numbers for a specific direction.
   */
  const getClueNumbersForDirection = useCallback((dir: 'across' | 'down'): number[] => {
    const clues = dir === 'across' ? puzzle.clues.across : puzzle.clues.down;
    return clues.map((c) => c.number).sort((a, b) => a - b);
  }, [puzzle]);

  /**
   * Get sorted list of clue numbers for the current direction.
   */
  const getClueNumbers = useCallback((): number[] => {
    return getClueNumbersForDirection(direction);
  }, [getClueNumbersForDirection, direction]);

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
   * Navigate to the previous clue following clue number order.
   * When at the first clue in current direction, wraps to the last clue
   * in the other direction, then back to the last clue in the original direction.
   */
  const goToPrevClue = useCallback(() => {
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) return;

    const currentClueNumbers = getClueNumbers();
    const currentIndex = currentClueNumbers.indexOf(currentNum);

    // Try previous clue in current direction
    if (currentIndex > 0) {
      goToClue(currentClueNumbers[currentIndex - 1]);
      return;
    }

    // At the first clue in current direction - wrap to other direction
    const otherDir = direction === 'across' ? 'down' : 'across';
    const otherClueNumbers = getClueNumbersForDirection(otherDir);

    if (otherClueNumbers.length > 0) {
      // Go to last clue in other direction
      goToClue(otherClueNumbers[otherClueNumbers.length - 1], otherDir);
    } else if (currentClueNumbers.length > 0) {
      // No clues in other direction, wrap to last clue in current direction
      goToClue(currentClueNumbers[currentClueNumbers.length - 1]);
    }
  }, [getCurrentClueNumber, getClueNumbers, getClueNumbersForDirection, direction, goToClue]);

  /**
   * Navigate to the next clue following clue number order.
   * When at the last clue in current direction, wraps to the first clue
   * in the other direction, then back to the first clue in the original direction.
   */
  const goToNextClue = useCallback(() => {
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) return;

    const currentClueNumbers = getClueNumbers();
    const currentIndex = currentClueNumbers.indexOf(currentNum);

    // Try next clue in current direction
    if (currentIndex >= 0 && currentIndex < currentClueNumbers.length - 1) {
      goToClue(currentClueNumbers[currentIndex + 1]);
      return;
    }

    // At the last clue in current direction - wrap to other direction
    const otherDir = direction === 'across' ? 'down' : 'across';
    const otherClueNumbers = getClueNumbersForDirection(otherDir);

    if (otherClueNumbers.length > 0) {
      // Go to first clue in other direction
      goToClue(otherClueNumbers[0], otherDir);
    } else if (currentClueNumbers.length > 0) {
      // No clues in other direction, wrap to first clue in current direction
      goToClue(currentClueNumbers[0]);
    }
  }, [getCurrentClueNumber, getClueNumbers, getClueNumbersForDirection, direction, goToClue]);

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

      // Handle Backspace - delegate to handleBackspaceAction for consistent behavior
      if (key === 'Backspace') {
        event.preventDefault();
        handleBackspaceAction();
        return;
      }

      // Handle Space bar - toggle direction
      if (key === ' ') {
        event.preventDefault();
        toggleDirection();
        return;
      }

      // Handle Delete key - clear current cell, stay in place
      if (key === 'Delete') {
        event.preventDefault();
        // Don't delete verified cells
        if (!verifiedCells.has(cellKey)) {
          clearEntry(selectedCell.row, selectedCell.col);
        }
        return;
      }

      // Handle Tab / Shift+Tab - clue navigation
      if (key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevClue();
        } else {
          goToNextClue();
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
    [selectedCell, autoAdvance, findNextCell, setEntry, clearEntry, verifiedCells, toggleDirection, handleBackspaceAction, goToNextClue, goToPrevClue]
  );

  // ============================================
  // Swipe Navigation Functions
  // ============================================

  /**
   * Handle swipe navigation.
   * Moves one cell in the swipe direction (like arrow keys).
   * Skips black cells, stops at puzzle edges.
   *
   * @param swipeDirection - The direction of the swipe gesture
   */
  const handleSwipeNavigation = useCallback(
    (swipeDirection: 'left' | 'right' | 'up' | 'down') => {
      if (!selectedCell) return;

      // Convert swipe direction to delta values (same as arrow keys)
      let deltaRow = 0;
      let deltaCol = 0;

      switch (swipeDirection) {
        case 'up':
          deltaRow = -1;
          break;
        case 'down':
          deltaRow = 1;
          break;
        case 'left':
          deltaCol = -1;
          break;
        case 'right':
          deltaCol = 1;
          break;
      }

      // Use the same findNextCell logic as arrow keys (skips black cells, stops at edges)
      const nextCell = findNextCell(selectedCell.row, selectedCell.col, deltaRow, deltaCol);
      if (nextCell) {
        setSelectedCell(nextCell);
      }
    },
    [selectedCell, findNextCell]
  );

  // Compute whether prev/next clue navigation is available
  // With wrap-around navigation, prev/next are always available if there are any clues
  const clueNavState = useMemo(() => {
    const currentNum = getCurrentClueNumber();
    if (currentNum === null) {
      return { hasPrev: false, hasNext: false };
    }
    // Navigation is always available since we wrap around between orientations
    const hasAnyClues = puzzle.clues.across.length > 0 || puzzle.clues.down.length > 0;
    return {
      hasPrev: hasAnyClues,
      hasNext: hasAnyClues,
    };
  }, [getCurrentClueNumber, puzzle.clues.across.length, puzzle.clues.down.length]);

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
    clearAllEntries,
  };
}
