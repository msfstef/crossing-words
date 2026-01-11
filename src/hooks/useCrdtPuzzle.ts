/**
 * React hook for CRDT-backed puzzle state
 *
 * Bridges Yjs to React by:
 * - Creating/destroying PuzzleStore instances on puzzleId change
 * - Syncing Y.Map changes to React state via observers
 * - Exposing entry manipulation methods
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPuzzleStore, PuzzleStore } from '../crdt/puzzleStore';

interface UseCrdtPuzzleReturn {
  /** Current entries map (React state mirror of Y.Map) */
  entries: Map<string, string>;
  /** Whether IndexedDB sync is complete */
  ready: boolean;
  /** Set a cell entry */
  setEntry: (row: number, col: number, value: string) => void;
  /** Clear a cell entry */
  clearEntry: (row: number, col: number) => void;
  /** Get a cell entry */
  getEntry: (row: number, col: number) => string | undefined;
}

/**
 * Hook for managing CRDT-backed puzzle entries.
 *
 * Creates a new PuzzleStore for each puzzleId, waits for IndexedDB to sync,
 * then mirrors Y.Map changes to React state via observers.
 *
 * @param puzzleId - Unique identifier for the puzzle
 * @returns Object containing entries, ready state, and entry manipulation methods
 *
 * @example
 * ```typescript
 * const { entries, ready, setEntry, clearEntry } = useCrdtPuzzle('nyt-2024-01-15');
 *
 * if (!ready) return <div>Loading...</div>;
 *
 * // Set a value
 * setEntry(3, 7, 'A');
 *
 * // Read values
 * entries.get('3,7'); // 'A'
 *
 * // Clear a value
 * clearEntry(3, 7);
 * ```
 */
export function useCrdtPuzzle(puzzleId: string): UseCrdtPuzzleReturn {
  // Store reference for access in callbacks
  const storeRef = useRef<PuzzleStore | null>(null);

  // React state mirrors of Yjs state
  const [entries, setEntries] = useState<Map<string, string>>(() => new Map());
  const [ready, setReady] = useState(false);

  // Lifecycle management: create/destroy store on puzzleId change
  useEffect(() => {
    // Reset state for new puzzle
    setReady(false);
    setEntries(new Map());

    // Create new store for this puzzle
    const store = createPuzzleStore(puzzleId);
    storeRef.current = store;

    // Observer to sync Y.Map changes to React state
    const observer = () => {
      // Convert Y.Map to regular Map for React
      setEntries(new Map(store.entries.entries()));
    };

    // Wait for IndexedDB sync, then set up observer
    store.ready.then(() => {
      // Only proceed if this store is still current (not stale from rapid switches)
      if (storeRef.current !== store) {
        store.destroy();
        return;
      }

      // Initialize React state from persisted data
      setEntries(new Map(store.entries.entries()));

      // Set up observer for future changes
      store.entries.observe(observer);

      // Mark as ready
      setReady(true);
    });

    // Cleanup on unmount or puzzleId change
    return () => {
      // Remove observer before destroying
      store.entries.unobserve(observer);
      store.destroy();
      storeRef.current = null;
    };
  }, [puzzleId]);

  // Entry manipulation methods
  const setEntry = useCallback((row: number, col: number, value: string) => {
    const store = storeRef.current;
    if (!store) return;

    const key = `${row},${col}`;
    store.entries.set(key, value);
  }, []);

  const clearEntry = useCallback((row: number, col: number) => {
    const store = storeRef.current;
    if (!store) return;

    const key = `${row},${col}`;
    store.entries.delete(key);
  }, []);

  const getEntry = useCallback((row: number, col: number): string | undefined => {
    const key = `${row},${col}`;
    return entries.get(key);
  }, [entries]);

  return {
    entries,
    ready,
    setEntry,
    clearEntry,
    getEntry,
  };
}
