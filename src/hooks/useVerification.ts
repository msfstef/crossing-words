/**
 * React hook for check/reveal verification operations.
 *
 * Provides 6 action callbacks for UI to wire up:
 * - checkLetter, checkWord, checkPuzzle: Mark correct as verified, incorrect as error
 * - revealLetter, revealWord, revealPuzzle: Set entry to solution and mark as revealed
 *
 * Uses doc.transact() for atomic batch updates to prevent race conditions
 * on concurrent operations.
 */

import { useCallback } from 'react';
import type * as Y from 'yjs';
import type { Puzzle } from '../types/puzzle';
import type { VerifiedType } from '../crdt/puzzleDoc';
import { checkCell, checkWord as checkWordUtil, checkPuzzle as checkPuzzleUtil } from '../utils/verification';

interface UseVerificationOptions {
  puzzle: Puzzle;
  entries: Map<string, string>;
  entriesMap: Y.Map<string>;
  verifiedMap: Y.Map<VerifiedType>;
  errorsMap: Y.Map<boolean>;
  doc: Y.Doc;
  currentWord: { row: number; col: number }[] | null;
  selectedCell: { row: number; col: number } | null;
}

/**
 * Hook for check/reveal verification operations.
 *
 * @param options - Required puzzle state and CRDT maps
 * @returns Object with 6 action callbacks
 */
export function useVerification({
  puzzle,
  entries,
  entriesMap,
  verifiedMap,
  errorsMap,
  doc,
  currentWord,
  selectedCell,
}: UseVerificationOptions) {

  // Check operations - mark correct as verified, incorrect as error
  const checkLetter = useCallback(() => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const key = `${row},${col}`;

    // Skip if already verified
    if (verifiedMap.has(key)) return;

    const result = checkCell(puzzle, row, col, entries.get(key));

    doc.transact(() => {
      if (result === 'correct') {
        verifiedMap.set(key, 'checked');
        errorsMap.delete(key);
      } else if (result === 'incorrect') {
        errorsMap.set(key, true);
      }
    });
  }, [puzzle, entries, verifiedMap, errorsMap, doc, selectedCell]);

  const checkWord = useCallback(() => {
    if (!currentWord) return;

    const result = checkWordUtil(puzzle, currentWord, entries);

    doc.transact(() => {
      for (const key of result.correct) {
        if (!verifiedMap.has(key)) {
          verifiedMap.set(key, 'checked');
          errorsMap.delete(key);
        }
      }
      for (const key of result.incorrect) {
        if (!verifiedMap.has(key)) {
          errorsMap.set(key, true);
        }
      }
    });
  }, [puzzle, entries, currentWord, verifiedMap, errorsMap, doc]);

  const checkPuzzle = useCallback(() => {
    const result = checkPuzzleUtil(puzzle, entries);

    doc.transact(() => {
      for (const key of result.correct) {
        if (!verifiedMap.has(key)) {
          verifiedMap.set(key, 'checked');
          errorsMap.delete(key);
        }
      }
      for (const key of result.incorrect) {
        if (!verifiedMap.has(key)) {
          errorsMap.set(key, true);
        }
      }
    });
  }, [puzzle, entries, verifiedMap, errorsMap, doc]);

  // Reveal operations - set entry to solution and mark as revealed
  const revealLetter = useCallback(() => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    const key = `${row},${col}`;

    // Skip if already verified
    if (verifiedMap.has(key)) return;

    const cell = puzzle.grid[row][col];
    if (!cell.letter) return;

    doc.transact(() => {
      entriesMap.set(key, cell.letter!);
      verifiedMap.set(key, 'revealed');
      errorsMap.delete(key);
    });
  }, [puzzle, entriesMap, verifiedMap, errorsMap, doc, selectedCell]);

  const revealWord = useCallback(() => {
    if (!currentWord) return;

    doc.transact(() => {
      for (const { row, col } of currentWord) {
        const key = `${row},${col}`;
        if (verifiedMap.has(key)) continue;

        const cell = puzzle.grid[row][col];
        if (!cell.letter) continue;

        entriesMap.set(key, cell.letter);
        verifiedMap.set(key, 'revealed');
        errorsMap.delete(key);
      }
    });
  }, [puzzle, currentWord, entriesMap, verifiedMap, errorsMap, doc]);

  const revealPuzzle = useCallback(() => {
    doc.transact(() => {
      for (let row = 0; row < puzzle.height; row++) {
        for (let col = 0; col < puzzle.width; col++) {
          const cell = puzzle.grid[row][col];
          if (cell.isBlack || !cell.letter) continue;

          const key = `${row},${col}`;
          if (verifiedMap.has(key)) continue;

          entriesMap.set(key, cell.letter);
          verifiedMap.set(key, 'revealed');
          errorsMap.delete(key);
        }
      }
    });
  }, [puzzle, entriesMap, verifiedMap, errorsMap, doc]);

  // Verify all cells as checked (for completion)
  const verifyAllCells = useCallback(() => {
    doc.transact(() => {
      for (let row = 0; row < puzzle.height; row++) {
        for (let col = 0; col < puzzle.width; col++) {
          const cell = puzzle.grid[row][col];
          if (cell.isBlack || !cell.letter) continue;

          const key = `${row},${col}`;
          // Skip if already verified
          if (verifiedMap.has(key)) continue;

          verifiedMap.set(key, 'checked');
          errorsMap.delete(key);
        }
      }
    });
  }, [puzzle, verifiedMap, errorsMap, doc]);

  return {
    checkLetter,
    checkWord,
    checkPuzzle,
    revealLetter,
    revealWord,
    revealPuzzle,
    verifyAllCells,
  };
}
