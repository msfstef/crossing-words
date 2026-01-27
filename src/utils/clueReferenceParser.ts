/**
 * Clue reference parser utility
 *
 * Parses crossword clue text to extract references to other clues.
 * Uses an extensible pattern registry to support various reference types:
 *
 * Direct References:
 * - Standard: "17-Across", "21-Down"
 * - Abbreviated: "17A", "21D"
 * - Written: "17 across", "21 down"
 * - See references: "See 17-Across"
 * - Multiple: "17-, 27-, and 48-Across"
 *
 * Letter References:
 * - Single: "letter 3 here", "the 6th letter"
 * - Range: "letters 6-7 of 21-Across"
 * - Cross-clue: "Letters 6-7 here + letters 2-1 of 21-Across"
 *
 * Theme Markers:
 * - Starred clues: "*Toy block..."
 * - Theme hints: "a hint to 17-, 23-, and 48-Across"
 *
 * Answer-Spanning:
 * - "last 3 letters + ..."
 * - "... first 4 letters"
 *
 * Contextual:
 * - "to a 22-Down", "sounds like 16-Across"
 */

import type { Clue, Puzzle } from '../types/puzzle';
import type {
  ClueReference,
  ParsedClueReferences,
  ReferenceHighlights,
  ExtendedParsedReferences,
  PatternRegistryConfig,
  PrecomputedClueReference,
  ClueReferenceMap,
} from '../types/clueReference';
import { PatternRegistry, createDefaultRegistry, getDefaultRegistry } from './patterns';

// Re-export types for convenience
export type {
  ClueReference,
  ParsedClueReferences,
  ReferenceHighlights,
  ExtendedParsedReferences,
  PrecomputedClueReference,
  ClueReferenceMap,
};

// Re-export pattern registry for advanced usage
export { PatternRegistry, createDefaultRegistry };

/**
 * Parse clue text to extract references to other clues.
 * Uses the default pattern registry.
 *
 * @param clueText - The text of the clue to parse
 * @param currentClueNumber - Number of the current clue (for "this clue"/"here" references)
 * @param currentDirection - Direction of the current clue
 * @returns Parsed references found in the clue text
 */
export function parseClueReferences(
  clueText: string,
  currentClueNumber: number,
  currentDirection: 'across' | 'down'
): ParsedClueReferences {
  const registry = getDefaultRegistry();
  const result = registry.parse({
    clueText,
    currentClueNumber,
    currentDirection,
  });

  // Return the basic interface for backward compatibility
  return {
    references: result.references,
    hasLetterReferences: result.hasLetterReferences,
  };
}

/**
 * Parse clue text with extended results including pattern metadata.
 * Useful for advanced highlighting and analytics.
 *
 * @param clueText - The text of the clue to parse
 * @param currentClueNumber - Number of the current clue
 * @param currentDirection - Direction of the current clue
 * @param config - Optional registry configuration
 * @returns Extended parsed results with full match metadata
 */
export function parseClueReferencesExtended(
  clueText: string,
  currentClueNumber: number,
  currentDirection: 'across' | 'down',
  config?: PatternRegistryConfig
): ExtendedParsedReferences {
  const registry = config
    ? createDefaultRegistry(config)
    : getDefaultRegistry();

  return registry.parse({
    clueText,
    currentClueNumber,
    currentDirection,
  });
}

/**
 * Get all cell keys for a clue's word.
 */
function getClueWordCells(clue: Clue, puzzle: Puzzle): string[] {
  const cells: string[] = [];

  for (let i = 0; i < clue.length; i++) {
    if (clue.direction === 'across') {
      const col = clue.col + i;
      if (col < puzzle.width && !puzzle.grid[clue.row][col].isBlack) {
        cells.push(`${clue.row},${col}`);
      }
    } else {
      const row = clue.row + i;
      if (row < puzzle.height && !puzzle.grid[row][clue.col].isBlack) {
        cells.push(`${row},${clue.col}`);
      }
    }
  }

  return cells;
}

/**
 * Resolve a letter range that may use sentinel values.
 * Handles:
 * - Positive numbers: direct 1-indexed positions
 * - Negative start: count from end (e.g., -3 means last 3 letters)
 * - -1 end with -1 start: just the last letter
 *
 * @param start - Start position (1-indexed or negative sentinel)
 * @param end - End position (1-indexed or negative sentinel)
 * @param clueLength - Total length of the clue word
 * @returns Resolved start and end positions (0-indexed)
 */
function resolveLetterRange(
  start: number,
  end: number,
  clueLength: number
): { start: number; end: number } {
  // Handle "last N letters" pattern (negative start)
  if (start < 0) {
    const count = Math.abs(start);
    return {
      start: Math.max(0, clueLength - count),
      end: clueLength - 1,
    };
  }

  // Handle "last letter" pattern (both -1)
  if (start === -1 && end === -1) {
    return {
      start: clueLength - 1,
      end: clueLength - 1,
    };
  }

  // Standard case: convert 1-indexed to 0-indexed
  return {
    start: start - 1,
    end: end - 1,
  };
}

