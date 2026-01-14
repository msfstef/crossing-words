/* eslint-disable react-hooks/refs -- This hook intentionally updates refs during render for callback synchronization */
/**
 * React hook for CRDT-backed puzzle state
 *
 * Bridges Yjs to React by:
 * - Creating/destroying PuzzleStore instances on puzzleId change
 * - Syncing Y.Map changes to React state via observers
 * - Exposing entry manipulation methods
 * - Optional P2P sync via WebRTC when roomId is provided
 * - Syncing puzzle metadata to/from CRDT for sharing
 */

import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { createPuzzleStore, PuzzleStore } from '../crdt/puzzleStore';
import { createP2PSession, type P2PSession, type ConnectionState } from '../crdt/webrtcProvider';
import {
  setPuzzleInCrdt,
  getPuzzleFromCrdt,
  observePuzzleInCrdt,
  type PuzzleMetadata,
  type PuzzleWithMetadata,
} from '../collaboration/puzzleSync';
import { getVerifiedMap, getErrorsMap, getSettingsMap, type VerifiedMap, type ErrorsMap, type SettingsMap } from '../crdt/puzzleDoc';
import type { Puzzle } from '../types/puzzle';

interface UseCrdtPuzzleOptions {
  /** Puzzle to store in CRDT for sharing (sharer provides this) */
  puzzle?: Puzzle | null;
  /** Metadata (source, date) for the puzzle being shared */
  metadata?: PuzzleMetadata;
  /** Callback when puzzle is received from CRDT (recipient receives via this) */
  onPuzzleReceived?: (result: PuzzleWithMetadata) => void;
}

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
  /** Set of verified cell keys ("row,col") */
  verifiedCells: Set<string>;
  /** Set of error cell keys ("row,col") */
  errorCells: Set<string>;
  /** Raw verified map for useVerification hook */
  verifiedMap: VerifiedMap | null;
  /** Raw errors map for useVerification hook */
  errorsMap: ErrorsMap | null;
  /** Raw Y.Doc for useVerification hook */
  doc: Y.Doc | null;
  /** Raw entries Y.Map for useVerification hook */
  entriesMap: Y.Map<string> | null;
  /** Whether auto-check mode is enabled (synced via CRDT) */
  autoCheckEnabled: boolean;
  /** Toggle auto-check mode (synced via CRDT) */
  setAutoCheck: (enabled: boolean) => void;
  /** Clear all entries from the puzzle */
  clearAllEntries: () => void;
}

// Empty map constant for initial state
const EMPTY_MAP = new Map<string, string>();

// Empty set constant for initial verification state
const EMPTY_SET = new Set<string>();

