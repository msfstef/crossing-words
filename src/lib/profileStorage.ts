/**
 * Profile storage module for persisting user profile data.
 *
 * Stores nickname in localStorage (instant access) and avatar in IndexedDB
 * (better for binary data). Provides crossword-themed nickname generation.
 */

const NICKNAME_KEY = 'crossing-words-nickname';
const NICKNAME_MAX_LENGTH = 20;
const AVATAR_DB_NAME = 'crossing-words-profile';
const AVATAR_DB_VERSION = 1;
const AVATAR_STORE_NAME = 'avatar';
const AVATAR_KEY = 'user-avatar';
const AVATAR_THUMBNAIL_KEY = 'user-avatar-thumbnail';

/**
 * User profile data structure.
 */
export interface UserProfile {
  nickname: string;
  /** High-quality avatar for profile dialog (192x192) */
  avatar: string | null;
  /** Compact thumbnail for collaborator icons and P2P (64x64) */
  avatarThumbnail: string | null;
}

/**
 * Crossword-themed adjectives for nickname generation.
 */
const CROSSWORD_ADJECTIVES = [
  'Across',
  'Down',
  'Clued',
  'Filled',
  'Boxed',
  'Squared',
  'Gridded',
  'Lettered',
  'Numbered',
  'Themed',
  'Cryptic',
  'Daily',
  'Sunday',
  'Mini',
  'Mega',
  'Speedy',
  'Tricky',
  'Clever',
  'Crafty',
  'Puzzled',
];

/**
 * Crossword-themed nouns for nickname generation.
 */
const CROSSWORD_NOUNS = [
  'Solver',
  'Writer',
  'Constructor',
  'Cruciverbalist',
  'Puzzler',
  'Penciler',
  'Eraser',
  'Grid',
  'Entry',
  'Clue',
  'Answer',
  'Letter',
  'Square',
  'Block',
  'Checker',
  'Acrostic',
  'Rebus',
  'Theme',
  'Fill',
  'Cross',
];

/**
 * Generates a random crossword-themed nickname.
 * Format: "Adjective Noun" (e.g., "Cryptic Solver", "Sunday Puzzler")
 */
export function generateCrosswordNickname(): string {
  const adjective =
    CROSSWORD_ADJECTIVES[Math.floor(Math.random() * CROSSWORD_ADJECTIVES.length)];
  const noun = CROSSWORD_NOUNS[Math.floor(Math.random() * CROSSWORD_NOUNS.length)];
  return `${adjective} ${noun}`;
}

/**
 * Opens the avatar IndexedDB database.
 */
function openAvatarDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AVATAR_DB_NAME, AVATAR_DB_VERSION);

    request.onerror = () => {
      console.error('[profileStorage] Failed to open avatar database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        db.createObjectStore(AVATAR_STORE_NAME);
        console.debug('[profileStorage] Created avatar object store');
      }
    };
  });
}

/**
 * Gets the stored nickname, or generates a new one if none exists.
 */
export function getNickname(): string {
  if (typeof window === 'undefined') {
    return generateCrosswordNickname();
  }

  const stored = localStorage.getItem(NICKNAME_KEY);
  if (stored) {
    return stored;
  }

  // Generate and store a new nickname
  const nickname = generateCrosswordNickname();
  localStorage.setItem(NICKNAME_KEY, nickname);
  return nickname;
}

/**
 * Saves a nickname to localStorage.
 * Enforces the character limit.
 */
export function saveNickname(nickname: string): void {
  const trimmed = nickname.trim().slice(0, NICKNAME_MAX_LENGTH);
  localStorage.setItem(NICKNAME_KEY, trimmed);
  console.debug('[profileStorage] Saved nickname:', trimmed);
  notifyProfileListeners();
}

/**
 * Gets the stored avatar from IndexedDB.
 * Returns null if no avatar is stored.
 */
