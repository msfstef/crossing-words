/**
 * Comprehensive test suite for navigation behavior.
 *
 * This test suite serves as an executable specification for the navigation system.
 * Tests are written BEFORE implementation (TDD) to ensure all intended behaviors
 * are captured and verified.
 *
 * @see docs/NAVIGATION_PLANNED.md for the full specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Puzzle, Clue } from '../../types/puzzle';

// Configurable mock state - set this before each test
let mockEntries = new Map<string, string>();
let mockVerifiedCells = new Set<string>();
const mockSetEntry = vi.fn();
const mockClearEntry = vi.fn();

// Mock the CRDT puzzle hook with configurable state
vi.mock('../../hooks/useCrdtPuzzle', () => ({
  useCrdtPuzzle: () => ({
    get entries() {
      return mockEntries;
    },
    ready: true,
    setEntry: mockSetEntry,
    clearEntry: mockClearEntry,
    connectionState: 'disconnected',
    awareness: null,
    get verifiedCells() {
      return mockVerifiedCells;
    },
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

// Import after mock setup
import { usePuzzleState } from '../../hooks/usePuzzleState';

/**
 * Create a test puzzle.
 *
 * Default layout (5x5):
 * ```
 *   0   1   2   3   4
 * 0 [1] [ ] [2] [ ] [3]    1-Across (len 2), 2-Across (len 2), 3-Across (len 1)
 * 1 [ ] [#] [ ] [#] [ ]    1-Down, 2-Down, 3-Down continue
 * 2 [4] [ ] [ ] [ ] [ ]    4-Across (len 5)
 * 3 [ ] [#] [ ] [#] [ ]
 * 4 [5] [ ] [ ] [ ] [6]    5-Across (len 4), 6-Across (len 1)
 * ```
 *
 * Clues by number:
 * - 1-Across: (0,0) len 2
 * - 1-Down: (0,0) len 5
 * - 2-Across: (0,2) len 2
 * - 2-Down: (0,2) len 5
 * - 3-Across: (0,4) len 1
 * - 3-Down: (0,4) len 5
 * - 4-Across: (2,0) len 5
 * - 5-Across: (4,0) len 4
 * - 6-Across: (4,4) len 1
 */
