import { describe, it, expect } from 'vitest';
import {
  computeGridDimensions,
  calculateContainerDimensions,
  calculateCellSize,
  calculateGridPixelDimensions,
  DEFAULT_PUZZLE_DIMENSIONS,
} from '../lib/gridSizing';
import { GRID_GAP, GRID_PADDING, MIN_CELL_SIZE, MAX_CELL_SIZE } from '../components/CrosswordGrid';

describe('gridSizing utility', () => {
  describe('calculateContainerDimensions', () => {
    it('computes available space for desktop without keyboard', () => {
      // Desktop (>=768px) without keyboard (height < 700px)
      const result = calculateContainerDimensions(1920, 600, false);

      // Should have reasonable dimensions
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('computes available space for desktop with keyboard', () => {
      // Desktop (>=768px) with keyboard (height >= 700px)
      const result = calculateContainerDimensions(1920, 1080, false);

      // Should have reasonable dimensions
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('computes available space for mobile with keyboard', () => {
      const result = calculateContainerDimensions(375, 667, true);

      // Should have reasonable dimensions
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      // Mobile with keyboard should have less height than without
      const withoutKeyboard = calculateContainerDimensions(375, 667, false);
      expect(result.height).toBeLessThan(withoutKeyboard.height);
    });
  });

  describe('calculateCellSize', () => {
    it('returns cell size within bounds', () => {
      const result = calculateCellSize(400, 400, 15, 15);

      expect(result).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
      expect(result).toBeLessThanOrEqual(MAX_CELL_SIZE);
    });

    it('caps at MAX_CELL_SIZE for large containers', () => {
      const result = calculateCellSize(1920, 1080, 5, 5);

      expect(result).toBe(MAX_CELL_SIZE);
    });

    it('floors at MIN_CELL_SIZE for small containers', () => {
      const result = calculateCellSize(100, 100, 25, 25);

      expect(result).toBe(MIN_CELL_SIZE);
    });

    it('handles non-square puzzles', () => {
      const result = calculateCellSize(400, 400, 15, 21);

      expect(result).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
      expect(result).toBeLessThanOrEqual(MAX_CELL_SIZE);
    });
  });

  describe('calculateGridPixelDimensions', () => {
    it('computes correct grid dimensions', () => {
      const cellSize = 30;
      const cols = 15;
      const rows = 15;

      const result = calculateGridPixelDimensions(cellSize, cols, rows);

      // Width = cols * cellSize + (cols - 1) * GRID_GAP + GRID_PADDING * 2
      const expectedWidth = cols * cellSize + (cols - 1) * GRID_GAP + GRID_PADDING * 2;
      const expectedHeight = rows * cellSize + (rows - 1) * GRID_GAP + GRID_PADDING * 2;

      expect(result.width).toBe(expectedWidth);
      expect(result.height).toBe(expectedHeight);
    });

    it('handles non-square grids', () => {
      const cellSize = 24;
      const cols = 21;
      const rows = 15;

      const result = calculateGridPixelDimensions(cellSize, cols, rows);

      expect(result.width).toBeGreaterThan(result.height);
    });
  });

  describe('computeGridDimensions', () => {
    it('computes consistent dimensions for same inputs', () => {
      const result1 = computeGridDimensions(15, 15, false, 1920, 1080);
      const result2 = computeGridDimensions(15, 15, false, 1920, 1080);

      expect(result1.cellSize).toBe(result2.cellSize);
      expect(result1.gridWidth).toBe(result2.gridWidth);
      expect(result1.gridHeight).toBe(result2.gridHeight);
    });

    it('returns grid dimensions that fit within container', () => {
      const container = calculateContainerDimensions(1920, 1080, false);
      const result = computeGridDimensions(15, 15, false, 1920, 1080);

      expect(result.gridWidth).toBeLessThanOrEqual(container.width);
      expect(result.gridHeight).toBeLessThanOrEqual(container.height);
    });

    it('handles standard puzzle sizes', () => {
      // Mini 5x5
      const mini = computeGridDimensions(5, 5, false, 1920, 1080);
      expect(mini.cellSize).toBe(MAX_CELL_SIZE); // Should max out

      // Standard 15x15
      const standard = computeGridDimensions(15, 15, false, 1920, 1080);
      expect(standard.cellSize).toBeGreaterThanOrEqual(MIN_CELL_SIZE);

      // Sunday 21x21
      const sunday = computeGridDimensions(21, 21, false, 1920, 1080);
      expect(sunday.cellSize).toBeGreaterThanOrEqual(MIN_CELL_SIZE);
    });

    it('produces square grid for square puzzle', () => {
      const result = computeGridDimensions(15, 15, false, 1920, 1080);

      expect(result.gridWidth).toBe(result.gridHeight);
    });

    it('produces non-square grid for non-square puzzle', () => {
      const result = computeGridDimensions(21, 15, false, 1920, 1080);

      expect(result.gridWidth).toBeGreaterThan(result.gridHeight);
    });
  });

  describe('DEFAULT_PUZZLE_DIMENSIONS', () => {
    it('has standard crossword dimensions', () => {
      expect(DEFAULT_PUZZLE_DIMENSIONS.cols).toBe(15);
      expect(DEFAULT_PUZZLE_DIMENSIONS.rows).toBe(15);
    });
  });
});