export async function getAvatar(): Promise<string | null> {
  try {
    const db = await openAvatarDatabase();
    const transaction = db.transaction(AVATAR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(AVATAR_KEY);

      request.onerror = () => {
        console.error('[profileStorage] Failed to get avatar:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const avatar = request.result as string | undefined;
        resolve(avatar ?? null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[profileStorage] Error getting avatar:', error);
    return null;
  }
}

/**
 * Gets the stored avatar thumbnail from IndexedDB.
 * Returns null if no thumbnail is stored.
 */
export async function getAvatarThumbnail(): Promise<string | null> {
  try {
    const db = await openAvatarDatabase();
    const transaction = db.transaction(AVATAR_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(AVATAR_THUMBNAIL_KEY);

      request.onerror = () => {
        console.error('[profileStorage] Failed to get avatar thumbnail:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const thumbnail = request.result as string | undefined;
        resolve(thumbnail ?? null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[profileStorage] Error getting avatar thumbnail:', error);
    return null;
  }
}

/**
 * Saves both profile avatar and thumbnail to IndexedDB.
 * @param profile - High-quality avatar for profile dialog (192x192)
 * @param thumbnail - Compact thumbnail for icons and P2P (64x64)
 */
export async function saveAvatars(profile: string, thumbnail: string): Promise<void> {
  try {
    const db = await openAvatarDatabase();
    const transaction = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const profileRequest = store.put(profile, AVATAR_KEY);
      const thumbnailRequest = store.put(thumbnail, AVATAR_THUMBNAIL_KEY);

      profileRequest.onerror = () => {
        console.error('[profileStorage] Failed to save profile avatar:', profileRequest.error);
        reject(profileRequest.error);
      };

      thumbnailRequest.onerror = () => {
        console.error('[profileStorage] Failed to save avatar thumbnail:', thumbnailRequest.error);
        reject(thumbnailRequest.error);
      };

      transaction.oncomplete = () => {
        console.debug('[profileStorage] Saved both avatar sizes');
        db.close();
        notifyProfileListeners();
        resolve();
      };

      transaction.onerror = () => {
        console.error('[profileStorage] Transaction error saving avatars:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[profileStorage] Error saving avatars:', error);
    throw error;
  }
}

/**
 * @deprecated Use saveAvatars() to save both profile and thumbnail versions.
 * Saves an avatar to IndexedDB.
 * Avatar should be a base64 data URL (already resized/compressed).
 */
export async function saveAvatar(dataUrl: string): Promise<void> {
  try {
    const db = await openAvatarDatabase();
    const transaction = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.put(dataUrl, AVATAR_KEY);

      request.onerror = () => {
        console.error('[profileStorage] Failed to save avatar:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.debug('[profileStorage] Saved avatar');
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
        notifyProfileListeners();
      };
    });
  } catch (error) {
    console.error('[profileStorage] Error saving avatar:', error);
    throw error;
  }
}

/**
 * Clears both stored avatars (profile and thumbnail) from IndexedDB.
 */
export async function clearAvatar(): Promise<void> {
  try {
    const db = await openAvatarDatabase();
    const transaction = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AVATAR_STORE_NAME);

    return new Promise((resolve, reject) => {
      const profileRequest = store.delete(AVATAR_KEY);
      const thumbnailRequest = store.delete(AVATAR_THUMBNAIL_KEY);

      profileRequest.onerror = () => {
        console.error('[profileStorage] Failed to clear profile avatar:', profileRequest.error);
        reject(profileRequest.error);
      };

      thumbnailRequest.onerror = () => {
        console.error('[profileStorage] Failed to clear avatar thumbnail:', thumbnailRequest.error);
        reject(thumbnailRequest.error);
      };

      transaction.oncomplete = () => {
        console.debug('[profileStorage] Cleared both avatar sizes');
        db.close();
        notifyProfileListeners();
        resolve();
      };

      transaction.onerror = () => {
        console.error('[profileStorage] Transaction error clearing avatars:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[profileStorage] Error clearing avatar:', error);
    throw error;
  }
}

/**
 * Gets the full user profile (nickname + both avatar sizes).
 */
export async function getProfile(): Promise<UserProfile> {
  const nickname = getNickname();
  const [avatar, avatarThumbnail] = await Promise.all([
    getAvatar(),
    getAvatarThumbnail(),
  ]);
  return { nickname, avatar, avatarThumbnail };
}

// Profile change listeners for useSyncExternalStore
const profileListeners: Set<() => void> = new Set();

/**
 * Subscribe to profile changes.
 */
export function subscribeToProfile(callback: () => void): () => void {
  profileListeners.add(callback);
  return () => profileListeners.delete(callback);
}

/**
 * Notify all profile listeners of a change.
 */
function notifyProfileListeners(): void {
  profileListeners.forEach((listener) => listener());
}

/**
 * Maximum nickname length.
 */
export const MAX_NICKNAME_LENGTH = NICKNAME_MAX_LENGTH;
