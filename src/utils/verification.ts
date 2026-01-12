/**
 * Verification utility functions for checking puzzle entries against solutions.
 *
 * These are pure functions with no side effects - they just compare entries
 * to the puzzle solution. The actual CRDT updates happen in useVerification hook.
 */

import type { Puzzle } from '../types/puzzle';

/**
 * Result of checking a single cell.
 * - 'correct': User entry matches solution
 * - 'incorrect': User entry doesn't match solution
 * - 'empty': Cell is black or has no user entry
 */
export type CheckResult = 'correct' | 'incorrect' | 'empty';

/**
 * Check a single cell's entry against the puzzle solution.
 *
 * @param puzzle - The puzzle with solutions
 * @param row - Cell row index
 * @param col - Cell column index
 * @param userEntry - The user's entry for this cell (undefined if empty)
 * @returns CheckResult indicating if entry is correct, incorrect, or empty
 */
export function checkCell(
  puzzle: Puzzle,
  row: number,
  col: number,
  userEntry: string | undefined
): CheckResult {
  const cell = puzzle.grid[row][col];
  if (cell.isBlack) return 'empty';

  const solution = cell.letter;
  if (!userEntry) return 'empty';
  return userEntry === solution ? 'correct' : 'incorrect';
}

/**
 * Check all cells in a word against the puzzle solution.
 *
 * @param puzzle - The puzzle with solutions
 * @param cells - Array of cell coordinates in the word
 * @param entries - Map of user entries (key: "row,col", value: letter)
 * @returns Object with arrays of cell keys grouped by check result
 */
export function checkWord(
  puzzle: Puzzle,
  cells: { row: number; col: number }[],
  entries: Map<string, string>
): { correct: string[]; incorrect: string[]; empty: string[] } {
  const result = { correct: [] as string[], incorrect: [] as string[], empty: [] as string[] };
  for (const { row, col } of cells) {
    const key = `${row},${col}`;
    const status = checkCell(puzzle, row, col, entries.get(key));
    result[status].push(key);
  }
  return result;
}

/**
 * Check all cells in the puzzle against the solution.
 *
 * @param puzzle - The puzzle with solutions
 * @param entries - Map of user entries (key: "row,col", value: letter)
 * @returns Object with arrays of cell keys grouped by check result
 */
export function checkPuzzle(
  puzzle: Puzzle,
  entries: Map<string, string>
): { correct: string[]; incorrect: string[]; empty: string[] } {
  const result = { correct: [] as string[], incorrect: [] as string[], empty: [] as string[] };
  for (let row = 0; row < puzzle.height; row++) {
    for (let col = 0; col < puzzle.width; col++) {
      if (puzzle.grid[row][col].isBlack) continue;
      const key = `${row},${col}`;
      const status = checkCell(puzzle, row, col, entries.get(key));
      result[status].push(key);
    }
  }
  return result;
}