/**
 * Convert parsed references to cell coordinates for highlighting.
 *
 * @param references - Parsed clue references
 * @param puzzle - The puzzle to resolve references against
 * @returns Sets of cell keys to highlight
 */
export function resolveReferencesToCells(
  references: ClueReference[],
  puzzle: Puzzle
): ReferenceHighlights {
  const referencedClueCells = new Set<string>();
  const letterReferenceCells = new Set<string>();

  for (const ref of references) {
    // Find the clue
    const clues =
      ref.direction === 'across' ? puzzle.clues.across : puzzle.clues.down;
    const clue = clues.find((c) => c.number === ref.clueNumber);

    if (!clue) continue;

    // Get all cells in the clue
    const clueCells = getClueWordCells(clue, puzzle);

    if (ref.letterRange) {
      // Resolve the letter range (handles sentinel values)
      const { start, end } = resolveLetterRange(
        ref.letterRange.start,
        ref.letterRange.end,
        clueCells.length
      );

      // Add specific letter positions
      for (let i = start; i <= end && i < clueCells.length; i++) {
        if (i >= 0) {
          letterReferenceCells.add(clueCells[i]);
        }
      }
    } else {
      // Add all cells in the referenced clue
      for (const cell of clueCells) {
        referencedClueCells.add(cell);
      }
    }
  }

  return { referencedClueCells, letterReferenceCells };
}

/**
 * Check if a clue is marked as starred (themed).
 * Useful for identifying theme answers in the grid.
 *
 * @param clueText - The text of the clue to check
 * @returns True if the clue starts with "*"
 */
export function isStarredClue(clueText: string): boolean {
  return clueText.startsWith('*');
}

/**
 * Get the display text for a clue (without the starred marker).
 *
 * @param clueText - The text of the clue
 * @returns The clue text without leading "*" if present
 */
export function getClueDisplayText(clueText: string): string {
  return isStarredClue(clueText) ? clueText.substring(1) : clueText;
}

/**
 * Find all starred clues and their cells in a puzzle.
 * Starred clues start with "*" (e.g., "*Toy block that anyone can play with?")
 *
 * @param puzzle - The puzzle to search
 * @returns Set of cell keys for all starred clue answers
 */
function findStarredClueCells(puzzle: Puzzle): Set<string> {
  const starredCells = new Set<string>();

  const processClues = (clues: Clue[]) => {
    for (const clue of clues) {
      if (isStarredClue(clue.text)) {
        // Add all cells in this starred clue's answer
        for (let i = 0; i < clue.length; i++) {
          if (clue.direction === 'across') {
            const col = clue.col + i;
            if (col < puzzle.width && !puzzle.grid[clue.row][col].isBlack) {
              starredCells.add(`${clue.row},${col}`);
            }
          } else {
            const row = clue.row + i;
            if (row < puzzle.height && !puzzle.grid[row][clue.col].isBlack) {
              starredCells.add(`${row},${clue.col}`);
            }
          }
        }
      }
    }
  };

  processClues(puzzle.clues.across);
  processClues(puzzle.clues.down);

  return starredCells;
}

/**
 * Build a complete clue reference map for a puzzle.
 * Pre-computes all clue references at puzzle load time for O(1) lookup
 * when navigating between clues.
 *
 * @param puzzle - The puzzle to build the reference map for
 * @returns Map from clue ID to pre-computed reference data
 */
export function buildClueReferenceMap(puzzle: Puzzle): ClueReferenceMap {
  const map: ClueReferenceMap = new Map();

  // Pre-compute starred clue cells for resolving starred references
  const starredClueCells = findStarredClueCells(puzzle);

  const processClues = (clues: Clue[], direction: 'across' | 'down') => {
    for (const clue of clues) {
      const clueId = `${clue.number}-${direction}`;

      // Parse references from clue text with extended results
      const parsed = parseClueReferencesExtended(clue.text, clue.number, direction);

      // Start with cells from explicit references
      const highlights = resolveReferencesToCells(parsed.references, puzzle);

      // If this clue references starred clues, add all starred clue cells
      if (parsed.hasStarredMarker && starredClueCells.size > 0) {
        for (const cell of starredClueCells) {
          highlights.referencedClueCells.add(cell);
        }
      }

      const hasReferences =
        highlights.referencedClueCells.size > 0 ||
        highlights.letterReferenceCells.size > 0;

      if (!hasReferences) {
        // Store empty result to avoid re-parsing
        map.set(clueId, {
          referencedClueCells: new Set(),
          letterReferenceCells: new Set(),
          hasReferences: false,
          hasLetterReferences: false,
        });
        continue;
      }

      map.set(clueId, {
        referencedClueCells: highlights.referencedClueCells,
        letterReferenceCells: highlights.letterReferenceCells,
        hasReferences: true,
        hasLetterReferences: parsed.hasLetterReferences,
      });
    }
  };

  processClues(puzzle.clues.across, 'across');
  processClues(puzzle.clues.down, 'down');

  return map;
}
