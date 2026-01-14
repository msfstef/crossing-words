/**
 * React hook for tracking collaborators via Yjs Awareness.
 *
 * Uses useSyncExternalStore pattern to properly sync Yjs Awareness
 * state with React. Returns an array of collaborators (excluding
 * the local user) with their user info and cursor positions.
 *
 * Optionally shows notifications when collaborators join or leave.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { Collaborator, CollaboratorState } from './types';

/** Notification callback type */
export type NotifyFn = (message: string, options?: { icon?: string; duration?: number }) => void;

/**
 * Empty collaborators array for when awareness is null.
 */
const EMPTY_COLLABORATORS: Collaborator[] = [];

interface UseCollaboratorsOptions {
  /** Optional notification callback for join/leave events */
  notify?: NotifyFn;
}

/**
 * Hook for tracking collaborator presence via Yjs Awareness.
 *
 * Subscribes to awareness 'change' events and returns an array of
 * collaborators with their current state. Filters out the local
 * client automatically.
 *
 * @param awareness - Yjs Awareness instance or null if not in P2P mode
 * @param options - Optional configuration including notify callback
 * @returns Array of collaborators (excludes local user)
 *
 * @example
 * ```typescript
 * const collaborators = useCollaborators(awareness, { notify });
 *
 * // Display each collaborator
 * collaborators.forEach(({ clientId, user, cursor }) => {
 *   console.log(`${user.name} (${user.color}) at ${cursor?.row},${cursor?.col}`);
 * });
 * ```
 */
export function useCollaborators(
  awareness: Awareness | null,
  options?: UseCollaboratorsOptions
): Collaborator[] {
  const { notify } = options ?? {};
  // Cache for getSnapshot to avoid infinite loops
  // useSyncExternalStore requires getSnapshot to return the same reference
  // if the underlying data hasn't changed
  const cacheRef = useRef<Collaborator[]>(EMPTY_COLLABORATORS);

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!awareness) return () => {};

      // Use 'change' event (less frequent than 'update', avoids heartbeat spam)
      awareness.on('change', callback);
      return () => awareness.off('change', callback);
    },
    [awareness]
  );

  // Get snapshot function for useSyncExternalStore
  // IMPORTANT: Must return cached value if data unchanged to avoid infinite loop
  const getSnapshot = useCallback((): Collaborator[] => {
    if (!awareness) return EMPTY_COLLABORATORS;

    const states = awareness.getStates();
    const localId = awareness.clientID;

    // Convert Map to array, filtering out local client
    const collaborators: Collaborator[] = [];

    states.forEach((rawState, clientId) => {
      // Skip local client
      if (clientId === localId) return;

      // Cast to our expected type (awareness stores generic objects)
      const state = rawState as CollaboratorState | undefined;

      // Only include clients with valid user state
      if (state?.user?.name && state?.user?.color) {
        collaborators.push({
          clientId,
          user: state.user,
          cursor: state.cursor ?? null,
        });
      }
    });

    // Compare with cached value to avoid returning new array if unchanged
    const cached = cacheRef.current;
    if (
      cached.length === collaborators.length &&
      cached.every(
        (c, i) =>
          c.clientId === collaborators[i].clientId &&
          c.user.name === collaborators[i].user.name &&
          c.user.color === collaborators[i].user.color &&
          c.cursor?.row === collaborators[i].cursor?.row &&
          c.cursor?.col === collaborators[i].cursor?.col &&
          c.cursor?.direction === collaborators[i].cursor?.direction
      )
    ) {
      return cached;
    }

    // Data changed, update cache and return new value
    cacheRef.current = collaborators;
    return collaborators;
  }, [awareness]);

  // Server snapshot for SSR (same as client since awareness is client-only)
  const getServerSnapshot = useCallback(() => EMPTY_COLLABORATORS, []);

  const collaborators = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Track if initial load is complete to avoid showing notifications for existing users
  const isInitialLoadRef = useRef(true);

  // Track collaborator names so we can show them in leave notifications
  // (state is removed from awareness before the 'change' event fires)
  const knownNamesRef = useRef<Map<number, string>>(new Map());

  // Show notifications for join/leave events (if notify callback provided)
  useEffect(() => {
    if (!awareness || !notify) return;

    const handleChange = ({ added, removed }: { added: number[]; removed: number[] }) => {
      // Skip notifications on initial load
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;

        // But still record initial names for future leave notifications
        const states = awareness.getStates();
        states.forEach((rawState, clientId) => {
          if (clientId === awareness.clientID) return;
          const state = rawState as CollaboratorState | undefined;
          if (state?.user?.name) {
            knownNamesRef.current.set(clientId, state.user.name);
          }
        });
        return;
      }

      // Handle joins
      if (added.length > 0) {
        for (const clientId of added) {
          // Skip self
          if (clientId === awareness.clientID) continue;

          const state = awareness.getStates().get(clientId) as CollaboratorState | undefined;
          const name = state?.user?.name;
          if (name) {
            // Remember name for when they leave
            knownNamesRef.current.set(clientId, name);
            notify(`${name} joined`, { icon: '👋', duration: 3000 });
          }
        }
      }

      // Handle leaves
      if (removed.length > 0) {
        for (const clientId of removed) {
          // Skip self
          if (clientId === awareness.clientID) continue;

          // Look up the name we stored when they joined
          const name = knownNamesRef.current.get(clientId);
          knownNamesRef.current.delete(clientId);

          if (name) {
            notify(`${name} left`, { icon: '👋', duration: 2000 });
          } else {
            notify('Someone left', { duration: 2000 });
          }
        }
      }
    };

    awareness.on('change', handleChange);
    return () => awareness.off('change', handleChange);
  }, [awareness, notify]);

  return collaborators;
}
