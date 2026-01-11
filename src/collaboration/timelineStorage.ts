/**
 * Timeline storage utilities for managing puzzle timeline mappings
 *
 * Storage model:
 * - IndexedDB: Puzzle entries stored via y-indexeddb with key `puzzle-${puzzleId}`
 * - localStorage: timeline:${puzzleId} -> current timelineId
 *
 * Timeline IDs track which collaborative session a user is on for a given puzzle.
 * When sharing, a new timelineId is generated and stored.
 * When joining via link, the shared timelineId may need to merge or replace local progress.
 */

const TIMELINE_STORAGE_PREFIX = 'timeline:';
const Y_INDEXEDDB_PREFIX = 'puzzle-';
// Note: y-indexeddb uses just the storage key as the database name, no suffix

/**
 * Gets the localStorage key for a puzzle's timeline mapping.
 */
function getTimelineStorageKey(puzzleId: string): string {
  return `${TIMELINE_STORAGE_PREFIX}${puzzleId}`;
}

/**
 * Gets the current timeline ID for a puzzle from localStorage.
 *
 * @param puzzleId - The puzzle identifier
 * @returns The current timeline ID, or null if not set
 *
 * @example
 * ```typescript
 * const timelineId = getCurrentTimeline('nyt-daily-2024-01-15');
 * if (timelineId) {
 *   console.log('User is on timeline:', timelineId);
 * }
 * ```
 */
export function getCurrentTimeline(puzzleId: string): string | null {
  const key = getTimelineStorageKey(puzzleId);
  return localStorage.getItem(key);
}

/**
 * Saves the current timeline mapping for a puzzle.
 *
 * @param puzzleId - The puzzle identifier
 * @param timelineId - The timeline ID to store
 *
 * @example
 * ```typescript
 * // User starts sharing
 * const timelineId = generateTimelineId();
 * await saveTimelineMapping('nyt-daily-2024-01-15', timelineId);
 * ```
 */
export async function saveTimelineMapping(
  puzzleId: string,
  timelineId: string
): Promise<void> {
  const key = getTimelineStorageKey(puzzleId);
  localStorage.setItem(key, timelineId);
  console.debug(
    `[timelineStorage] Saved timeline mapping: ${puzzleId} -> ${timelineId}`
  );
}

/**
 * Clears the timeline mapping for a puzzle.
 *
 * @param puzzleId - The puzzle identifier
 */
export function clearTimelineMapping(puzzleId: string): void {
  const key = getTimelineStorageKey(puzzleId);
  localStorage.removeItem(key);
  console.debug(`[timelineStorage] Cleared timeline mapping for: ${puzzleId}`);
}

/**
 * Opens an IndexedDB database and returns a promise.
 */
function openIndexedDB(dbName: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName);

    request.onerror = () => {
      console.debug(`[timelineStorage] Failed to open database: ${dbName}`);
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * Checks if there is local progress (entries) for a puzzle in IndexedDB.
 *
 * Uses the y-indexeddb storage pattern to check if any data exists.
 * The y-indexeddb library stores Yjs document updates in IndexedDB.
 *
 * @param puzzleId - The puzzle identifier
 * @returns true if local progress exists, false otherwise
 *
 * @example
 * ```typescript
 * if (await hasLocalProgress('nyt-daily-2024-01-15')) {
 *   // Show merge dialog
 * }
 * ```
 */
export async function hasLocalProgress(puzzleId: string): Promise<boolean> {
  try {
    // y-indexeddb creates databases using the storage key directly
    const dbName = `${Y_INDEXEDDB_PREFIX}${puzzleId}`;

    // Check if the database exists by trying to open it
    // Note: indexedDB.databases() is not available in all browsers
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      const dbExists = databases.some((db) => db.name === dbName);

      if (!dbExists) {
        console.debug(
          `[timelineStorage] No IndexedDB database found for puzzle: ${puzzleId}`
        );
        return false;
      }
    }

    // Try to open the database
    const db = await openIndexedDB(dbName);
    if (!db) {
      return false;
    }

    // Check if 'updates' store exists (y-indexeddb stores updates there)
    if (!db.objectStoreNames.contains('updates')) {
      db.close();
      return false;
    }

    // Count entries in the updates store
    return new Promise((resolve) => {
      const transaction = db.transaction('updates', 'readonly');
      const store = transaction.objectStore('updates');
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        db.close();
        console.debug(
          `[timelineStorage] Puzzle ${puzzleId} has ${count} update(s) in IndexedDB`
        );
        resolve(count > 0);
      };

      countRequest.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch (error) {
    // If any error occurs, assume no progress
    console.debug(
      '[timelineStorage] Error checking for local progress:',
      error
    );
    return false;
  }
}

/**
 * Gets the local timeline ID for a puzzle, or null if none exists.
 *
 * This is a convenience function that wraps getCurrentTimeline
 * with async signature for consistency with other timeline functions.
 *
 * @param puzzleId - The puzzle identifier
 * @returns The timeline ID if progress exists, null otherwise
 */
export async function getLocalTimelineForPuzzle(
  puzzleId: string
): Promise<string | null> {
  return getCurrentTimeline(puzzleId);
}

/**
 * Gets the count of entries in the local puzzle store.
 * Used to show "You have X letters filled in locally" in the JoinDialog.
 *
 * Note: Getting an exact count requires decoding Yjs updates, which is expensive.
 * Returns -1 to indicate "some entries exist" when progress is detected.
 *
 * @param puzzleId - The puzzle identifier
 * @returns The number of entries, 0 if none, or -1 if count is unknown but progress exists
 */
export async function getLocalEntryCount(puzzleId: string): Promise<number> {
  try {
    const hasProgress = await hasLocalProgress(puzzleId);
    return hasProgress ? -1 : 0; // -1 indicates "some entries, count unknown"
  } catch (error) {
    console.debug('[timelineStorage] Error getting entry count:', error);
    return 0;
  }
}
