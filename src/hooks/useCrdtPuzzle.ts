/**
 * React hook for CRDT-backed puzzle state
 *
 * Bridges Yjs to React by:
 * - Creating/destroying PuzzleStore instances on puzzleId change
 * - Syncing Y.Map changes to React state via observers
 * - Exposing entry manipulation methods
 */

import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
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

// Empty map constant for initial state
const EMPTY_MAP = new Map<string, string>();

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
  // Store reference for access in callbacks and external store
  const storeRef = useRef<PuzzleStore | null>(null);
  const readyRef = useRef(false);
  const snapshotRef = useRef<Map<string, string>>(EMPTY_MAP);
  const subscribersRef = useRef(new Set<() => void>());

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Notify all subscribers of changes
  const notifySubscribers = useCallback(() => {
    subscribersRef.current.forEach((callback) => callback());
  }, []);

  // Get snapshot function for useSyncExternalStore
  const getSnapshot = useCallback(() => snapshotRef.current, []);
  const getReadySnapshot = useCallback(() => readyRef.current, []);

  // Use useSyncExternalStore for entries and ready state
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReadySnapshot, getReadySnapshot);

  // Lifecycle management: create/destroy store on puzzleId change
  useEffect(() => {
    // Reset refs for new puzzle (synchronous, no setState in effect body)
    readyRef.current = false;
    snapshotRef.current = EMPTY_MAP;
    notifySubscribers();

    // Create new store for this puzzle
    const store = createPuzzleStore(puzzleId);
    storeRef.current = store;

    // Track whether observer was attached (for safe cleanup)
    let observerAttached = false;

    // Observer to sync Y.Map changes to React state
    const observer = () => {
      // Convert Y.Map to regular Map for React
      snapshotRef.current = new Map(store.entries.entries());
      notifySubscribers();
    };

    // Wait for IndexedDB sync, then set up observer
    store.ready.then(() => {
      // Only proceed if this store is still current (not stale from rapid switches)
      if (storeRef.current !== store) {
        store.destroy();
        return;
      }

      // Initialize React state from persisted data
      snapshotRef.current = new Map(store.entries.entries());

      // Set up observer for future changes
      store.entries.observe(observer);
      observerAttached = true;

      // Mark as ready
      readyRef.current = true;
      notifySubscribers();
    });

    // Cleanup on unmount or puzzleId change
    return () => {
      // Only unobserve if observer was attached
      if (observerAttached) {
        store.entries.unobserve(observer);
      }
      store.destroy();
      storeRef.current = null;
    };
  }, [puzzleId, notifySubscribers]);

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
