/**
 * React hook for tracking collaborators via Yjs Awareness.
 *
 * Uses useSyncExternalStore pattern to properly sync Yjs Awareness
 * state with React. Returns an array of collaborators (excluding
 * the local user) with their user info and cursor positions.
 *
 * Also shows toast notifications when collaborators join or leave.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { Awareness } from 'y-protocols/awareness';
import type { Collaborator, CollaboratorState } from './types';

/**
 * Empty collaborators array for when awareness is null.
 */
const EMPTY_COLLABORATORS: Collaborator[] = [];

/**
 * Hook for tracking collaborator presence via Yjs Awareness.
 *
 * Subscribes to awareness 'change' events and returns an array of
 * collaborators with their current state. Filters out the local
 * client automatically.
 *
 * @param awareness - Yjs Awareness instance or null if not in P2P mode
 * @returns Array of collaborators (excludes local user)
 *
 * @example
 * ```typescript
 * const collaborators = useCollaborators(awareness);
 *
 * // Display each collaborator
 * collaborators.forEach(({ clientId, user, cursor }) => {
 *   console.log(`${user.name} (${user.color}) at ${cursor?.row},${cursor?.col}`);
 * });
 * ```
 */
export function useCollaborators(awareness: Awareness | null): Collaborator[] {
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

    return collaborators;
  }, [awareness]);

  // Server snapshot for SSR (same as client since awareness is client-only)
  const getServerSnapshot = useCallback(() => EMPTY_COLLABORATORS, []);

  const collaborators = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Track if initial load is complete to avoid showing toasts for existing users
  const isInitialLoadRef = useRef(true);

  // Show toast notifications for join/leave events
  useEffect(() => {
    if (!awareness) return;

    const handleChange = ({ added, removed }: { added: number[]; removed: number[] }) => {
      // Skip toasts on initial load
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
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
            toast(`${name} joined`, { icon: '👋', duration: 3000 });
          }
        }
      }

      // Handle leaves
      if (removed.length > 0) {
        for (const clientId of removed) {
          // Skip self
          if (clientId === awareness.clientID) continue;

          toast('Someone left', { duration: 2000 });
        }
      }
    };

    awareness.on('change', handleChange);
    return () => awareness.off('change', handleChange);
  }, [awareness]);

  return collaborators;
}
