/**
 * Unit tests for clue navigation logic in usePuzzleState.
 *
 * Tests the requirements:
 * 1. goToNextClue: Moves to next clue in number order, wraps to other orientation at end
 * 2. goToPrevClue: Moves to previous clue in number order, wraps to other orientation at start
 * 3. Backspace at start of clue: Moves to previous clue (last cell)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePuzzleState } from '../../hooks/usePuzzleState';
import type { Puzzle, Clue } from '../../types/puzzle';

// Mock the CRDT puzzle hook since we don't need P2P for these tests
vi.mock('../../hooks/useCrdtPuzzle', () => ({
  useCrdtPuzzle: (_puzzleId: string, _roomId?: string) => ({
    entries: new Map<string, string>(),
    ready: true,
    setEntry: vi.fn(),
    clearEntry: vi.fn(),
    connectionState: 'disconnected',
    awareness: null,
    verifiedCells: new Set<string>(),
    errorCells: new Set<string>(),
    verifiedMap: null,
    errorsMap: null,
    doc: null,
    entriesMap: null,
    autoCheckEnabled: false,
    setAutoCheck: vi.fn(),
    clearAllEntries: vi.fn(),
  }),
}));

/**
 * Create a simple 5x5 test puzzle for navigation testing.
 *
 * Layout:
 * ```
 * 1  .  2  .  3
 * .  #  .  #  .
 * 4  .  .  .  .
 * .  #  .  #  .
 * 5  .  .  .  6
 * ```
 *
 * Clues:
 * - Across: 1 (0,0 len 1), 2 (0,2 len 1), 3 (0,4 len 1), 4 (2,0 len 5), 5 (4,0 len 4), 6 (4,4 len 1)
 * - Down: 1 (0,0 len 5), 2 (0,2 len 5), 3 (0,4 len 5)
 */
function createNavigationTestPuzzle(): Puzzle {
  const grid = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => ({
      row,
      col,
      letter: 'A',
      isBlack: (row === 1 || row === 3) && (col === 1 || col === 3),
      clueNumber: undefined as number | undefined,
    }))
  );

  // Set clue numbers
  grid[0][0].clueNumber = 1;
  grid[0][2].clueNumber = 2;
  grid[0][4].clueNumber = 3;
  grid[2][0].clueNumber = 4;
  grid[4][0].clueNumber = 5;
  grid[4][4].clueNumber = 6;

  const acrossClues: Clue[] = [
    { number: 1, direction: 'across', text: 'Across 1', row: 0, col: 0, length: 1 },
    { number: 2, direction: 'across', text: 'Across 2', row: 0, col: 2, length: 1 },
    { number: 3, direction: 'across', text: 'Across 3', row: 0, col: 4, length: 1 },
    { number: 4, direction: 'across', text: 'Across 4', row: 2, col: 0, length: 5 },
    { number: 5, direction: 'across', text: 'Across 5', row: 4, col: 0, length: 4 },
    { number: 6, direction: 'across', text: 'Across 6', row: 4, col: 4, length: 1 },
  ];

  const downClues: Clue[] = [
    { number: 1, direction: 'down', text: 'Down 1', row: 0, col: 0, length: 5 },
    { number: 2, direction: 'down', text: 'Down 2', row: 0, col: 2, length: 5 },
    { number: 3, direction: 'down', text: 'Down 3', row: 0, col: 4, length: 5 },
  ];

  return {
    title: 'Navigation Test Puzzle',
    author: 'Test',
    width: 5,
    height: 5,
    grid,
    clues: { across: acrossClues, down: downClues },
  };
}

