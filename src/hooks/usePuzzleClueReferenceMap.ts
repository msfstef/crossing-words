/**
 * Hook for pre-computing clue references at puzzle load time.
 *
 * This hook builds a complete map of all clue references when the puzzle
 * changes, enabling O(1) lookup when navigating between clues instead of
 * re-parsing regex patterns on every clue change.
 */

import { useMemo } from 'react';
import type { Puzzle } from '../types/puzzle';
import type { ClueReferenceMap } from '../types/clueReference';
import { buildClueReferenceMap } from '../utils/clueReferenceParser';

/**
 * Pre-compute all clue references for a puzzle.
 *
 * This hook runs once when the puzzle changes and returns a map that can be
 * used for O(1) lookup of clue references. The map is memoized based on
 * puzzle identity.
 *
 * @param puzzle - The puzzle to pre-compute references for
 * @returns Map from clue ID to pre-computed reference data, or null if no puzzle
 */
export function usePuzzleClueReferenceMap(
  puzzle: Puzzle | null
): ClueReferenceMap | null {
  return useMemo(() => {
    if (!puzzle) return null;
    return buildClueReferenceMap(puzzle);
  }, [puzzle]);
}