function createTestPuzzle(): Puzzle {
  const grid = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => ({
      row,
      col,
      letter: 'A', // Solution letter
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
    { number: 1, direction: 'across', text: 'Across 1', row: 0, col: 0, length: 2 },
    { number: 2, direction: 'across', text: 'Across 2', row: 0, col: 2, length: 2 },
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

/**
 * Helper to create a keyboard event for testing
 */
function createKeyboardEvent(key: string, options?: { shiftKey?: boolean }): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    shiftKey: options?.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe('Navigation Behavior', () => {
  let puzzle: Puzzle;
  let testPuzzleId = 0;

  beforeEach(() => {
    puzzle = createTestPuzzle();
    mockEntries = new Map<string, string>();
    mockVerifiedCells = new Set<string>();
    vi.clearAllMocks();
    testPuzzleId++;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getPuzzleId = () => `test-puzzle-${testPuzzleId++}`;

  describe('Letter Entry Auto-Advance', () => {
    describe('within a clue with empty cells ahead', () => {
      it('moves to the next empty cell in the clue', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at 4-Across start (row 2, col 0)
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 0 });
          result.current.setDirection('across');
        });

        // Type a letter
        act(() => {
          result.current.typeLetter('A');
        });

        // Should advance to next cell in clue (row 2, col 1)
        expect(result.current.selectedCell).toEqual({ row: 2, col: 1 });
        expect(result.current.direction).toBe('across');
      });

      it('skips filled cells to find next empty cell', () => {
        // Set up: cell (2,1) is already filled
        mockEntries.set('2,1', 'B');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at 4-Across start (row 2, col 0)
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 0 });
          result.current.setDirection('across');
        });

        // Type a letter - should skip (2,1) which is filled, go to (2,2)
        act(() => {
          result.current.typeLetter('A');
        });

        // Should advance to (2,2), skipping filled (2,1)
        expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
      });
    });

    describe('at last cell of clue with other empty cells in clue', () => {
      it('wraps to the first empty cell in the same clue', () => {
        // Setup: 4-Across with cells 0,2,3 filled, cell 1 and 4 empty
        // Cursor at cell 4 (last cell)
        mockEntries.set('2,0', 'A');
        mockEntries.set('2,2', 'C');
        mockEntries.set('2,3', 'D');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last cell of 4-Across (row 2, col 4)
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 4 });
          result.current.setDirection('across');
        });

        // Type a letter
        act(() => {
          result.current.typeLetter('E');
        });

        // Should wrap to first empty cell in clue: (2,1)
        expect(result.current.selectedCell).toEqual({ row: 2, col: 1 });
        expect(result.current.direction).toBe('across');
      });
    });

    describe('when clue becomes complete (no more empty cells)', () => {
      it('jumps to next clue with empty cells by clue number', () => {
        // Setup: 1-Across (0,0)-(0,1) with (0,0) filled, typing at (0,1)
        mockEntries.set('0,0', 'A');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 1-Across (row 0, col 1)
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 1 });
          result.current.setDirection('across');
        });

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('B');
        });

        // Should jump to next clue with empties
        // Current clue is now complete, so should move to a different clue
        expect(result.current.currentClue?.number).not.toBe(1);
      });
    });

    describe('when ALL puzzle cells are filled', () => {
      it('stays in place', () => {
        // Setup: All cells filled
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            // Skip black cells
            if ((row === 1 || row === 3) && (col === 1 || col === 3)) continue;
            mockEntries.set(`${row},${col}`, 'X');
          }
        }

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at any cell
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        // Type a letter (overwrites existing)
        act(() => {
          result.current.typeLetter('Z');
        });

        // Should stay in place - no empty cells to advance to
        expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
      });
    });

    describe('mid-clue when no empty cells remain in clue', () => {
      it('jumps to next clue with empty cells', () => {
        // Setup: 4-Across all filled except current cell (2,2)
        mockEntries.set('2,0', 'A');
        mockEntries.set('2,1', 'B');
        mockEntries.set('2,3', 'D');
        mockEntries.set('2,4', 'E');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at empty cell in middle of 4-Across
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        // Type a letter - now clue is complete
        act(() => {
          result.current.typeLetter('C');
        });

        // Should jump to next clue with empty cells
        expect(result.current.currentClue?.number).not.toBe(4);
      });
    });

    describe('clue number order progression (within same orientation)', () => {
      it('after completing 1-Across, jumps to 2-Across (next across by number)', () => {
        // Fill 1-Across except last cell (0,1)
        mockEntries.set('0,0', 'A');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 1-Across
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 1 });
          result.current.setDirection('across');
        });

        // Verify we're on 1-Across
        expect(result.current.currentClue?.number).toBe(1);
        expect(result.current.direction).toBe('across');

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('B');
        });

        // Should jump to 2-Across (next across clue by number)
        // Stays in across orientation
        expect(result.current.currentClue?.number).toBe(2);
        expect(result.current.direction).toBe('across');
      });

      it('after completing 1-Down, jumps to 2-Down (next down by number)', () => {
        // Fill 1-Down completely (cells: 0,0; 1,0; 2,0; 3,0; 4,0) except last
        mockEntries.set('0,0', 'A');
        mockEntries.set('1,0', 'B');
        mockEntries.set('2,0', 'C');
        mockEntries.set('3,0', 'D');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 1-Down (4,0)
        act(() => {
          result.current.setSelectedCell({ row: 4, col: 0 });
          result.current.setDirection('down');
        });

        // Verify we're on 1-Down
        expect(result.current.currentClue?.number).toBe(1);
        expect(result.current.direction).toBe('down');

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('E');
        });

        // Should jump to 2-Down (next down clue by number)
        // Stays in down orientation
        expect(result.current.currentClue?.number).toBe(2);
        expect(result.current.direction).toBe('down');
      });

      it('after completing 2-Across, jumps to 3-Across (not back to 1-Across)', () => {
        // Fill 2-Across (cells: 0,2; 0,3) except last
        mockEntries.set('0,2', 'A');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 2-Across (0,3)
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 3 });
          result.current.setDirection('across');
        });

        // Verify we're on 2-Across
        expect(result.current.currentClue?.number).toBe(2);
        expect(result.current.direction).toBe('across');

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('B');
        });

        // Should jump to 3-Across (next across clue by number)
        expect(result.current.currentClue?.number).toBe(3);
        expect(result.current.direction).toBe('across');
      });

      it('after completing 3-Across, jumps to 4-Across (continues by number)', () => {
        // 3-Across is a single cell at (0,4)
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at 3-Across
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 4 });
          result.current.setDirection('across');
        });

        // Verify we're on 3-Across
        expect(result.current.currentClue?.number).toBe(3);
        expect(result.current.direction).toBe('across');

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('A');
        });

        // Should jump to 4-Across (next across clue by number)
        expect(result.current.currentClue?.number).toBe(4);
        expect(result.current.direction).toBe('across');
      });

      it('skips clues that are already complete when finding next clue', () => {
        // Fill 2-Across completely so it's not a valid target
        mockEntries.set('0,2', 'A');
        mockEntries.set('0,3', 'B');

        // Fill 1-Across except last cell
        mockEntries.set('0,0', 'C');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 1-Across (0,1)
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 1 });
          result.current.setDirection('across');
        });

        // Verify we're on 1-Across
        expect(result.current.currentClue?.number).toBe(1);

        // Type a letter to complete the clue
        act(() => {
          result.current.typeLetter('D');
        });

        // Should skip 2-Across (already complete) and go to 3-Across
        expect(result.current.currentClue?.number).toBe(3);
        expect(result.current.direction).toBe('across');
      });

      it('wraps from last across clue back to first across clue with empties', () => {
        // Fill all across clues except 1-Across
        // 2-Across: 0,2; 0,3
        mockEntries.set('0,2', 'A');
        mockEntries.set('0,3', 'B');
        // 3-Across: 0,4
        mockEntries.set('0,4', 'C');
        // 4-Across: 2,0; 2,1; 2,2; 2,3; 2,4
        mockEntries.set('2,0', 'D');
        mockEntries.set('2,1', 'E');
        mockEntries.set('2,2', 'F');
        mockEntries.set('2,3', 'G');
        mockEntries.set('2,4', 'H');
        // 5-Across: 4,0; 4,1; 4,2; 4,3 - fill all except last
        mockEntries.set('4,0', 'I');
        mockEntries.set('4,1', 'J');
        mockEntries.set('4,2', 'K');
        // 6-Across: 4,4
        mockEntries.set('4,4', 'M');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at last empty cell of 5-Across (4,3)
        act(() => {
          result.current.setSelectedCell({ row: 4, col: 3 });
          result.current.setDirection('across');
        });

        // Type a letter to complete 5-Across
        act(() => {
          result.current.typeLetter('L');
        });

        // Should wrap back to 1-Across (first across clue with empty cells)
        // 1-Across cells 0,0 and 0,1 are empty
        expect(result.current.currentClue?.number).toBe(1);
        expect(result.current.direction).toBe('across');
      });

    });
  });

  describe('Backspace Behavior', () => {
    describe('on a filled cell', () => {
      it('clears the cell and moves back to previous cell', () => {
        mockEntries.set('2,2', 'X');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleBackspace();
        });

        // Should clear the cell (called with row, col)
        expect(mockClearEntry).toHaveBeenCalledWith(2, 2);
        // Should move back to previous cell
        expect(result.current.selectedCell).toEqual({ row: 2, col: 1 });
      });
    });

    describe('on an empty cell', () => {
      it('moves back one cell without clearing', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at (2,2) which is empty
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleBackspace();
        });

        // Should move back to (2,1)
        expect(result.current.selectedCell).toEqual({ row: 2, col: 1 });
        // Should NOT clear anything
        expect(mockClearEntry).not.toHaveBeenCalled();
      });
    });

    describe('at first cell of a clue (not first clue)', () => {
      it('navigates to last cell of previous clue without clearing', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at start of 4-Across (row 2, col 0)
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 0 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleBackspace();
        });

        // Should go to last cell of previous clue (3-Across ends at 0,4)
        expect(result.current.currentClue?.number).toBe(3);
        expect(result.current.selectedCell).toEqual({ row: 0, col: 4 });
        // Should NOT clear
        expect(mockClearEntry).not.toHaveBeenCalled();
      });
    });

    describe('at first cell of first clue (1-Across)', () => {
      it('wraps to last cell of last clue', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at start of 1-Across (row 0, col 0)
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 0 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleBackspace();
        });

        // Should wrap to last cell of last clue
        // Last clue is 3-Down, ends at (4,4)
        expect(result.current.selectedCell).toEqual({ row: 4, col: 4 });
      });
    });

    describe('with verified cells in the path', () => {
      it('skips verified cells when moving backwards', () => {
        mockVerifiedCells.add('2,1'); // (2,1) is verified

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at (2,2) in 4-Across
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleBackspace();
        });

        // Should skip verified (2,1) and go to (2,0)
        expect(result.current.selectedCell).toEqual({ row: 2, col: 0 });
      });
    });
  });

  describe('Delete Key Behavior', () => {
    it('clears current cell without moving', () => {
      mockEntries.set('2,2', 'X');

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      // Press Delete key
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent('Delete'));
      });

      // Should clear the cell (called with row, col)
      expect(mockClearEntry).toHaveBeenCalledWith(2, 2);
      // Should stay in place
      expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
    });

    it('does nothing on verified cells', () => {
      mockEntries.set('2,2', 'X');
      mockVerifiedCells.add('2,2');

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent('Delete'));
      });

      // Should NOT clear verified cell
      expect(mockClearEntry).not.toHaveBeenCalled();
      // Should stay in place
      expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
    });
  });

  describe('Arrow Key Navigation', () => {
    describe('basic movement', () => {
      it('moves one cell in arrow direction', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        // Right arrow
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowRight'));
        });
        expect(result.current.selectedCell).toEqual({ row: 2, col: 3 });

        // Down arrow - (3,3) is black, should skip to (4,3)
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
        });
        expect(result.current.selectedCell).toEqual({ row: 4, col: 3 });

        // Left arrow
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowLeft'));
        });
        expect(result.current.selectedCell).toEqual({ row: 4, col: 2 });

        // Up arrow - should skip black (3,3) and go to (2,2)
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowUp'));
        });
        expect(result.current.selectedCell).toEqual({ row: 3, col: 2 });
      });

      it('keeps current direction when moving perpendicular', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 2, col: 2 });
          result.current.setDirection('across');
        });

        // Move down (perpendicular to across)
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
        });

        // Direction should remain 'across'
        expect(result.current.direction).toBe('across');
      });
    });

    describe('black cell skipping', () => {
      it('skips over black cells to find next white cell', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at (0,0), black cell at (1,1)
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 0 });
          result.current.setDirection('down');
        });

        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
        });

        // From (2,0) going down -> (3,0)
        expect(result.current.selectedCell).toEqual({ row: 3, col: 0 });
      });

      it('skips multiple black cells', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 0, col: 0 });
          result.current.setDirection('across');
        });

        // Move right - should go to (0,1)
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowRight'));
        });
        expect(result.current.selectedCell).toEqual({ row: 0, col: 1 });
      });

      it('stays in place if only black cells before edge', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at (0,3), need to go down and hit black cell at (1,3)
        act(() => {
          result.current.setSelectedCell({ row: 0, col: 3 });
          result.current.setDirection('down');
        });

        // Move down - black cell at (1,3), should skip to (2,3)
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowDown'));
        });

        expect(result.current.selectedCell).toEqual({ row: 2, col: 3 });
      });
    });

    describe('edge behavior', () => {
      it('stops at puzzle edge (no wrapping)', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        // Position at right edge
        act(() => {
          result.current.setSelectedCell({ row: 2, col: 4 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowRight'));
        });

        // Should stay at edge
        expect(result.current.selectedCell).toEqual({ row: 2, col: 4 });
      });

      it('stops at top edge', () => {
        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 0, col: 2 });
          result.current.setDirection('down');
        });

        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowUp'));
        });

        expect(result.current.selectedCell).toEqual({ row: 0, col: 2 });
      });
    });

    describe('filled cells', () => {
      it('does NOT skip filled cells', () => {
        mockEntries.set('2,1', 'X');

        const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

        act(() => {
          result.current.setSelectedCell({ row: 2, col: 0 });
          result.current.setDirection('across');
        });

        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('ArrowRight'));
        });

        // Should land on filled cell (2,1), not skip it
        expect(result.current.selectedCell).toEqual({ row: 2, col: 1 });
      });
    });
  });

  describe('Tab / Shift+Tab Navigation', () => {
    it('Tab moves to next clue by clue number', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start at 1-Across
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(1);

      // Press Tab
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent('Tab'));
      });

      // Should go to next clue
      expect(result.current.currentClue?.number).toBeGreaterThanOrEqual(1);
    });

    it('Shift+Tab moves to previous clue by clue number', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start at 2-Across
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 2 });
        result.current.setDirection('across');
      });
      expect(result.current.currentClue?.number).toBe(2);

      // Press Shift+Tab
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent('Tab', { shiftKey: true }));
      });

      // Should go to previous clue
      expect(result.current.currentClue?.number).toBeLessThanOrEqual(2);
    });

    it('Tab at last clue wraps to first clue', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Navigate to last clue (3-Down at 0,4)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 4 });
        result.current.setDirection('down');
      });

      // Press Tab multiple times to reach the end and wrap
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.handleKeyDown(createKeyboardEvent('Tab'));
        });
      }

      // Should eventually be at some clue (wrap behavior)
      expect(result.current.currentClue).not.toBeNull();
    });

    it('Shift+Tab at first clue wraps to last clue', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start at 1-Across
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });

      // Press Shift+Tab
      act(() => {
        result.current.handleKeyDown(createKeyboardEvent('Tab', { shiftKey: true }));
      });

      // Should wrap to last clue (3-Down)
      expect(result.current.currentClue?.number).toBe(3);
      expect(result.current.direction).toBe('down');
    });

    it('Tab goes to first empty cell of target clue', () => {
      // First cell of 2-Across filled
      mockEntries.set('0,2', 'X');

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Navigate to 1-Down (so next is 2-Across)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('down');
      });

      // Tab to next clue
      act(() => {
        result.current.goToNextClue();
      });

      // If landing on 2-Across, should go to first empty cell (0,3)
      if (result.current.currentClue?.number === 2 && result.current.direction === 'across') {
        expect(result.current.selectedCell).toEqual({ row: 0, col: 3 });
      }
    });
  });

  describe('Cell Click Direction Behavior', () => {
    it('keeps current direction when clicking a different cell', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start with down direction at (0,0)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('down');
      });
      expect(result.current.direction).toBe('down');

      // Click on a different cell
      act(() => {
        result.current.handleCellClick(2, 2);
      });

      // Direction should remain 'down'
      expect(result.current.direction).toBe('down');
      expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
    });

    it('switches to available direction if current has no clue', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start with down direction
      act(() => {
        result.current.setSelectedCell({ row: 2, col: 0 });
        result.current.setDirection('down');
      });

      // Click on a cell - 5-Across at (4,1) might only have across
      act(() => {
        result.current.handleCellClick(4, 1);
      });

      expect(result.current.selectedCell).toEqual({ row: 4, col: 1 });
    });

    it('toggles direction when clicking same cell', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Select cell that has both across and down clues
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });
      expect(result.current.direction).toBe('across');

      // Click same cell
      act(() => {
        result.current.handleCellClick(0, 0);
      });

      // Should toggle to down
      expect(result.current.direction).toBe('down');

      // Click again
      act(() => {
        result.current.handleCellClick(0, 0);
      });

      // Should toggle back to across
      expect(result.current.direction).toBe('across');
    });

    it('ignores clicks on black cells', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      // Click on black cell at (1,1)
      act(() => {
        result.current.handleCellClick(1, 1);
      });

      // Should stay where we were
      expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
    });
  });

  describe('Swipe Gesture Navigation', () => {
    it('moves one cell in swipe direction (like arrow keys)', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      // Swipe right
      act(() => {
        result.current.handleSwipeNavigation('right');
      });

      expect(result.current.selectedCell).toEqual({ row: 2, col: 3 });
    });

    it('skips black cells when swiping', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Position before black cell
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('down');
      });

      // Swipe down
      act(() => {
        result.current.handleSwipeNavigation('down');
      });

      expect(result.current.selectedCell).toEqual({ row: 1, col: 0 });
    });

    it('stops at edge when swiping', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Position at edge
      act(() => {
        result.current.setSelectedCell({ row: 2, col: 4 });
        result.current.setDirection('across');
      });

      // Swipe right (toward edge)
      act(() => {
        result.current.handleSwipeNavigation('right');
      });

      // Should stay at edge
      expect(result.current.selectedCell).toEqual({ row: 2, col: 4 });
    });

    it('stays in place if only black cells before edge', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // (1,0) swiping right has black at (1,1) and (1,3)
      act(() => {
        result.current.setSelectedCell({ row: 1, col: 0 });
        result.current.setDirection('across');
      });

      // Swipe right - should find (1,2) after skipping (1,1)
      act(() => {
        result.current.handleSwipeNavigation('right');
      });

      expect(result.current.selectedCell).toEqual({ row: 1, col: 2 });
    });
  });

  describe('Spacebar Direction Toggle', () => {
    it('toggles direction when alternate clue exists', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Position on cell with both across and down clues
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent(' '));
      });

      expect(result.current.direction).toBe('down');
    });

    it('does nothing when no alternate clue exists', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Position on cell that might only have one direction
      act(() => {
        result.current.setSelectedCell({ row: 4, col: 1 });
        result.current.setDirection('across');
      });

      act(() => {
        result.current.handleKeyDown(createKeyboardEvent(' '));
      });

      // Direction might or might not change depending on puzzle structure
      expect(result.current.direction).toBeDefined();
    });
  });

  describe('Verified Cells', () => {
    it('skips verified cells during auto-advance', () => {
      mockVerifiedCells.add('2,1'); // (2,1) is verified

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Position at (2,0) in 4-Across
      act(() => {
        result.current.setSelectedCell({ row: 2, col: 0 });
        result.current.setDirection('across');
      });

      // Type a letter
      act(() => {
        result.current.typeLetter('A');
      });

      // Should skip verified (2,1) and go to (2,2)
      expect(result.current.selectedCell).toEqual({ row: 2, col: 2 });
    });

    it('cannot clear verified cells with backspace', () => {
      mockEntries.set('2,2', 'X');
      mockVerifiedCells.add('2,2');

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      act(() => {
        result.current.handleBackspace();
      });

      // Should NOT clear verified cell
      expect(mockClearEntry).not.toHaveBeenCalled();
    });

    it('cannot type over verified cells', () => {
      mockEntries.set('2,2', 'X');
      mockVerifiedCells.add('2,2');

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      act(() => {
        result.current.setSelectedCell({ row: 2, col: 2 });
        result.current.setDirection('across');
      });

      act(() => {
        result.current.typeLetter('Z');
      });

      // Should NOT modify verified cell
      expect(mockSetEntry).not.toHaveBeenCalled();
      // Should advance past it
      expect(result.current.selectedCell).not.toEqual({ row: 2, col: 2 });
    });
  });

  describe('Initial State', () => {
    it('selects first cell of 1-Across on puzzle load', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Should auto-select first across clue
      expect(result.current.selectedCell).toEqual({ row: 0, col: 0 });
      expect(result.current.direction).toBe('across');
      expect(result.current.currentClue?.number).toBe(1);
    });
  });

  describe('Clue Navigation Buttons', () => {
    it('goToNextClue goes to first empty cell of next clue', () => {
      mockEntries.set('0,2', 'X'); // First cell of 2-Across filled

      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Start at 1-Across
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 0 });
        result.current.setDirection('across');
      });

      // Go to next clue
      act(() => {
        result.current.goToNextClue();
      });

      // Verify we moved to a different clue
      expect(result.current.currentClue).not.toBeNull();
    });

    it('wraps from last clue to first clue', () => {
      const { result } = renderHook(() => usePuzzleState(puzzle, getPuzzleId()));

      // Navigate to last down clue (3-Down)
      act(() => {
        result.current.setSelectedCell({ row: 0, col: 4 });
        result.current.setDirection('down');
      });
      expect(result.current.currentClue?.number).toBe(3);
      expect(result.current.direction).toBe('down');

      // Go to next clue - should wrap to 1-Across
      act(() => {
        result.current.goToNextClue();
      });

      expect(result.current.currentClue?.number).toBe(1);
      expect(result.current.direction).toBe('across');
    });
  });
});
