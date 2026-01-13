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
 * Type for cell verification status.
 * - 'checked': Cell was verified by user using check action
 * - 'revealed': Cell letter was revealed by user
 */
export type VerifiedType = 'checked' | 'revealed';

/**
 * Type alias for the verified cells map.
 * Keys are in "row,col" format (matching entries).
 * Values indicate how the cell was verified.
 */
export type VerifiedMap = Y.Map<VerifiedType>;

/**
 * Type alias for the error cells map.
 * Keys are in "row,col" format (matching entries).
 * Values are true for cells marked as incorrect.
 */
export type ErrorsMap = Y.Map<boolean>;

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

/**
 * Gets the shared verified map from a Y.Doc.
 *
 * The verified map tracks which cells have been verified (checked or revealed).
 * Once a cell is verified, it cannot be edited or re-checked.
 *
 * @param doc - The Y.Doc instance
 * @returns The shared Y.Map for verified cells
 */
export function getVerifiedMap(doc: Y.Doc): VerifiedMap {
  return doc.getMap<VerifiedType>('verified');
}

/**
 * Gets the shared errors map from a Y.Doc.
 *
 * The errors map tracks which cells have been marked as incorrect
 * by the check action. Errors are cleared when:
 * - The cell is corrected and re-checked
 * - The cell is revealed
 *
 * @param doc - The Y.Doc instance
 * @returns The shared Y.Map for error cells
 */
export function getErrorsMap(doc: Y.Doc): ErrorsMap {
  return doc.getMap<boolean>('errors');
}

/**
 * Type alias for the settings map.
 * Stores shared puzzle settings like auto-check mode.
 */
export type SettingsMap = Y.Map<boolean | string | number>;

/**
 * Type alias for the durations map.
 * Keys are stable client IDs (UUID stored in localStorage).
 * Values are durations in milliseconds.
 */
export type DurationsMap = Y.Map<number>;

/**
 * Gets the shared settings map from a Y.Doc.
 *
 * The settings map stores puzzle-wide settings that sync across peers:
 * - autoCheck: boolean - Whether auto-check mode is enabled
 *
 * @param doc - The Y.Doc instance
 * @returns The shared Y.Map for settings
 */
export function getSettingsMap(doc: Y.Doc): SettingsMap {
  return doc.getMap<boolean | string | number>('settings');
}

/**
 * Gets the shared durations map from a Y.Doc.
 *
 * The durations map stores per-client play time in milliseconds.
 * Each client stores their own duration, and to get the total play time
 * across all players, compute Math.max of all values.
 *
 * @param doc - The Y.Doc instance
 * @returns The shared Y.Map for durations
 */
export function getDurationsMap(doc: Y.Doc): DurationsMap {
  return doc.getMap<number>('durations');
}
