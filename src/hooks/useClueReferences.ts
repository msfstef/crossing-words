/**
 * Hook for managing clue reference highlighting.
 *
 * Uses a pre-computed clue reference map for O(1) lookup when navigating
 * between clues, instead of re-parsing regex patterns on every clue change.
 */

import { useMemo } from 'react';
import type { ClueReferenceMap } from '../types/clueReference';

/** Minimal clue info needed for reference lookup */
interface ClueInfo {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface UseClueReferencesOptions {
  /** Pre-computed clue reference map (from usePuzzleClueReferenceMap) */
  clueReferenceMap: ClueReferenceMap | null;
  /** The currently selected clue (minimal info needed) */
  currentClue: ClueInfo | null;
  /** Cells in the current word (to exclude from highlighting) */
  currentWordCells?: Set<string>;
}

interface UseClueReferencesResult {
  /** Cells from fully-referenced clues (whole word highlight) */
  referencedClueCells: Set<string>;
  /** Specific cells from letter-range references */
  letterReferenceCells: Set<string>;
  /** Cells from meta clue(s) that reference this clue's starred group */
  metaClueCells: Set<string>;
  /** Whether the current clue has any references */
  hasReferences: boolean;
  /** Whether the current clue has letter-specific references */
  hasLetterReferences: boolean;
  /** Whether this clue has a meta clue that describes it */
  hasMetaClue: boolean;
}

const emptyResult: UseClueReferencesResult = {
  referencedClueCells: new Set(),
  letterReferenceCells: new Set(),
  metaClueCells: new Set(),
  hasReferences: false,
  hasLetterReferences: false,
  hasMetaClue: false,
};

/**
 * Look up pre-computed clue references for highlighting.
 *
 * This hook performs O(1) lookup in the pre-computed map instead of
 * parsing regex patterns on every clue change, eliminating lag when
 * navigating between clues.
 */
export function useClueReferences({
  clueReferenceMap,
  currentClue,
  currentWordCells,
}: UseClueReferencesOptions): UseClueReferencesResult {
  return useMemo(() => {
    if (!clueReferenceMap || !currentClue) {
      return emptyResult;
    }

    // O(1) lookup in pre-computed map
    const clueId = `${currentClue.number}-${currentClue.direction}`;
    const precomputed = clueReferenceMap.get(clueId);

    if (!precomputed || !precomputed.hasReferences) {
      return emptyResult;
    }

    // Apply dynamic currentWord exclusion
    // We need to create a new Set to avoid mutating the cached one
    let referencedClueCells = precomputed.referencedClueCells;
    if (currentWordCells && currentWordCells.size > 0) {
      // Only create new Set if we actually need to exclude cells
      let needsFiltering = false;
      for (const cell of currentWordCells) {
        if (precomputed.referencedClueCells.has(cell)) {
          needsFiltering = true;
          break;
        }
      }

      if (needsFiltering) {
        referencedClueCells = new Set(precomputed.referencedClueCells);
        for (const cell of currentWordCells) {
          referencedClueCells.delete(cell);
        }
      }
    }

    // Apply same exclusion logic to metaClueCells
    let metaClueCells = precomputed.metaClueCells;
    if (currentWordCells && currentWordCells.size > 0 && precomputed.metaClueCells.size > 0) {
      let needsFiltering = false;
      for (const cell of currentWordCells) {
        if (precomputed.metaClueCells.has(cell)) {
          needsFiltering = true;
          break;
        }
      }

      if (needsFiltering) {
        metaClueCells = new Set(precomputed.metaClueCells);
        for (const cell of currentWordCells) {
          metaClueCells.delete(cell);
        }
      }
    }

    return {
      referencedClueCells,
      letterReferenceCells: precomputed.letterReferenceCells,
      metaClueCells,
      hasReferences:
        referencedClueCells.size > 0 ||
        precomputed.letterReferenceCells.size > 0,
      hasLetterReferences: precomputed.hasLetterReferences,
      hasMetaClue: precomputed.hasMetaClue,
    };
  }, [clueReferenceMap, currentClue, currentWordCells]);
}
