/**
 * React hook for getting the local user's info from Yjs Awareness.
 *
 * Returns the local user's name and a consistent color for the local user.
 * The local user always sees themselves with the same fixed color (indigo)
 * for familiarity, regardless of what color they broadcast to others.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { UserInfo } from './types';
import { LOCAL_USER_COLOR } from './colors';

/**
 * Default user info when awareness is not available.
 */
const DEFAULT_USER: UserInfo = {
  name: 'You',
  color: LOCAL_USER_COLOR,
};

/**
 * Hook for getting the local user's info from Yjs Awareness.
 *
 * @param awareness - Yjs Awareness instance or null if not in P2P mode
 * @returns Local user's info (name and color), or null if in P2P mode but profile not loaded yet
 */
export function useLocalUser(awareness: Awareness | null): UserInfo | null {
  // Cache the result to avoid infinite loops in useSyncExternalStore
  const cachedResult = useRef<UserInfo | null>(null);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!awareness) return () => {};
      awareness.on('change', callback);
      return () => awareness.off('change', callback);
    },
    [awareness]
  );

  const getSnapshot = useCallback((): UserInfo | null => {
    // No P2P mode - return default user (no profile to load)
    if (!awareness) return DEFAULT_USER;

    const localState = awareness.getLocalState() as { user?: UserInfo } | null;
    if (localState?.user?.name) {
      // Only create a new object if name or avatar changed
      if (
        cachedResult.current?.name !== localState.user.name ||
        cachedResult.current?.avatar !== localState.user.avatar
      ) {
        cachedResult.current = {
          name: localState.user.name,
          color: LOCAL_USER_COLOR,
          avatar: localState.user.avatar,
        };
      }
      return cachedResult.current;
    }

    // P2P mode but profile not loaded yet - return null to indicate loading
    return null;
  }, [awareness]);

  const getServerSnapshot = useCallback(() => DEFAULT_USER, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
