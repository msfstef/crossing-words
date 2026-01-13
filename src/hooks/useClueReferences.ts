/**
 * Hook for managing clue reference highlighting.
 *
 * Parses the current clue text for references to other clues
 * and resolves them to cell coordinates for highlighting.
 */

import { useMemo } from 'react';
import type { Puzzle } from '../types/puzzle';
import {
  parseClueReferences,
  resolveReferencesToCells,
} from '../utils/clueReferenceParser';

/** Minimal clue info needed for reference parsing */
interface ClueInfo {
  number: number;
  direction: 'across' | 'down';
  text: string;
}

interface UseClueReferencesOptions {
  /** The puzzle being solved */
  puzzle: Puzzle | null;
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
  /** Whether the current clue has any references */
  hasReferences: boolean;
  /** Whether the current clue has letter-specific references */
  hasLetterReferences: boolean;
}

/**
 * Parse and resolve clue references for highlighting.
 */
export function useClueReferences({
  puzzle,
  currentClue,
  currentWordCells,
}: UseClueReferencesOptions): UseClueReferencesResult {
  return useMemo(() => {
    const emptyResult: UseClueReferencesResult = {
      referencedClueCells: new Set(),
      letterReferenceCells: new Set(),
      hasReferences: false,
      hasLetterReferences: false,
    };

    if (!puzzle || !currentClue) {
      return emptyResult;
    }

    // Parse the clue text for references
    const parsed = parseClueReferences(
      currentClue.text,
      currentClue.number,
      currentClue.direction
    );

    if (parsed.references.length === 0) {
      return emptyResult;
    }

    // Resolve references to cell coordinates
    const highlights = resolveReferencesToCells(parsed.references, puzzle);

    // Exclude current word cells from whole-clue highlights only
    // (to avoid visual conflict with current word selection)
    // Letter-specific references are kept even in current word
    // (e.g., "letters 2-3 here" should still highlight those cells)
    if (currentWordCells && currentWordCells.size > 0) {
      for (const cell of currentWordCells) {
        highlights.referencedClueCells.delete(cell);
        // Keep letterReferenceCells - specific letter highlights are important
      }
    }

    return {
      referencedClueCells: highlights.referencedClueCells,
      letterReferenceCells: highlights.letterReferenceCells,
      hasReferences:
        highlights.referencedClueCells.size > 0 ||
        highlights.letterReferenceCells.size > 0,
      hasLetterReferences: highlights.letterReferenceCells.size > 0,
    };
  }, [puzzle, currentClue, currentWordCells]);
}
