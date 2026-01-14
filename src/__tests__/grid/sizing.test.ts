import { describe, it, expect } from 'vitest';
import {
  calculateCellSize,
  GRID_GAP,
  GRID_PADDING,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
} from '../../components/CrosswordGrid';
import { createTestPuzzle, TEST_PUZZLES } from '../../lib/testPuzzleGenerator';

describe('Grid Cell Size Calculation', () => {
  describe('calculateCellSize', () => {
    it('should clamp cell size to minimum when container is too small', () => {
      // Container 100x100, 15x15 puzzle
      // Raw: (100 - 14*2 - 4) / 15 = (100 - 32) / 15 = 4.53px
      // Should be clamped to MIN_CELL_SIZE
      const size = calculateCellSize(100, 100, 15, 15);
      expect(size).toBe(MIN_CELL_SIZE);
    });

    it('should clamp cell size to maximum when container is very large', () => {
      // Container 1000x1000, 5x5 puzzle
      // Raw: (1000 - 4*2 - 4) / 5 = (1000 - 12) / 5 = 197.6px
      // Should be clamped to MAX_CELL_SIZE
      const size = calculateCellSize(1000, 1000, 5, 5);
      expect(size).toBe(MAX_CELL_SIZE);
    });

    it('should calculate correct cell size for standard container', () => {
      // Container 400x400, 15x15 puzzle
      // Total gap X = (15-1)*2 + 2*2 = 28 + 4 = 32
      // Max cell width = (400 - 32) / 15 = 24.53px
      // Should be ~24.5, within min/max range
      const size = calculateCellSize(400, 400, 15, 15);
      expect(size).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
      expect(size).toBeLessThanOrEqual(MAX_CELL_SIZE);
      expect(size).toBeCloseTo(24.53, 1);
    });

    it('should use height constraint when container is wide but short', () => {
      // Wide container: 800x200
      // Width constraint: (800 - 32) / 15 = 51.2px -> clamped to 36
      // Height constraint: (200 - 32) / 15 = 11.2px -> clamped to 12
      // Should use height (smaller) = 12
      const size = calculateCellSize(800, 200, 15, 15);
      expect(size).toBe(MIN_CELL_SIZE);
    });

    it('should use width constraint when container is tall but narrow', () => {
      // Tall container: 200x800
      // Width constraint: (200 - 32) / 15 = 11.2px -> clamped to 12
      // Height constraint: (800 - 32) / 15 = 51.2px -> clamped to 36
      // Should use width (smaller) = 12
      const size = calculateCellSize(200, 800, 15, 15);
      expect(size).toBe(MIN_CELL_SIZE);
    });

    it('should account for grid gap correctly', () => {
      // Container exactly sized for 5x5 grid at 30px cells
      // Required width = 5*30 + 4*GRID_GAP + 2*GRID_PADDING = 150 + 8 + 4 = 162
      const expectedGapTotal = (5 - 1) * GRID_GAP + GRID_PADDING * 2;
      const containerSize = 5 * 30 + expectedGapTotal;
      const size = calculateCellSize(containerSize, containerSize, 5, 5);
      expect(size).toBe(30);
    });

    it('should handle non-square puzzles correctly', () => {
      // 21x15 puzzle (wider than tall)
      // Container 600x400
      // Width: (600 - (21-1)*2 - 4) / 21 = (600 - 44) / 21 = 26.5px
      // Height: (400 - (15-1)*2 - 4) / 15 = (400 - 32) / 15 = 24.5px
      // Should use height constraint = 24.5
      const size = calculateCellSize(600, 400, 21, 15);
      expect(size).toBeCloseTo(24.5, 1);
    });

    it('should handle very large puzzles (25x25)', () => {
      // 25x25 on typical mobile viewport (375x500)
      // Width: (375 - 24*2 - 4) / 25 = (375 - 52) / 25 = 12.92px
      // Height: (500 - 24*2 - 4) / 25 = (500 - 52) / 25 = 17.92px
      // Should use width constraint
      const size = calculateCellSize(375, 500, 25, 25);
      expect(size).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
      expect(size).toBeCloseTo(12.92, 1);
    });

    it('should handle mini puzzles (5x5) at mobile size', () => {
      // 5x5 on mobile (375x400)
      // Width: (375 - 4*2 - 4) / 5 = (375 - 12) / 5 = 72.6px -> clamped to 36
      const size = calculateCellSize(375, 400, 5, 5);
      expect(size).toBe(MAX_CELL_SIZE);
    });
  });

  describe('Test Puzzle Generator', () => {
    it('should create puzzle with correct dimensions', () => {
      const puzzle = createTestPuzzle({ width: 10, height: 8 });
      expect(puzzle.width).toBe(10);
      expect(puzzle.height).toBe(8);
      expect(puzzle.grid.length).toBe(8); // rows
      expect(puzzle.grid[0].length).toBe(10); // cols
    });

    it('should generate clues for the grid', () => {
      const puzzle = createTestPuzzle({ width: 5, height: 5 });
      expect(puzzle.clues.across.length).toBeGreaterThan(0);
      expect(puzzle.clues.down.length).toBeGreaterThan(0);
    });

    it('should use custom title and author', () => {
      const puzzle = createTestPuzzle({
        width: 5,
        height: 5,
        title: 'My Custom Puzzle',
        author: 'Test Author',
      });
      expect(puzzle.title).toBe('My Custom Puzzle');
      expect(puzzle.author).toBe('Test Author');
    });

    it('should generate puzzle with no black cells', () => {
      const puzzle = createTestPuzzle({
        width: 5,
        height: 5,
        blackCellPattern: 'none',
      });
      const blackCells = puzzle.grid.flat().filter((c) => c.isBlack);
      expect(blackCells.length).toBe(0);
    });

    it('should provide pre-defined test puzzles', () => {
      expect(TEST_PUZZLES.mini.width).toBe(5);
      expect(TEST_PUZZLES.mini.height).toBe(5);

      expect(TEST_PUZZLES.standard.width).toBe(15);
      expect(TEST_PUZZLES.standard.height).toBe(15);

      expect(TEST_PUZZLES.sunday.width).toBe(21);
      expect(TEST_PUZZLES.sunday.height).toBe(21);

      expect(TEST_PUZZLES.large.width).toBe(25);
      expect(TEST_PUZZLES.large.height).toBe(25);
    });
  });

  describe('Cell Size for Common Viewport/Puzzle Combinations', () => {
    // Test matrix from plan
    const testCases = [
      { viewport: { w: 320, h: 568 }, puzzle: 'mini', name: 'iPhone SE + mini' },
      { viewport: { w: 375, h: 667 }, puzzle: 'standard', name: 'iPhone 8 + standard' },
      { viewport: { w: 768, h: 1024 }, puzzle: 'sunday', name: 'iPad + sunday' },
      { viewport: { w: 1920, h: 1080 }, puzzle: 'large', name: 'Desktop + large' },
    ];

    // Approximate available grid area (accounting for header, clue bar, etc.)
    const getAvailableArea = (vw: number, vh: number) => {
      // Rough estimates from layout
      const headerHeight = 48;
      const clueBarHeight = 60;
      const titleHeight = 50;
      const padding = 16;
      const keyboard = vw < 768 ? 160 : 0;

      return {
        width: vw - padding,
        height: vh - headerHeight - clueBarHeight - titleHeight - padding - keyboard,
      };
    };

    for (const tc of testCases) {
      it(`should calculate valid cell size for ${tc.name}`, () => {
        const puzzle = TEST_PUZZLES[tc.puzzle as keyof typeof TEST_PUZZLES];
        const area = getAvailableArea(tc.viewport.w, tc.viewport.h);
        const cellSize = calculateCellSize(area.width, area.height, puzzle.width, puzzle.height);

        // Cell size should be within valid range
        expect(cellSize).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
        expect(cellSize).toBeLessThanOrEqual(MAX_CELL_SIZE);

        // Grid should fit within available area
        const gridWidth = puzzle.width * cellSize + (puzzle.width - 1) * GRID_GAP + GRID_PADDING * 2;
        const gridHeight = puzzle.height * cellSize + (puzzle.height - 1) * GRID_GAP + GRID_PADDING * 2;

        expect(gridWidth).toBeLessThanOrEqual(area.width + 1); // +1 for rounding
        expect(gridHeight).toBeLessThanOrEqual(area.height + 1);
      });
    }
  });
});
