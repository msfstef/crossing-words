/**
 * Puzzle store module with IndexedDB persistence
 *
 * Wraps Y.Doc with IndexedDB persistence for offline-capable puzzle state.
 * Each puzzle gets isolated storage and a ready promise that resolves
 * when the document is synced from IndexedDB.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { createPuzzleDoc, getEntriesMap, type EntriesMap } from './puzzleDoc';

/**
 * PuzzleStore wraps a Y.Doc with IndexedDB persistence.
 *
 * Provides:
 * - Automatic persistence to IndexedDB
 * - Ready promise that resolves when state is loaded
 * - Direct access to doc and entries for use with providers (Phase 5)
 * - Clean destroy method for lifecycle management
 */
export class PuzzleStore {
  /** The underlying Y.Doc instance */
  readonly doc: Y.Doc;

  /** The shared entries map for cell values */
  readonly entries: EntriesMap;

  /** Promise that resolves when IndexedDB sync is complete */
  readonly ready: Promise<void>;

  /** IndexedDB persistence instance (for cleanup) */
  private readonly persistence: IndexeddbPersistence;

  /** The puzzle ID this store is associated with */
  readonly puzzleId: string;

  /**
   * Creates a new PuzzleStore with IndexedDB persistence.
   *
   * @param puzzleId - Unique identifier for the puzzle
   */
  constructor(puzzleId: string) {
    this.puzzleId = puzzleId;
    this.doc = createPuzzleDoc(puzzleId);
    this.entries = getEntriesMap(this.doc);

    // Create IndexedDB persistence with puzzle-specific storage key
    const storageKey = `puzzle-${puzzleId}`;
    this.persistence = new IndexeddbPersistence(storageKey, this.doc);

    // Ready promise resolves when IndexedDB is synced
    this.ready = new Promise<void>((resolve) => {
      this.persistence.on('synced', () => {
        console.debug(`[puzzleStore] IndexedDB synced for puzzle: ${puzzleId}`);
        resolve();
      });
    });
  }

  /**
   * Destroys the store and cleans up resources.
   *
   * Call this when:
   * - Switching to a different puzzle
   * - Unmounting components that use this store
   * - Cleaning up on app shutdown
   *
   * After calling destroy(), this store instance should not be used.
   */
  destroy(): void {
    console.debug(`[puzzleStore] Destroying store for puzzle: ${this.puzzleId}`);
    this.persistence.destroy();
    this.doc.destroy();
  }

  /**
   * Clears all persisted data for this puzzle.
   *
   * Useful for:
   * - Resetting puzzle progress
   * - Clearing corrupted state
   *
   * Note: This clears the IndexedDB data but the in-memory Y.Doc
   * state remains until the store is destroyed and recreated.
   */
  async clearData(): Promise<void> {
    console.debug(`[puzzleStore] Clearing data for puzzle: ${this.puzzleId}`);
    await this.persistence.clearData();
  }
}

/**
 * Creates a new PuzzleStore instance.
 *
 * This is the primary factory function for creating stores.
 * Each call creates a new, independent store.
 *
 * @example
 * ```typescript
 * const store = createPuzzleStore('nyt-2024-01-15');
 *
 * // Wait for IndexedDB to load existing state
 * await store.ready;
 *
 * // Use the entries map
 * store.entries.set('0,0', 'A');
 * const letter = store.entries.get('0,0');
 *
 * // Clean up when done
 * store.destroy();
 * ```
 *
 * @param puzzleId - Unique identifier for the puzzle
 * @returns A new PuzzleStore instance
 */
export function createPuzzleStore(puzzleId: string): PuzzleStore {
  return new PuzzleStore(puzzleId);
}