/**
 * Hook for managing CRDT-backed puzzle entries with optional P2P sync.
 *
 * Creates a new PuzzleStore for each puzzleId, waits for IndexedDB to sync,
 * then mirrors Y.Map changes to React state via observers.
 *
 * When roomId is provided, creates a P2P session for collaborative solving.
 * The P2P session is created AFTER IndexedDB loads to prevent empty state sync.
 *
 * Puzzle sync: When options.puzzle is provided, it's stored in the CRDT for
 * sharing with peers. When options.onPuzzleReceived is provided, the hook
 * calls it when puzzle data is received from a peer (for recipients who
 * don't have the puzzle locally).
 *
 * @param puzzleId - Unique identifier for the puzzle
 * @param roomId - Optional room ID for P2P collaboration
 * @param options - Optional puzzle sync options
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
 * // With puzzle sharing (for sharer)
 * const { entries } = useCrdtPuzzle('nyt-2024-01-15', 'my-room', { puzzle: myPuzzle });
 *
 * // With puzzle receiving (for recipient without puzzle)
 * const { entries } = useCrdtPuzzle('nyt-2024-01-15', 'my-room', {
 *   onPuzzleReceived: (puzzle) => setPuzzle(puzzle)
 * });
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
export function useCrdtPuzzle(
  puzzleId: string,
  roomId?: string,
  options?: UseCrdtPuzzleOptions
): UseCrdtPuzzleReturn {
  const { puzzle, metadata, onPuzzleReceived } = options ?? {};

  // Store reference for access in callbacks and external store
  const storeRef = useRef<PuzzleStore | null>(null);
  const sessionRef = useRef<P2PSession | null>(null);
  const readyRef = useRef(false);
  const snapshotRef = useRef<Map<string, string>>(EMPTY_MAP);
  const connectionStateRef = useRef<ConnectionState>('disconnected');
  const awarenessRef = useRef<Awareness | null>(null);
  const subscribersRef = useRef(new Set<() => void>());

  // Verification state refs
  const verifiedSnapshotRef = useRef<Set<string>>(EMPTY_SET);
  const errorsSnapshotRef = useRef<Set<string>>(EMPTY_SET);
  const verifiedMapRef = useRef<VerifiedMap | null>(null);
  const errorsMapRef = useRef<ErrorsMap | null>(null);

  // Settings state refs
  const settingsMapRef = useRef<SettingsMap | null>(null);
  const autoCheckRef = useRef<boolean>(false);

  // Use refs for puzzle sync to avoid triggering effect re-runs
  const puzzleRef = useRef(puzzle);
  const metadataRef = useRef(metadata);
  const onPuzzleReceivedRef = useRef(onPuzzleReceived);
  // Track if we've already called onPuzzleReceived to avoid duplicate calls
  const puzzleReceivedCalledRef = useRef(false);

  // Keep refs updated
  puzzleRef.current = puzzle;
  metadataRef.current = metadata;
  onPuzzleReceivedRef.current = onPuzzleReceived;

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
  const getAwarenessSnapshot = useCallback(() => awarenessRef.current, []);
  const getVerifiedSnapshot = useCallback(() => verifiedSnapshotRef.current, []);
  const getErrorsSnapshot = useCallback(() => errorsSnapshotRef.current, []);
  const getVerifiedMapSnapshot = useCallback(() => verifiedMapRef.current, []);
  const getErrorsMapSnapshot = useCallback(() => errorsMapRef.current, []);
  const getDocSnapshot = useCallback(() => storeRef.current?.doc ?? null, []);
  const getEntriesMapSnapshot = useCallback(() => storeRef.current?.entries ?? null, []);
  const getAutoCheckSnapshot = useCallback(() => autoCheckRef.current, []);

  // Use useSyncExternalStore for entries, ready state, connection state, and awareness
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReadySnapshot, getReadySnapshot);
  const connectionState = useSyncExternalStore(subscribe, getConnectionStateSnapshot, getConnectionStateSnapshot);
  const awareness = useSyncExternalStore(subscribe, getAwarenessSnapshot, getAwarenessSnapshot);
  const verifiedCells = useSyncExternalStore(subscribe, getVerifiedSnapshot, getVerifiedSnapshot);
  const errorCells = useSyncExternalStore(subscribe, getErrorsSnapshot, getErrorsSnapshot);
  const verifiedMap = useSyncExternalStore(subscribe, getVerifiedMapSnapshot, getVerifiedMapSnapshot);
  const errorsMap = useSyncExternalStore(subscribe, getErrorsMapSnapshot, getErrorsMapSnapshot);
  const doc = useSyncExternalStore(subscribe, getDocSnapshot, getDocSnapshot);
  const entriesMap = useSyncExternalStore(subscribe, getEntriesMapSnapshot, getEntriesMapSnapshot);
  const autoCheckEnabled = useSyncExternalStore(subscribe, getAutoCheckSnapshot, getAutoCheckSnapshot);

  // Lifecycle management: create/destroy store on puzzleId/roomId change
  // NOTE: puzzle and onPuzzleReceived are accessed via refs to avoid re-running
  // this effect when puzzle state changes (which would destroy the P2P session)
  useEffect(() => {
    // Reset refs for new puzzle (synchronous, no setState in effect body)
    readyRef.current = false;
    snapshotRef.current = EMPTY_MAP;
    // Set initial connection state: 'connecting' if roomId provided, 'disconnected' otherwise
    connectionStateRef.current = roomId ? 'connecting' : 'disconnected';
    awarenessRef.current = null;
    // Reset verification state
    verifiedSnapshotRef.current = EMPTY_SET;
    errorsSnapshotRef.current = EMPTY_SET;
    verifiedMapRef.current = null;
    errorsMapRef.current = null;
    // Reset settings state
    settingsMapRef.current = null;
    autoCheckRef.current = false;
    // Reset puzzle received tracking for new session
    puzzleReceivedCalledRef.current = false;
    notifySubscribers();

    // Track connection state unsubscribe function for cleanup
    let connectionUnsubscribe: (() => void) | null = null;
    // Track puzzle sync observer for cleanup
    let puzzleSyncUnsubscribe: (() => void) | null = null;

    // Note: Auto-reconnect on visibility change, network changes, etc. is now handled
    // by the webrtcProvider itself, so no need to duplicate handlers here.

    // Create new store for this puzzle
    const store = createPuzzleStore(puzzleId);
    storeRef.current = store;

    // Track whether observer was attached (for safe cleanup)
    let observerAttached = false;

    // Get verification maps from store doc
    const verifiedMapInstance = getVerifiedMap(store.doc);
    const errorsMapInstance = getErrorsMap(store.doc);
    verifiedMapRef.current = verifiedMapInstance;
    errorsMapRef.current = errorsMapInstance;

    // Get settings map from store doc
    const settingsMapInstance = getSettingsMap(store.doc);
    settingsMapRef.current = settingsMapInstance;

    // Observer to sync Y.Map changes to React state
    const observer = () => {
      // Convert Y.Map to regular Map for React
      snapshotRef.current = new Map(store.entries.entries());
      notifySubscribers();
    };

    // Observer to sync verified map changes to React state
    const verifiedObserver = () => {
      verifiedSnapshotRef.current = new Set(verifiedMapInstance.keys());
      notifySubscribers();
    };

    // Observer to sync errors map changes to React state
    const errorsObserver = () => {
      errorsSnapshotRef.current = new Set(errorsMapInstance.keys());
      notifySubscribers();
    };

    // Observer to sync settings map changes to React state
    const settingsObserver = () => {
      autoCheckRef.current = settingsMapInstance.get('autoCheck') === true;
      notifySubscribers();
    };

    // Observer to clear errors when entry changes
    const entryClearErrorObserver = (event: { changes: { keys: Map<string, unknown> } }) => {
      event.changes.keys.forEach((_change, key) => {
        // When entry changes, clear any error at that position
        if (errorsMapInstance.has(key)) {
          errorsMapInstance.delete(key);
        }
      });
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
      verifiedSnapshotRef.current = new Set(verifiedMapInstance.keys());
      errorsSnapshotRef.current = new Set(errorsMapInstance.keys());
      autoCheckRef.current = settingsMapInstance.get('autoCheck') === true;

      // Set up observer for future changes
      store.entries.observe(observer);
      store.entries.observe(entryClearErrorObserver);
      verifiedMapInstance.observe(verifiedObserver);
      errorsMapInstance.observe(errorsObserver);
      settingsMapInstance.observe(settingsObserver);
      observerAttached = true;

      // Create P2P session if roomId is provided (AFTER IndexedDB ready)
      if (roomId) {
        // If we have a puzzle (via ref), store it in CRDT for sharing to peers
        if (puzzleRef.current) {
          setPuzzleInCrdt(store.doc, puzzleRef.current, metadataRef.current);
        }

        const session = await createP2PSession(store, roomId);
        // Check again that store is still current after async operation
        if (storeRef.current === store) {
          sessionRef.current = session;
          awarenessRef.current = session.awareness;
          // Subscribe to connection state changes
          connectionUnsubscribe = session.onConnectionChange((state) => {
            connectionStateRef.current = state;
            notifySubscribers();
          });

          // Subscribe to puzzle sync for recipients (using ref)
          // Check if puzzle already exists in CRDT (sync may have happened already)
          const existingPuzzle = getPuzzleFromCrdt(store.doc);
          if (existingPuzzle && onPuzzleReceivedRef.current && !puzzleReceivedCalledRef.current) {
            console.debug('[useCrdtPuzzle] Puzzle already in CRDT, notifying recipient');
            puzzleReceivedCalledRef.current = true;
            onPuzzleReceivedRef.current(existingPuzzle);
          }

          // Also subscribe to future changes (in case sync happens after connect)
          puzzleSyncUnsubscribe = observePuzzleInCrdt(store.doc, (syncedPuzzle) => {
            if (syncedPuzzle && onPuzzleReceivedRef.current && !puzzleReceivedCalledRef.current) {
              console.debug('[useCrdtPuzzle] Puzzle received from CRDT sync');
              puzzleReceivedCalledRef.current = true;
              onPuzzleReceivedRef.current(syncedPuzzle);
            }
          });

          notifySubscribers(); // Notify about awareness change
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
      // Unsubscribe from puzzle sync
      if (puzzleSyncUnsubscribe) {
        puzzleSyncUnsubscribe();
        puzzleSyncUnsubscribe = null;
      }
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
      awarenessRef.current = null;
      // Only unobserve if observer was attached
      if (observerAttached) {
        store.entries.unobserve(observer);
        store.entries.unobserve(entryClearErrorObserver);
        verifiedMapInstance.unobserve(verifiedObserver);
        errorsMapInstance.unobserve(errorsObserver);
        settingsMapInstance.unobserve(settingsObserver);
      }
      // Clear verification refs
      verifiedMapRef.current = null;
      errorsMapRef.current = null;
      // Clear settings refs
      settingsMapRef.current = null;
      store.destroy();
      storeRef.current = null;
    };
  }, [puzzleId, roomId, notifySubscribers]);

  // Separate effect to store puzzle in CRDT when it changes
  // This doesn't recreate the session, just updates the CRDT
  useEffect(() => {
    const store = storeRef.current;
    if (store && puzzle && roomId) {
      setPuzzleInCrdt(store.doc, puzzle, metadata);
    }
  }, [puzzle, metadata, roomId]);

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

  const setAutoCheck = useCallback((enabled: boolean) => {
    const settingsMap = settingsMapRef.current;
    if (!settingsMap) return;
    settingsMap.set('autoCheck', enabled);
  }, []);

  const clearAllEntries = useCallback(() => {
    const store = storeRef.current;
    if (!store) return;

    // Clear all entries from the Y.Map
    const keys = Array.from(store.entries.keys());
    store.doc.transact(() => {
      for (const key of keys) {
        store.entries.delete(key);
      }
    });

    // Also clear verified and errors maps
    const verifiedMap = verifiedMapRef.current;
    const errorsMap = errorsMapRef.current;
    if (verifiedMap) {
      const verifiedKeys = Array.from(verifiedMap.keys());
      store.doc.transact(() => {
        for (const key of verifiedKeys) {
          verifiedMap.delete(key);
        }
      });
    }
    if (errorsMap) {
      const errorKeys = Array.from(errorsMap.keys());
      store.doc.transact(() => {
        for (const key of errorKeys) {
          errorsMap.delete(key);
        }
      });
    }
  }, []);

  return {
    entries,
    ready,
    setEntry,
    clearEntry,
    getEntry,
    clearAllEntries,
    roomId,
    connectionState,
    awareness,
    verifiedCells,
    errorCells,
    verifiedMap,
    errorsMap,
    doc,
    entriesMap,
    autoCheckEnabled,
    setAutoCheck,
  };
}
