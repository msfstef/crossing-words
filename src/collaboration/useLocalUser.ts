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
 * @returns Local user's info (name and color)
 */
export function useLocalUser(awareness: Awareness | null): UserInfo {
  // Cache the result to avoid infinite loops in useSyncExternalStore
  const cachedResult = useRef<UserInfo>(DEFAULT_USER);

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!awareness) return () => {};
      awareness.on('change', callback);
      return () => awareness.off('change', callback);
    },
    [awareness]
  );

  const getSnapshot = useCallback((): UserInfo => {
    if (!awareness) return DEFAULT_USER;

    const localState = awareness.getLocalState() as { user?: UserInfo } | null;
    if (localState?.user?.name) {
      // Only create a new object if the name changed
      if (cachedResult.current.name !== localState.user.name) {
        cachedResult.current = {
          name: localState.user.name,
          color: LOCAL_USER_COLOR,
        };
      }
      return cachedResult.current;
    }

    return DEFAULT_USER;
  }, [awareness]);

  const getServerSnapshot = useCallback(() => DEFAULT_USER, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
