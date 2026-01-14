/**
 * Puzzle storage module for persisting puzzle data to IndexedDB
 *
 * Stores the currently loaded puzzle so it can be restored on page refresh.
 * Uses a simple key-value store pattern with a single "currentPuzzle" key.
 */

import * as Y from 'yjs';
import type { Puzzle } from '../types/puzzle';

const DB_NAME = 'crossing-words-puzzles';
const DB_VERSION = 2;
const STORE_NAME = 'puzzles';
const META_STORE_NAME = 'puzzles-meta';
const CURRENT_PUZZLE_KEY = 'currentPuzzle';

/**
 * Puzzle metadata for library listing.
 * Stored separately for efficient iteration without loading full puzzle data.
 */
export interface PuzzleEntry {
  id: string;
  title: string;
  author?: string;
  date?: string;
  source?: string;
  savedAt: number;
}

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
        console.debug('[puzzleStorage] Created puzzles object store');
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        const metaStore = db.createObjectStore(META_STORE_NAME, { keyPath: 'id' });
        metaStore.createIndex('savedAt', 'savedAt', { unique: false });
        console.debug('[puzzleStorage] Created puzzles-meta object store');
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

/**
 * Extract source name from puzzle title.
 * Common patterns: "NYT Crossword", "LA Times Daily", etc.
 */
function extractSource(title: string): string | undefined {
  const patterns = [
    /^(NYT|New York Times)/i,
    /^(LA Times|Los Angeles Times)/i,
    /^(Washington Post|WaPo)/i,
    /^(USA Today)/i,
    /^(Universal)/i,
    /^(Newsday)/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(title)) {
      const match = title.match(pattern);
      return match ? match[1] : undefined;
    }
  }
  // Try to extract source from title prefix before a separator
  const sepMatch = title.match(/^([^-–—:]+)[–—:-]/);
  if (sepMatch) {
    return sepMatch[1].trim();
  }
  return undefined;
}

/**
 * Extract date from puzzle title if present.
 * Common format: "NYT Crossword - January 12, 2026"
 */
