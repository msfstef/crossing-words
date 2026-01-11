/**
 * Puzzle document module for Yjs CRDT
 *
 * Creates Y.Doc instances for puzzle state synchronization.
 * Each puzzle gets its own Y.Doc instance to enable isolated sync.
 */

import * as Y from 'yjs';

/**
 * Type alias for the entries map.
 * Keys are in "row,col" format (e.g., "3,7" for row 3, column 7).
 * Values are single uppercase letters (e.g., "A", "B").
 */
export type EntriesMap = Y.Map<string>;

/**
 * Creates a new Y.Doc instance for a puzzle.
 *
 * Each puzzle should have its own Y.Doc to enable:
 * - Independent persistence per puzzle
 * - Clean provider attachment (Phase 5)
 * - Isolated sync sessions
 *
 * @param puzzleId - Unique identifier for the puzzle (used for logging/debugging)
 * @returns A new Y.Doc instance
 */
export function createPuzzleDoc(puzzleId: string): Y.Doc {
  const doc = new Y.Doc();
  console.debug(`[puzzleDoc] Created Y.Doc for puzzle: ${puzzleId}`);
  return doc;
}

/**
 * Gets the shared entries map from a Y.Doc.
 *
 * The entries map stores user-entered letters for each cell.
 * - Keys use "row,col" format (e.g., "0,0", "3,7")
 * - Values are single uppercase letters (e.g., "A", "B")
 *
 * This matches the existing userEntries pattern in usePuzzleState.ts.
 *
 * @example
 * ```typescript
 * const doc = createPuzzleDoc('puzzle-123');
 * const entries = getEntriesMap(doc);
 *
 * // Set a value
 * entries.set('3,7', 'A');
 *
 * // Get a value
 * const letter = entries.get('3,7'); // 'A'
 *
 * // Delete a value (clear cell)
 * entries.delete('3,7');
 * ```
 *
 * @param doc - The Y.Doc instance
 * @returns The shared Y.Map for cell entries
 */
export function getEntriesMap(doc: Y.Doc): EntriesMap {
  return doc.getMap<string>('entries');
}
