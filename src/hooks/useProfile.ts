/**
 * React hook for managing user profile state.
 *
 * Provides reactive access to nickname and avatar, with methods
 * to update them. Uses useSyncExternalStore for proper React integration.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  getNickname,
  saveNickname,
  getAvatar,
  saveAvatar,
  clearAvatar,
  subscribeToProfile,
  generateCrosswordNickname,
  MAX_NICKNAME_LENGTH,
} from '../lib/profileStorage';

/**
 * Profile state returned by the hook.
 */
export interface ProfileState {
  nickname: string;
  avatar: string | null;
  isLoading: boolean;
}

// Cached nickname for synchronous access
let cachedNickname: string = getNickname();

// Snapshot getter for useSyncExternalStore
function getNicknameSnapshot(): string {
  return cachedNickname;
}

// Subscribe to profile changes
function subscribeToNickname(callback: () => void): () => void {
  const unsubscribe = subscribeToProfile(() => {
    // Update cached value when storage changes
    cachedNickname = getNickname();
    callback();
  });
  return unsubscribe;
}

/**
 * Hook for managing user profile state.
 *
 * Returns reactive nickname and avatar state, plus methods to update them.
 * Avatar is loaded asynchronously on first access.
 */
export function useProfile() {
  // Nickname is synchronous via useSyncExternalStore
  const nickname = useSyncExternalStore(
    subscribeToNickname,
    getNicknameSnapshot,
    getNicknameSnapshot
  );

  // Avatar is async, managed via useState
  const [avatar, setAvatarState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load avatar on mount
  useEffect(() => {
    let mounted = true;

    async function loadAvatar() {
      try {
        const storedAvatar = await getAvatar();
        if (mounted) {
          setAvatarState(storedAvatar);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadAvatar();

    // Subscribe to avatar changes
    const unsubscribe = subscribeToProfile(() => {
      getAvatar().then((newAvatar) => {
        if (mounted) {
          setAvatarState(newAvatar);
        }
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Update nickname
  const setNickname = useCallback((newNickname: string) => {
    saveNickname(newNickname);
    cachedNickname = getNickname(); // Update cache
  }, []);

  // Update avatar
  const setAvatar = useCallback(async (dataUrl: string) => {
    await saveAvatar(dataUrl);
    setAvatarState(dataUrl);
  }, []);

  // Remove avatar
  const removeAvatar = useCallback(async () => {
    await clearAvatar();
    setAvatarState(null);
  }, []);

  // Generate new random nickname
  const randomizeNickname = useCallback(() => {
    const newNickname = generateCrosswordNickname();
    saveNickname(newNickname);
    cachedNickname = newNickname;
  }, []);

  return {
    profile: {
      nickname,
      avatar,
      isLoading,
    } as ProfileState,
    setNickname,
    setAvatar,
    removeAvatar,
    randomizeNickname,
    maxNicknameLength: MAX_NICKNAME_LENGTH,
  };
}