function extractDate(title: string): string | undefined {
  // Look for date patterns like "January 12, 2026" or "2026-01-12"
  const patterns = [
    /(\w+\s+\d{1,2},?\s+\d{4})/,  // January 12, 2026
    /(\d{4}-\d{2}-\d{2})/,         // 2026-01-12
    /(\d{1,2}\/\d{1,2}\/\d{4})/,   // 01/12/2026
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Saves a puzzle by its ID for later retrieval.
 * Also saves metadata to the puzzles-meta store for efficient listing.
 *
 * @param puzzleId - The puzzle ID (used as storage key)
 * @param puzzle - The puzzle to save
 * @param source - Optional source override (e.g., from downloader)
 * @param date - Optional date override (e.g., from downloader)
 */
export async function savePuzzle(
  puzzleId: string,
  puzzle: Puzzle,
  source?: string,
  date?: string
): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
    const puzzleStore = transaction.objectStore(STORE_NAME);
    const metaStore = transaction.objectStore(META_STORE_NAME);

    // Create metadata entry
    const metadata: PuzzleEntry = {
      id: puzzleId,
      title: puzzle.title,
      author: puzzle.author,
      source: source ?? extractSource(puzzle.title),
      date: date ?? extractDate(puzzle.title),
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Save puzzle data
      const puzzleRequest = puzzleStore.put(puzzle, `puzzle:${puzzleId}`);
      puzzleRequest.onerror = () => {
        console.error('[puzzleStorage] Failed to save puzzle by ID:', puzzleRequest.error);
        reject(puzzleRequest.error);
      };

      // Save metadata
      const metaRequest = metaStore.put(metadata);
      metaRequest.onerror = () => {
        console.error('[puzzleStorage] Failed to save puzzle metadata:', metaRequest.error);
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        console.debug('[puzzleStorage] Saved puzzle and metadata:', puzzleId, puzzle.title);
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        console.error('[puzzleStorage] Transaction failed:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error saving puzzle by ID:', error);
    throw error;
  }
}

/**
 * Loads a puzzle by its ID.
 * Used to retrieve puzzles stored via P2P sharing.
 *
 * @param puzzleId - The puzzle ID to load
 * @returns The puzzle if found, null otherwise
 */
export async function loadPuzzleById(puzzleId: string): Promise<Puzzle | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(`puzzle:${puzzleId}`);

      request.onerror = () => {
        console.error('[puzzleStorage] Failed to load puzzle by ID:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const puzzle = request.result as Puzzle | undefined;
        if (puzzle) {
          console.debug('[puzzleStorage] Loaded puzzle by ID:', puzzleId, puzzle.title);
        } else {
          console.debug('[puzzleStorage] No puzzle found for ID:', puzzleId);
        }
        resolve(puzzle ?? null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error loading puzzle by ID:', error);
    return null;
  }
}

/**
 * Lists all saved puzzles with their metadata.
 * Returns entries sorted by savedAt (most recent first).
 */
export async function listAllPuzzles(): Promise<PuzzleEntry[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(META_STORE_NAME, 'readonly');
    const store = transaction.objectStore(META_STORE_NAME);
    const index = store.index('savedAt');

    return new Promise((resolve, reject) => {
      const entries: PuzzleEntry[] = [];
      // Use index to get entries sorted by savedAt
      const request = index.openCursor(null, 'prev'); // 'prev' for descending order

      request.onerror = () => {
        console.error('[puzzleStorage] Failed to list puzzles:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          entries.push(cursor.value as PuzzleEntry);
          cursor.continue();
        } else {
          // All entries collected
          console.debug('[puzzleStorage] Listed', entries.length, 'puzzles');
          resolve(entries);
        }
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error listing puzzles:', error);
    return [];
  }
}

/**
 * Resets puzzle progress by clearing CRDT database and timeline mapping.
 * Keeps the puzzle data and metadata intact.
 *
 * @param puzzleId - The puzzle ID to reset
 */
export async function resetPuzzleProgress(puzzleId: string): Promise<void> {
  try {
    // Clear CRDT database (progress, entries, durations)
    const deleteRequest = indexedDB.deleteDatabase(`puzzle-${puzzleId}`);
    await new Promise<void>((resolve, reject) => {
      deleteRequest.onsuccess = () => {
        console.debug('[puzzleStorage] Reset CRDT database:', `puzzle-${puzzleId}`);
        resolve();
      };
      deleteRequest.onerror = () => {
        console.warn('[puzzleStorage] Failed to reset CRDT database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });

    // Clear timeline mapping
    localStorage.removeItem(`timeline:${puzzleId}`);
    console.debug('[puzzleStorage] Reset timeline entry:', `timeline:${puzzleId}`);
  } catch (error) {
    console.error('[puzzleStorage] Failed to reset puzzle progress:', error);
    throw error;
  }
}

/**
 * Resets puzzle sharing by clearing only the timeline mapping.
 * Progress is preserved, but a new collaborative session will start.
 *
 * @param puzzleId - The puzzle ID to reset sharing for
 */
export function resetPuzzleSharing(puzzleId: string): void {
  localStorage.removeItem(`timeline:${puzzleId}`);
  console.debug('[puzzleStorage] Reset sharing for puzzle:', puzzleId);
}

/**
 * Deletes a puzzle from storage.
 * Removes the puzzle data, metadata, CRDT state database, and timeline entry.
 *
 * @param puzzleId - The puzzle ID to delete
 */
export async function deletePuzzle(puzzleId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
    const puzzleStore = transaction.objectStore(STORE_NAME);
    const metaStore = transaction.objectStore(META_STORE_NAME);

    return new Promise((resolve, reject) => {
      // Delete puzzle data
      const puzzleRequest = puzzleStore.delete(`puzzle:${puzzleId}`);
      puzzleRequest.onerror = () => {
        console.error('[puzzleStorage] Failed to delete puzzle:', puzzleRequest.error);
        reject(puzzleRequest.error);
      };

      // Delete metadata
      const metaRequest = metaStore.delete(puzzleId);
      metaRequest.onerror = () => {
        console.error('[puzzleStorage] Failed to delete puzzle metadata:', metaRequest.error);
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        console.debug('[puzzleStorage] Deleted puzzle:', puzzleId);
        db.close();

        // Clean up CRDT database (y-indexeddb stores progress, entries, durations)
        try {
          const deleteRequest = indexedDB.deleteDatabase(`puzzle-${puzzleId}`);
          deleteRequest.onsuccess = () => {
            console.debug('[puzzleStorage] Deleted CRDT database:', `puzzle-${puzzleId}`);
          };
          deleteRequest.onerror = () => {
            console.warn('[puzzleStorage] Failed to delete CRDT database:', deleteRequest.error);
          };
        } catch (e) {
          console.warn('[puzzleStorage] Error deleting CRDT database:', e);
        }

        // Clean up timeline localStorage entry (collaborative session ID)
        try {
          localStorage.removeItem(`timeline:${puzzleId}`);
          console.debug('[puzzleStorage] Deleted timeline entry:', `timeline:${puzzleId}`);
        } catch (e) {
          console.warn('[puzzleStorage] Error deleting timeline entry:', e);
        }

        resolve();
      };

      transaction.onerror = () => {
        console.error('[puzzleStorage] Delete transaction failed:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[puzzleStorage] Error deleting puzzle:', error);
    throw error;
  }
}

/**
 * Gets the progress for a puzzle by decoding the CRDT state.
 * Counts actual filled cells from the Yjs 'entries' map and verified cells.
 *
 * @param puzzleId - The puzzle ID to check progress for
 * @param puzzle - The puzzle to calculate total fillable cells from
 * @returns Object with filled, verified, and total counts
 */
export async function getPuzzleProgress(
  puzzleId: string,
  puzzle: Puzzle
): Promise<{ filled: number; verified: number; total: number }> {
  // Count total fillable cells from puzzle grid
  let total = 0;
  for (const row of puzzle.grid) {
    for (const cell of row) {
      if (!cell.isBlack && cell.letter) {
        total++;
      }
    }
  }

  // y-indexeddb uses 'puzzle-{puzzleId}' as the database name
  const dbName = `puzzle-${puzzleId}`;

  try {
    // Check if the database exists
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      const dbExists = databases.some((db) => db.name === dbName);
      if (!dbExists) {
        console.debug('[puzzleStorage] No CRDT database for puzzle:', puzzleId);
        return { filled: 0, verified: 0, total };
      }
    }

    // Open the database and decode Yjs updates
    return new Promise((resolve) => {
      const request = indexedDB.open(dbName);

      request.onerror = () => {
        console.debug('[puzzleStorage] Failed to open CRDT database for puzzle:', puzzleId);
        resolve({ filled: 0, verified: 0, total });
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          // Check if 'updates' store exists (y-indexeddb stores updates there)
          if (!db.objectStoreNames.contains('updates')) {
            db.close();
            resolve({ filled: 0, verified: 0, total });
            return;
          }

          // Get all updates from the store
          const transaction = db.transaction('updates', 'readonly');
          const store = transaction.objectStore('updates');
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const updates = getAllRequest.result as Uint8Array[];
            db.close();

            if (updates.length === 0) {
              resolve({ filled: 0, verified: 0, total });
              return;
            }

            // Create a temporary Y.Doc and apply all updates
            const doc = new Y.Doc();
            for (const update of updates) {
              Y.applyUpdate(doc, update);
            }

            // Count entries in the 'entries' map and 'verified' map
            const entries = doc.getMap<string>('entries');
            const verifiedMap = doc.getMap<string>('verified');
            const filled = entries.size;
            const verified = verifiedMap.size;

            console.debug('[puzzleStorage] Puzzle', puzzleId, 'has', filled, 'filled,', verified, 'verified cells');
            doc.destroy();
            resolve({ filled, verified, total });
          };

          getAllRequest.onerror = () => {
            db.close();
            resolve({ filled: 0, verified: 0, total });
          };
        } catch {
          db.close();
          resolve({ filled: 0, verified: 0, total });
        }
      };
    });
  } catch (error) {
    console.debug('[puzzleStorage] Error checking puzzle progress:', error);
    return { filled: 0, verified: 0, total };
  }
}
