/**
 * Hook for tracking puzzle play time with P2P sync.
 *
 * Tracks active play time (pauses when tab hidden) and syncs
 * to CRDT using per-client durations with max-wins semantics.
 */

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { getDurationsMap, type DurationsMap } from '../crdt/puzzleDoc';
import { getStableClientId } from '../lib/clientId';

interface UsePlayTimeOptions {
  /** The Y.Doc to sync durations to (null when not ready) */
  doc: Y.Doc | null;
  /** Whether tracking is enabled (false when puzzle not loaded) */
  enabled: boolean;
}

interface UsePlayTimeReturn {
  /** Maximum duration across all clients in milliseconds */
  totalDurationMs: number;
  /** Formatted duration string (e.g., "5:23" or "1:05:30") */
  formattedDuration: string;
}

// Debounce interval for syncing to CRDT (prevents excessive updates)
const SYNC_INTERVAL_MS = 1000;

/**
 * Formats milliseconds as a human-readable duration.
 * Format: "M:SS" for under an hour, "H:MM:SS" for an hour or more.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Hook for tracking and syncing puzzle play time.
 *
 * Features:
 * - Tracks time only when page is visible
 * - Syncs local duration to CRDT every second
 * - Computes max duration across all peers
 * - Persists via Yjs (IndexedDB + P2P sync)
 *
 * @example
 * ```typescript
 * const { totalDurationMs, formattedDuration } = usePlayTime({
 *   doc: crdtDoc,
 *   enabled: ready && puzzle !== null,
 * });
 *
 * // In success dialog:
 * <p>Completed in {formattedDuration}</p>
 * ```
 */
export function usePlayTime({
  doc,
  enabled,
}: UsePlayTimeOptions): UsePlayTimeReturn {
  // Get stable client ID for this device
  const clientId = useRef(getStableClientId()).current;

  // Refs for tracking time
  const durationsMapRef = useRef<DurationsMap | null>(null);
  const localDurationRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(document.visibilityState === 'visible');
  const subscribersRef = useRef(new Set<() => void>());
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Snapshot for useSyncExternalStore
  const snapshotRef = useRef<number>(0);

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Notify all subscribers
  const notifySubscribers = useCallback(() => {
    subscribersRef.current.forEach((cb) => cb());
  }, []);

  // Compute max duration from all clients
  const computeMaxDuration = useCallback((): number => {
    const durationsMap = durationsMapRef.current;
    if (!durationsMap) return localDurationRef.current;

    let maxDuration = 0;
    durationsMap.forEach((duration) => {
      if (duration > maxDuration) {
        maxDuration = duration;
      }
    });

    // Include local duration in max calculation
    return Math.max(maxDuration, localDurationRef.current);
  }, []);

  // Get snapshot for useSyncExternalStore
  const getSnapshot = useCallback(() => snapshotRef.current, []);

  // Use useSyncExternalStore for React updates
  const totalDurationMs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Initialize durations map and load existing duration
  // This runs even when tracking is disabled (puzzle complete) so we can display final time
  useEffect(() => {
    if (!doc) {
      durationsMapRef.current = null;
      return;
    }

    const durationsMap = getDurationsMap(doc);
    durationsMapRef.current = durationsMap;

    // Load existing duration for this client
    const existingDuration = durationsMap.get(clientId) ?? 0;
    localDurationRef.current = existingDuration;
    snapshotRef.current = computeMaxDuration();
    notifySubscribers();

    // Observe changes from other clients
    const observer = () => {
      snapshotRef.current = computeMaxDuration();
      notifySubscribers();
    };
    durationsMap.observe(observer);

    return () => {
      durationsMap.unobserve(observer);
    };
  }, [doc, clientId, computeMaxDuration, notifySubscribers]);

  // Track time and sync to CRDT
  useEffect(() => {
    if (!doc || !enabled) {
      // Clear any existing interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Initialize last tick time
    lastTickRef.current = Date.now();

    // Visibility change handler
    const handleVisibilityChange = () => {
      const wasVisible = isVisibleRef.current;
      const isNowVisible = document.visibilityState === 'visible';
      isVisibleRef.current = isNowVisible;

      if (!wasVisible && isNowVisible) {
        // Resuming - reset last tick to now to avoid counting hidden time
        lastTickRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Interval to tick and sync
    syncIntervalRef.current = setInterval(() => {
      // Only count time if visible
      if (!isVisibleRef.current) return;

      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      // Update local duration
      localDurationRef.current += elapsed;

      // Sync to CRDT
      const durationsMap = durationsMapRef.current;
      if (durationsMap) {
        durationsMap.set(clientId, localDurationRef.current);
      }

      // Update snapshot and notify
      snapshotRef.current = computeMaxDuration();
      notifySubscribers();
    }, SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [doc, enabled, clientId, computeMaxDuration, notifySubscribers]);

  return {
    totalDurationMs,
    formattedDuration: formatDuration(totalDurationMs),
  };
}
