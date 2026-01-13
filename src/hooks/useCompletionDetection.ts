/**
 * Hook for detecting puzzle completion.
 *
 * Monitors user entries to detect when puzzle is correctly completed.
 * Returns completion state and a flag that triggers once on transition
 * from incomplete to complete.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Puzzle } from '../types/puzzle';

interface UseCompletionDetectionOptions {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  /** Set to true to disable completion detection (e.g., when not ready) */
  disabled?: boolean;
}

interface UseCompletionDetectionReturn {
  /** Whether the puzzle is currently complete and correct */
  isComplete: boolean;
  /** Fires once when transitioning from incomplete to complete */
  justCompleted: boolean;
  /** Reset the completion state (e.g., after showing success dialog) */
  resetCompletion: () => void;
}

/**
 * Detect when a puzzle is completely and correctly filled.
 *
 * @param options - Puzzle data and user entries
 * @returns Completion state with justCompleted flag for triggering actions
 *
 * @example
 * ```typescript
 * const { isComplete, justCompleted, resetCompletion } = useCompletionDetection({
 *   puzzle,
 *   userEntries,
 * });
 *
 * useEffect(() => {
 *   if (justCompleted) {
 *     // Show success dialog
 *     setShowSuccessDialog(true);
 *     resetCompletion();
 *   }
 * }, [justCompleted]);
 * ```
 */
export function useCompletionDetection({
  puzzle,
  userEntries,
  disabled = false,
}: UseCompletionDetectionOptions): UseCompletionDetectionReturn {
  // Track whether we've already triggered justCompleted
  const [hasTriggered, setHasTriggered] = useState(false);
  // Track the previous completion state to detect transitions
  const prevCompleteRef = useRef<boolean | null>(null);
  const puzzleIdRef = useRef<string>('');

  // Generate a stable puzzle identifier
  const puzzleId = puzzle.title;

  // Get all fillable cells (non-black cells with letters)
  const fillableCells = useMemo(() => {
    const cells: { row: number; col: number; letter: string }[] = [];
    for (let row = 0; row < puzzle.height; row++) {
      for (let col = 0; col < puzzle.width; col++) {
        const cell = puzzle.grid[row][col];
        if (!cell.isBlack && cell.letter) {
          cells.push({ row, col, letter: cell.letter });
        }
      }
    }
    return cells;
  }, [puzzle]);

  // Check if all cells are filled correctly
  const isFilledCorrectly = useMemo(() => {
    if (disabled) return false;

    return fillableCells.every((cell) => {
      const key = `${cell.row},${cell.col}`;
      const entry = userEntries.get(key);
      return entry === cell.letter;
    });
  }, [fillableCells, userEntries, disabled]);

  // Reset state when puzzle changes
  useEffect(() => {
    if (puzzleIdRef.current !== puzzleId) {
      puzzleIdRef.current = puzzleId;
      prevCompleteRef.current = null;
      setHasTriggered(false);
    }
  }, [puzzleId]);

  // Detect transition from incomplete to complete
  // justCompleted is true only when:
  // 1. We have a previous state (not first observation)
  // 2. Previous state was NOT complete
  // 3. Current state IS complete
  // 4. We haven't already triggered
  const wasIncomplete = prevCompleteRef.current === false;
  const justCompleted = wasIncomplete && isFilledCorrectly && !hasTriggered;

  // Update the previous state ref and trigger state after render
  useEffect(() => {
    // If this is our first observation (prevCompleteRef is null), just record the state
    // Don't trigger dialog for already-complete puzzles
    if (prevCompleteRef.current === null) {
      prevCompleteRef.current = isFilledCorrectly;
      return;
    }

    // If we just completed, mark as triggered
    if (!prevCompleteRef.current && isFilledCorrectly && !hasTriggered) {
      setHasTriggered(true);
    }

    // Update previous state
    prevCompleteRef.current = isFilledCorrectly;
  }, [isFilledCorrectly, hasTriggered]);

  // Reset function for external use
  const resetCompletion = () => {
    setHasTriggered(false);
  };

  return {
    isComplete: isFilledCorrectly,
    justCompleted,
    resetCompletion,
  };
}
