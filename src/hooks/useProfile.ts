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
  getAvatarThumbnail,
  saveAvatars,
  clearAvatar,
  subscribeToProfile,
  generateCrosswordNickname,
  MAX_NICKNAME_LENGTH,
} from '../lib/profileStorage';
import type { ProcessedAvatarImages } from '../lib/imageUtils';

/**
 * Profile state returned by the hook.
 */
export interface ProfileState {
  nickname: string;
  /** High-quality avatar for profile dialog (192x192) */
  avatar: string | null;
  /** Compact thumbnail for collaborator icons and P2P (64x64) */
  avatarThumbnail: string | null;
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

  // Avatars are async, managed via useState
  const [avatar, setAvatarState] = useState<string | null>(null);
  const [avatarThumbnail, setAvatarThumbnailState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load avatars on mount
  useEffect(() => {
    let mounted = true;

    async function loadAvatars() {
      try {
        const [storedAvatar, storedThumbnail] = await Promise.all([
          getAvatar(),
          getAvatarThumbnail(),
        ]);
        if (mounted) {
          setAvatarState(storedAvatar);
          setAvatarThumbnailState(storedThumbnail);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadAvatars();

    // Subscribe to avatar changes
    const unsubscribe = subscribeToProfile(() => {
      Promise.all([getAvatar(), getAvatarThumbnail()]).then(
        ([newAvatar, newThumbnail]) => {
          if (mounted) {
            setAvatarState(newAvatar);
            setAvatarThumbnailState(newThumbnail);
          }
        }
      );
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

  // Update avatars (both profile and thumbnail)
  const setAvatar = useCallback(async (images: ProcessedAvatarImages) => {
    await saveAvatars(images.profile, images.thumbnail);
    setAvatarState(images.profile);
    setAvatarThumbnailState(images.thumbnail);
  }, []);

  // Remove avatar
  const removeAvatar = useCallback(async () => {
    await clearAvatar();
    setAvatarState(null);
    setAvatarThumbnailState(null);
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
      avatarThumbnail,
      isLoading,
    } as ProfileState,
    setNickname,
    setAvatar,
    removeAvatar,
    randomizeNickname,
    maxNicknameLength: MAX_NICKNAME_LENGTH,
  };
}
