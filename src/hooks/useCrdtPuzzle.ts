/**
 * React hook for CRDT-backed puzzle state
 *
 * Bridges Yjs to React by:
 * - Creating/destroying PuzzleStore instances on puzzleId change
 * - Syncing Y.Map changes to React state via observers
 * - Exposing entry manipulation methods
 * - Optional P2P sync via WebRTC when roomId is provided
 */

import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { createPuzzleStore, PuzzleStore } from '../crdt/puzzleStore';
import { createP2PSession, type P2PSession, type ConnectionState } from '../crdt/webrtcProvider';

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
  /** Room ID for P2P session (undefined if not in P2P mode) */
  roomId: string | undefined;
  /** P2P connection state ('disconnected' when no roomId) */
  connectionState: ConnectionState;
  /** Yjs Awareness for presence tracking (null when not in P2P mode) */
  awareness: Awareness | null;
}

// Empty map constant for initial state
const EMPTY_MAP = new Map<string, string>();

/**
 * Hook for managing CRDT-backed puzzle entries with optional P2P sync.
 *
 * Creates a new PuzzleStore for each puzzleId, waits for IndexedDB to sync,
 * then mirrors Y.Map changes to React state via observers.
 *
 * When roomId is provided, creates a P2P session for collaborative solving.
 * The P2P session is created AFTER IndexedDB loads to prevent empty state sync.
 *
 * @param puzzleId - Unique identifier for the puzzle
 * @param roomId - Optional room ID for P2P collaboration
 * @returns Object containing entries, ready state, roomId, and entry manipulation methods
 *
 * @example
 * ```typescript
 * // Local only (no P2P)
 * const { entries, ready, setEntry, clearEntry } = useCrdtPuzzle('nyt-2024-01-15');
 *
 * // With P2P sync
 * const { entries, ready, roomId, setEntry } = useCrdtPuzzle('nyt-2024-01-15', 'my-room');
 *
 * if (!ready) return <div>Loading...</div>;
 *
 * // Set a value - syncs to peers if roomId provided
 * setEntry(3, 7, 'A');
 *
 * // Read values
 * entries.get('3,7'); // 'A'
 *
 * // Clear a value
 * clearEntry(3, 7);
 * ```
 */
export function useCrdtPuzzle(puzzleId: string, roomId?: string): UseCrdtPuzzleReturn {
  // Store reference for access in callbacks and external store
  const storeRef = useRef<PuzzleStore | null>(null);
  const sessionRef = useRef<P2PSession | null>(null);
  const readyRef = useRef(false);
  const snapshotRef = useRef<Map<string, string>>(EMPTY_MAP);
  const connectionStateRef = useRef<ConnectionState>('disconnected');
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
  const getConnectionStateSnapshot = useCallback(() => connectionStateRef.current, []);

  // Use useSyncExternalStore for entries, ready state, and connection state
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReadySnapshot, getReadySnapshot);
  const connectionState = useSyncExternalStore(subscribe, getConnectionStateSnapshot, getConnectionStateSnapshot);

  // Lifecycle management: create/destroy store on puzzleId change
  useEffect(() => {
    // Reset refs for new puzzle (synchronous, no setState in effect body)
    readyRef.current = false;
    snapshotRef.current = EMPTY_MAP;
    // Set initial connection state: 'connecting' if roomId provided, 'disconnected' otherwise
    connectionStateRef.current = roomId ? 'connecting' : 'disconnected';
    notifySubscribers();

    // Track connection state unsubscribe function for cleanup
    let connectionUnsubscribe: (() => void) | null = null;

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

    // Wait for IndexedDB sync, then set up observer and optionally P2P
    store.ready.then(async () => {
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

      // Create P2P session if roomId is provided (AFTER IndexedDB ready)
      if (roomId) {
        const session = await createP2PSession(store, roomId);
        // Check again that store is still current after async operation
        if (storeRef.current === store) {
          sessionRef.current = session;
          // Subscribe to connection state changes
          connectionUnsubscribe = session.onConnectionChange((state) => {
            connectionStateRef.current = state;
            notifySubscribers();
          });
        } else {
          // Store changed while we were creating session, clean up
          session.destroy();
        }
      }

      // Mark as ready
      readyRef.current = true;
      notifySubscribers();
    });

    // Cleanup on unmount or puzzleId/roomId change
    return () => {
      // Unsubscribe from connection state changes
      if (connectionUnsubscribe) {
        connectionUnsubscribe();
        connectionUnsubscribe = null;
      }
      // Destroy P2P session first (before store)
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
      // Only unobserve if observer was attached
      if (observerAttached) {
        store.entries.unobserve(observer);
      }
      store.destroy();
      storeRef.current = null;
    };
  }, [puzzleId, roomId, notifySubscribers]);

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

  // Get awareness from session (null when not in P2P mode)
  const awareness = sessionRef.current?.awareness ?? null;

  return {
    entries,
    ready,
    setEntry,
    clearEntry,
    getEntry,
    roomId,
    connectionState,
    awareness,
  };
}
