/**
 * React hook for getting the local user's info from Yjs Awareness.
 *
 * Returns the local user's name and color for consistent styling
 * between what the user sees and what collaborators see.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { UserInfo } from './types';

/**
 * Default user info when awareness is not available.
 */
const DEFAULT_USER: UserInfo = {
  name: 'You',
  color: '#6366f1', // Indigo - fallback color
};

/**
 * Hook for getting the local user's info from Yjs Awareness.
 *
 * @param awareness - Yjs Awareness instance or null if not in P2P mode
 * @returns Local user's info (name and color)
 */
export function useLocalUser(awareness: Awareness | null): UserInfo {
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
    if (localState?.user?.name && localState?.user?.color) {
      return localState.user;
    }

    return DEFAULT_USER;
  }, [awareness]);

  const getServerSnapshot = useCallback(() => DEFAULT_USER, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
