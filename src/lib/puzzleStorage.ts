/**
 * Puzzle storage module for persisting puzzle data to IndexedDB
 *
 * Stores the currently loaded puzzle so it can be restored on page refresh.
 * Uses a simple key-value store pattern with a single "currentPuzzle" key.
 */

import type { Puzzle } from '../types/puzzle';

const DB_NAME = 'crossing-words-puzzles';
const DB_VERSION = 1;
const STORE_NAME = 'puzzles';
const CURRENT_PUZZLE_KEY = 'currentPuzzle';

/**
 * Opens the IndexedDB database, creating it if necessary.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[puzzleStorage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.debug('[puzzleStorage] Created object store');
      }
    };
  });
}

/**
 * Saves the current puzzle to IndexedDB.
 *
 * @param puzzle - The puzzle to save
 */
export async function saveCurrentPuzzle(puzzle: Puzzle): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.put(puzzle, CURRENT_PUZZLE_KEY);

      request.onerror = () => {
        console.error('[puzzleStorage] Failed to save puzzle:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.debug('[puzzleStorage] Saved puzzle:', puzzle.title);
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error saving puzzle:', error);
    throw error;
  }
}

/**
 * Loads the current puzzle from IndexedDB.
 *
 * @returns The saved puzzle, or null if none exists
 */
export async function loadCurrentPuzzle(): Promise<Puzzle | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(CURRENT_PUZZLE_KEY);

      request.onerror = () => {
        console.error('[puzzleStorage] Failed to load puzzle:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const puzzle = request.result as Puzzle | undefined;
        if (puzzle) {
          console.debug('[puzzleStorage] Loaded puzzle:', puzzle.title);
        } else {
          console.debug('[puzzleStorage] No saved puzzle found');
        }
        resolve(puzzle ?? null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error loading puzzle:', error);
    return null;
  }
}

/**
 * Clears the saved puzzle from IndexedDB.
 */
export async function clearCurrentPuzzle(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(CURRENT_PUZZLE_KEY);

      request.onerror = () => {
        console.error('[puzzleStorage] Failed to clear puzzle:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.debug('[puzzleStorage] Cleared saved puzzle');
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error clearing puzzle:', error);
    throw error;
  }
}
