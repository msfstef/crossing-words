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
  // Track if we've ever seen the puzzle in an incomplete state
  // This is updated synchronously during render to avoid timing issues with effects
  const hasSeenIncompleteRef = useRef<boolean>(false);
  const puzzleIdRef = useRef<string>('');
  // Track if we were enabled on the previous render (used to detect first render after ready)
  const wasEnabledRef = useRef<boolean>(false);

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
  if (puzzleIdRef.current !== puzzleId) {
    puzzleIdRef.current = puzzleId;
    hasSeenIncompleteRef.current = false;
    wasEnabledRef.current = false;
    // Note: setHasTriggered is handled in effect below to avoid setState during render
  }

  // Reset hasTriggered when puzzle changes (must be in effect, not during render)
  useEffect(() => {
    setHasTriggered(false);
  }, [puzzleId]);

  // Track if we've ever seen an incomplete state (synchronously during render)
  // This ensures we catch the incomplete state even if reveal happens immediately.
  //
  // IMPORTANT: We use "isStable" to prevent false triggers when opening
  // already-complete puzzles. isStable ensures we only track after the first
  // render where enabled=true, giving time for the initial CRDT sync.
  //
  // This means:
  // - Loading complete puzzle: entries go 0→N (complete), never tracks, no dialog
  //   (isStable is false on first render when CRDT syncs)
  // - Manual solving: user types → incomplete → tracks → complete → dialog!
  // - Reveal after typing: incomplete → tracks → reveal → dialog!
  // - Reveal on empty puzzle: incomplete on first stable render → tracks → reveal → dialog!
  const isEnabled = !disabled;
  const isStable = wasEnabledRef.current; // Were we enabled last render?

  if (isStable && !isFilledCorrectly) {
    hasSeenIncompleteRef.current = true;
  }

  // Update for next render
  wasEnabledRef.current = isEnabled;

  // Detect completion:
  // justCompleted is true when:
  // 1. We've seen the puzzle in an incomplete state at some point
  // 2. The puzzle IS now complete
  // 3. We haven't already triggered
  //
  // This approach avoids timing issues with effects - if the puzzle was already
  // complete when first loaded, hasSeenIncompleteRef will be false and we won't trigger.
  // If the puzzle was incomplete and becomes complete (via typing or reveal), we trigger.
  const justCompleted = hasSeenIncompleteRef.current && isFilledCorrectly && !hasTriggered;

  // Mark as triggered when completion is detected
  useEffect(() => {
    if (justCompleted) {
      setHasTriggered(true);
    }
  }, [justCompleted]);

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