describe('Clue Navigation', () => {
  let puzzle: Puzzle;

  beforeEach(() => {
    puzzle = createNavigationTestPuzzle();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('goToNextClue', () => {
    it('moves to the next clue in number order within the same orientation', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-1')
      );

      // Initially on clue 1 across (auto-selected on mount)
      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(1);

      // Go to next clue
      act(() => {
        result.current.goToNextClue();
      });

      // Should be on clue 2 across
      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(2);
    });

    it('wraps to the first clue in the OTHER orientation when at last clue', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-2')
      );

      // Navigate to the last across clue (clue 6)
      act(() => {
        result.current.setSelectedCell({ row: 4, col: 4 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(6);

      // Go to next clue - should wrap to first DOWN clue
      act(() => {
        result.current.goToNextClue();
      });

      expect(result.current.direction).toBe('down');
      expect(result.current.currentClue?.number).toBe(1);
    });

    it('wraps back to the original orientation after exhausting other orientation', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-3')
      );

      // Navigate to the last down clue (clue 3)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 4 });
        result.current.setDirection('down');
      });
      expect(result.current.currentClue?.number).toBe(3);

      // Go to next clue - should wrap to first ACROSS clue
      act(() => {
        result.current.goToNextClue();
      });

      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(1);
    });

    it('cycles through all clues in order: across 1-6, then down 1-3, then back to across', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-4')
      );

      // Start at across 1
      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(1);

      const expectedSequence = [
        // Across clues in order
        { dir: 'across', num: 2 },
        { dir: 'across', num: 3 },
        { dir: 'across', num: 4 },
        { dir: 'across', num: 5 },
        { dir: 'across', num: 6 },
        // Then down clues
        { dir: 'down', num: 1 },
        { dir: 'down', num: 2 },
        { dir: 'down', num: 3 },
        // Back to across
        { dir: 'across', num: 1 },
      ];

      for (const expected of expectedSequence) {
        act(() => {
          result.current.goToNextClue();
        });
        expect(result.current.direction).toBe(expected.dir);
        expect(result.current.currentClue?.number).toBe(expected.num);
      }
    });
  });

  describe('goToPrevClue', () => {
    it('moves to the previous clue in number order within the same orientation', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-5')
      );

      // Navigate to clue 3 across
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 4 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(3);

      // Go to prev clue
      act(() => {
        result.current.goToPrevClue();
      });

      // Should be on clue 2 across
      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(2);
    });

    it('wraps to the last clue in the OTHER orientation when at first clue', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-6')
      );

      // Navigate to the first across clue (clue 1)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(1);

      // Go to prev clue - should wrap to last DOWN clue
      act(() => {
        result.current.goToPrevClue();
      });

      expect(result.current.direction).toBe('down');
      expect(result.current.currentClue?.number).toBe(3);
    });

    it('wraps back to the original orientation after exhausting other orientation', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-7')
      );

      // Navigate to the first down clue (clue 1)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('down');
      });
      expect(result.current.currentClue?.number).toBe(1);

      // Go to prev clue - should wrap to last ACROSS clue
      act(() => {
        result.current.goToPrevClue();
      });

      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(6);
    });

    it('cycles backwards through all clues: down 3-1, then across 6-1, then back to down', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-8')
      );

      // Start at down 3
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 4 });
        result.current.setDirection('down');
      });
      expect(result.current.direction).toBe('down');
      expect(result.current.currentClue?.number).toBe(3);

      const expectedSequence = [
        // Down clues in reverse order
        { dir: 'down', num: 2 },
        { dir: 'down', num: 1 },
        // Then across clues in reverse
        { dir: 'across', num: 6 },
        { dir: 'across', num: 5 },
        { dir: 'across', num: 4 },
        { dir: 'across', num: 3 },
        { dir: 'across', num: 2 },
        { dir: 'across', num: 1 },
        // Back to down
        { dir: 'down', num: 3 },
      ];

      for (const expected of expectedSequence) {
        act(() => {
          result.current.goToPrevClue();
        });
        expect(result.current.direction).toBe(expected.dir);
        expect(result.current.currentClue?.number).toBe(expected.num);
      }
    });
  });

  describe('goToNextClue and goToPrevClue are inverses', () => {
    it('goToPrevClue after goToNextClue returns to original clue', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-9')
      );

      // Start at clue 4 across
      act(() => {
        result.current.setSelectedCell({ row: 2, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(4);

      // Go forward then backward
      act(() => {
        result.current.goToNextClue();
      });
      expect(result.current.currentClue?.number).toBe(5);

      act(() => {
        result.current.goToPrevClue();
      });
      expect(result.current.currentClue?.number).toBe(4);
      expect(result.current.direction).toBe('across');
    });
  });

  describe('Backspace at start of clue', () => {
    it('moves to the previous clue when backspace is pressed at the first cell of a clue', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-10')
      );

      // Navigate to clue 4 across (row 2, col 0) - this is the START of clue 4
      act(() => {
        result.current.setSelectedCell({ row: 2, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(4);
      expect(result.current.selectedCell).toEqual({ row: 2, col: 0 });

      // Press backspace on empty cell at start of clue
      // Should move to the previous clue (clue 3 across)
      act(() => {
        result.current.handleBackspace();
      });

      // Should be on clue 3 across at its last cell (0, 4)
      expect(result.current.currentClue?.number).toBe(3);
      expect(result.current.direction).toBe('across');
    });

    it('wraps to last clue of other orientation when at first cell of first clue', () => {
      const { result } = renderHook(() =>
        usePuzzleState(puzzle, 'test-puzzle-11')
      );

      // Navigate to clue 1 across (row 0, col 0) - first clue
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(1);

      // Press backspace on empty cell at start of first clue
      // Should move to the last down clue (clue 3 down)
      act(() => {
        result.current.handleBackspace();
      });

      expect(result.current.currentClue?.number).toBe(3);
      expect(result.current.direction).toBe('down');
    });
  });
});
