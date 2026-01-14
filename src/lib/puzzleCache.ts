/**
 * In-memory cache for puzzle data to prevent loading flashes.
 *
 * Provides:
 * - Cached puzzle list (metadata) for instant library display
 * - LRU cache for recently loaded puzzles for quick switching
 */

import type { Puzzle } from '../types/puzzle';
import type { PuzzleEntry } from './puzzleStorage';

// Maximum number of full puzzles to keep in memory
const MAX_PUZZLE_CACHE_SIZE = 5;

// Cache for puzzle list metadata
let puzzleListCache: PuzzleEntry[] | null = null;

// LRU cache for full puzzle data (puzzleId -> puzzle)
const puzzleCache = new Map<string, Puzzle>();
const puzzleCacheOrder: string[] = [];

// Progress cache (puzzleId -> progress)
const progressCache = new Map<
  string,
  { filled: number; verified: number; total: number }
>();

/**
 * Get cached puzzle list, if available.
 */
export function getCachedPuzzleList(): PuzzleEntry[] | null {
  return puzzleListCache;
}

/**
 * Update the cached puzzle list.
 */
export function setCachedPuzzleList(entries: PuzzleEntry[]): void {
  puzzleListCache = entries;
}

/**
 * Invalidate the puzzle list cache.
 * Called when puzzles are added/removed.
 */
export function invalidatePuzzleListCache(): void {
  puzzleListCache = null;
}

/**
 * Get a puzzle from cache, if available.
 */
export function getCachedPuzzle(puzzleId: string): Puzzle | null {
  return puzzleCache.get(puzzleId) ?? null;
}

/**
 * Add a puzzle to the cache.
 * Implements LRU eviction when cache is full.
 */
export function setCachedPuzzle(puzzleId: string, puzzle: Puzzle): void {
  // If already in cache, move to end of order (most recent)
  const existingIndex = puzzleCacheOrder.indexOf(puzzleId);
  if (existingIndex !== -1) {
    puzzleCacheOrder.splice(existingIndex, 1);
  }

  // Add to cache and order
  puzzleCache.set(puzzleId, puzzle);
  puzzleCacheOrder.push(puzzleId);

  // Evict oldest if over limit
  while (puzzleCacheOrder.length > MAX_PUZZLE_CACHE_SIZE) {
    const oldestId = puzzleCacheOrder.shift();
    if (oldestId) {
      puzzleCache.delete(oldestId);
      console.debug('[puzzleCache] Evicted puzzle from cache:', oldestId);
    }
  }
}

/**
 * Remove a puzzle from cache.
 * Called when a puzzle is deleted.
 */
export function removeCachedPuzzle(puzzleId: string): void {
  puzzleCache.delete(puzzleId);
  const index = puzzleCacheOrder.indexOf(puzzleId);
  if (index !== -1) {
    puzzleCacheOrder.splice(index, 1);
  }
  progressCache.delete(puzzleId);
}

/**
 * Get cached progress for a puzzle.
 */
export function getCachedProgress(
  puzzleId: string
): { filled: number; verified: number; total: number } | null {
  return progressCache.get(puzzleId) ?? null;
}

/**
 * Set cached progress for a puzzle.
 */
export function setCachedProgress(
  puzzleId: string,
  progress: { filled: number; verified: number; total: number }
): void {
  progressCache.set(puzzleId, progress);
}

/**
 * Invalidate progress cache for a puzzle.
 * Called when puzzle progress changes (entries, verification).
 */
export function invalidateProgressCache(puzzleId: string): void {
  progressCache.delete(puzzleId);
}

/**
 * Clear all caches.
 * Useful for testing or when user logs out.
 */
export function clearAllCaches(): void {
  puzzleListCache = null;
  puzzleCache.clear();
  puzzleCacheOrder.length = 0;
  progressCache.clear();
}
