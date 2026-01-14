/**
 * Tests for zoom zone computation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBaseZones,
  assignCluesToZones,
  computeZoomZoneMap,
  getViewportForClue,
  ensureMinimumViewportSize,
  computeEdgeIndicators,
  getClueCells,
  type ViewportBounds,
} from '../utils/zoomZones';
import type { Puzzle, Clue, Cell } from '../types/puzzle';

/**
 * Create a test puzzle with given dimensions.
 */
function createTestPuzzle(width: number, height: number): Puzzle {
  const grid: Cell[][] = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({
      row,
      col,
      letter: 'A',
      isBlack: false,
      clueNumber: row === 0 && col === 0 ? 1 : undefined,
    }))
  );

  return {
    title: 'Test Puzzle',
    author: 'Test',
    width,
    height,
    grid,
    clues: {
      across: [
        { number: 1, direction: 'across', text: 'Test clue', row: 0, col: 0, length: width },
      ],
      down: [
        { number: 1, direction: 'down', text: 'Test clue', row: 0, col: 0, length: height },
      ],
    },
  };
}

/**
 * Create a puzzle with multiple clues.
 */
function createPuzzleWithClues(): Puzzle {
  const width = 15;
  const height = 15;
  const grid: Cell[][] = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({
      row,
      col,
      letter: 'A',
      isBlack: (row === 7 && col === 7), // Center black square
      clueNumber: (row === 0 && col === 0) ? 1 :
                  (row === 0 && col === 5) ? 2 :
                  (row === 5 && col === 0) ? 3 :
                  (row === 10 && col === 10) ? 4 : undefined,
    }))
  );

  return {
    title: 'Test Puzzle',
    author: 'Test',
    width,
    height,
    grid,
    clues: {
      across: [
        { number: 1, direction: 'across', text: 'First across', row: 0, col: 0, length: 5 },
        { number: 2, direction: 'across', text: 'Second across', row: 0, col: 5, length: 5 },
        { number: 3, direction: 'across', text: 'Third across', row: 5, col: 0, length: 7 },
        { number: 4, direction: 'across', text: 'Fourth across', row: 10, col: 10, length: 5 },
      ],
      down: [
        { number: 1, direction: 'down', text: 'First down', row: 0, col: 0, length: 5 },
        { number: 2, direction: 'down', text: 'Second down', row: 0, col: 5, length: 7 },
        { number: 3, direction: 'down', text: 'Third down', row: 5, col: 0, length: 5 },
        { number: 4, direction: 'down', text: 'Fourth down', row: 10, col: 10, length: 5 },
      ],
    },
  };
}

/**
 * Create a puzzle with a long clue that spans zones.
 */
function createPuzzleWithLongClue(): Puzzle {
  const width = 15;
  const height = 15;
  const grid: Cell[][] = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => ({
      row,
      col,
      letter: 'A',
      isBlack: false,
      clueNumber: (row === 0 && col === 0) ? 1 : undefined,
    }))
  );

  return {
    title: 'Test Puzzle',
    author: 'Test',
    width,
    height,
    grid,
    clues: {
      across: [
        // This clue spans the entire width - will cross zone boundaries
        { number: 1, direction: 'across', text: 'Long across', row: 0, col: 0, length: 15 },
      ],
      down: [
        { number: 1, direction: 'down', text: 'First down', row: 0, col: 0, length: 5 },
      ],
    },
  };
}

describe('getClueCells', () => {
  it('should return correct cells for an across clue', () => {
    const clue: Clue = { number: 1, direction: 'across', text: 'Test', row: 0, col: 2, length: 4 };
    const cells = getClueCells(clue);

    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ row: 0, col: 2 });
    expect(cells[1]).toEqual({ row: 0, col: 3 });
    expect(cells[2]).toEqual({ row: 0, col: 4 });
    expect(cells[3]).toEqual({ row: 0, col: 5 });
  });

  it('should return correct cells for a down clue', () => {
    const clue: Clue = { number: 1, direction: 'down', text: 'Test', row: 2, col: 0, length: 3 };
    const cells = getClueCells(clue);

    expect(cells).toHaveLength(3);
    expect(cells[0]).toEqual({ row: 2, col: 0 });
    expect(cells[1]).toEqual({ row: 3, col: 0 });
    expect(cells[2]).toEqual({ row: 4, col: 0 });
  });
});

describe('computeBaseZones', () => {
  it('should create 4 zones for a 15x15 puzzle (2x2 grid)', () => {
    const puzzle = createTestPuzzle(15, 15);
    const zones = computeBaseZones(puzzle);

    expect(zones).toHaveLength(4);
  });

  it('should create 4 zones for a small puzzle (2x2 grid)', () => {
    const puzzle = createTestPuzzle(5, 5);
    const zones = computeBaseZones(puzzle);

    expect(zones).toHaveLength(4);
  });

  it('should create 9 zones for a 21x21 puzzle (3x3 grid)', () => {
    const puzzle = createTestPuzzle(21, 21);
    const zones = computeBaseZones(puzzle);

    expect(zones).toHaveLength(9);
  });

  it('should cover entire puzzle without gaps', () => {
    const puzzle = createTestPuzzle(15, 15);
    const zones = computeBaseZones(puzzle);

    // Check every cell is covered by exactly one zone
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        const coveringZones = zones.filter(
          (z) =>
            row >= z.bounds.startRow &&
            row <= z.bounds.endRow &&
            col >= z.bounds.startCol &&
            col <= z.bounds.endCol
        );
        expect(coveringZones.length).toBe(1);
      }
    }
  });

  it('should have valid zone IDs', () => {
    const puzzle = createTestPuzzle(15, 15);
    const zones = computeBaseZones(puzzle);

    for (const zone of zones) {
      expect(zone.id).toMatch(/^zone-\d+-\d+$/);
    }
  });
});

describe('assignCluesToZones', () => {
  it('should assign each clue to exactly one primary zone', () => {
    const puzzle = createPuzzleWithClues();
    const zones = computeBaseZones(puzzle);
    const assignments = assignCluesToZones(puzzle, zones);

    const allClueIds = [
      ...puzzle.clues.across.map((c) => `across-${c.number}`),
      ...puzzle.clues.down.map((c) => `down-${c.number}`),
    ];

    for (const clueId of allClueIds) {
      expect(assignments.has(clueId)).toBe(true);
      const assignment = assignments.get(clueId)!;
      expect(assignment.primaryZone).toBeDefined();
      expect(zones.some((z) => z.id === assignment.primaryZone)).toBe(true);
    }
  });

  it('should compute expanded bounds for clues with significant overflow (>2 cells)', () => {
    const puzzle = createPuzzleWithLongClue();
    const zones = computeBaseZones(puzzle);
    const assignments = assignCluesToZones(puzzle, zones);

    // Long clue (15 cells) spans entire width, significant overflow
    const longClueAssignment = assignments.get('across-1');
    expect(longClueAssignment).toBeDefined();
    expect(longClueAssignment!.expandedBounds).toBeDefined();

    // Expanded bounds should include entire clue
    const bounds = longClueAssignment!.expandedBounds!;
    expect(bounds.startCol).toBe(0);
    expect(bounds.endCol).toBeGreaterThanOrEqual(14);
  });

  it('should not expand bounds for clues within single zone', () => {
    const puzzle = createPuzzleWithClues();
    const zones = computeBaseZones(puzzle);
    const assignments = assignCluesToZones(puzzle, zones);

    // Short clue that should fit in one zone
    const shortClueAssignment = assignments.get('across-1');
    expect(shortClueAssignment).toBeDefined();
    // A 5-cell clue starting at (0,0) in a 15x15 puzzle should fit in one quadrant
    expect(shortClueAssignment!.expandedBounds).toBeUndefined();
  });

  it('should not expand bounds for clues with minor overflow (<=2 cells)', () => {
    // Create a puzzle where a clue just barely crosses a zone boundary
    const puzzle = createPuzzleWithClues();
    const zones = computeBaseZones(puzzle);
    const assignments = assignCluesToZones(puzzle, zones);

    // All clues in createPuzzleWithClues are short (5-7 cells) and should not expand
    // because even if they cross a zone, only 1-2 cells would overflow
    for (const [, assignment] of assignments) {
      // None of these short clues should have expanded bounds
      // (they either fit in one zone, or have minor overflow)
      if (assignment.expandedBounds) {
        // If there are expanded bounds, verify the clue has significant overflow
        // by checking that the expansion is substantial (not just 1-2 cells)
        const clue = puzzle.clues.across.find(c => `across-${c.number}` === assignment.clueId)
          || puzzle.clues.down.find(c => `down-${c.number}` === assignment.clueId);
        expect(clue).toBeDefined();
        // Clue should be long enough to have >2 cells outside primary zone
        expect(clue!.length).toBeGreaterThan(7);
      }
    }
  });
});

describe('ensureMinimumViewportSize', () => {
  it('should expand viewport if too small', () => {
    const puzzle = createTestPuzzle(15, 15);
    const smallBounds: ViewportBounds = {
      startRow: 5,
      endRow: 6,
      startCol: 5,
      endCol: 6,
    };

    const expanded = ensureMinimumViewportSize(smallBounds, puzzle, 5);

    expect(expanded.endRow - expanded.startRow + 1).toBeGreaterThanOrEqual(5);
    expect(expanded.endCol - expanded.startCol + 1).toBeGreaterThanOrEqual(5);
  });

  it('should not modify viewport if already large enough', () => {
    const puzzle = createTestPuzzle(15, 15);
    const largeBounds: ViewportBounds = {
      startRow: 0,
      endRow: 7,
      startCol: 0,
      endCol: 7,
    };

    const result = ensureMinimumViewportSize(largeBounds, puzzle, 5);

    expect(result.startRow).toBe(0);
    expect(result.endRow).toBe(7);
    expect(result.startCol).toBe(0);
    expect(result.endCol).toBe(7);
  });

  it('should clamp to puzzle boundaries', () => {
    const puzzle = createTestPuzzle(15, 15);
    const cornerBounds: ViewportBounds = {
      startRow: 13,
      endRow: 14,
      startCol: 13,
      endCol: 14,
    };

    const expanded = ensureMinimumViewportSize(cornerBounds, puzzle, 5);

    expect(expanded.startRow).toBeGreaterThanOrEqual(0);
    expect(expanded.endRow).toBeLessThanOrEqual(14);
    expect(expanded.startCol).toBeGreaterThanOrEqual(0);
    expect(expanded.endCol).toBeLessThanOrEqual(14);
  });
});

describe('computeZoomZoneMap', () => {
  it('should return zones and clue assignments', () => {
    const puzzle = createPuzzleWithClues();
    const zoneMap = computeZoomZoneMap(puzzle);

    expect(zoneMap.zones.length).toBeGreaterThan(0);
    expect(zoneMap.clueAssignments.size).toBeGreaterThan(0);
  });
});

describe('getViewportForClue', () => {
  it('should return viewport bounds for a clue', () => {
    const puzzle = createPuzzleWithClues();
    const zoneMap = computeZoomZoneMap(puzzle);
    const clue = puzzle.clues.across[0];

    const viewport = getViewportForClue(clue, zoneMap, puzzle);

    expect(viewport).toBeDefined();
    expect(viewport!.startRow).toBeGreaterThanOrEqual(0);
    expect(viewport!.endRow).toBeLessThan(puzzle.height);
    expect(viewport!.startCol).toBeGreaterThanOrEqual(0);
    expect(viewport!.endCol).toBeLessThan(puzzle.width);
  });

  it('should ensure minimum viewport size (10x10)', () => {
    const puzzle = createPuzzleWithClues();
    const zoneMap = computeZoomZoneMap(puzzle);
    const clue = puzzle.clues.across[0];

    const viewport = getViewportForClue(clue, zoneMap, puzzle);

    expect(viewport).toBeDefined();
    expect(viewport!.endRow - viewport!.startRow + 1).toBeGreaterThanOrEqual(10);
    expect(viewport!.endCol - viewport!.startCol + 1).toBeGreaterThanOrEqual(10);
  });

  it('should include entire clue in viewport', () => {
    const puzzle = createPuzzleWithLongClue();
    const zoneMap = computeZoomZoneMap(puzzle);
    const longClue = puzzle.clues.across[0];

    const viewport = getViewportForClue(longClue, zoneMap, puzzle);

    expect(viewport).toBeDefined();
    // Viewport should include entire clue
    expect(viewport!.startCol).toBeLessThanOrEqual(longClue.col);
    expect(viewport!.endCol).toBeGreaterThanOrEqual(longClue.col + longClue.length - 1);
  });

  it('should return null for non-existent clue', () => {
    const puzzle = createPuzzleWithClues();
    const zoneMap = computeZoomZoneMap(puzzle);
    const fakeClue: Clue = {
      number: 999,
      direction: 'across',
      text: 'Fake',
      row: 0,
      col: 0,
      length: 1,
    };

    const viewport = getViewportForClue(fakeClue, zoneMap, puzzle);

    expect(viewport).toBeNull();
  });
});

describe('computeEdgeIndicators', () => {
  it('should indicate all edges for center viewport', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 4,
      endRow: 10,
      startCol: 4,
      endCol: 10,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(true);
    expect(indicators.bottom).toBe(true);
    expect(indicators.left).toBe(true);
    expect(indicators.right).toBe(true);
  });

  it('should not indicate top edge when at puzzle top', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 0,
      endRow: 6,
      startCol: 4,
      endCol: 10,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(false);
    expect(indicators.bottom).toBe(true);
    expect(indicators.left).toBe(true);
    expect(indicators.right).toBe(true);
  });

  it('should not indicate bottom edge when at puzzle bottom', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 8,
      endRow: 14,
      startCol: 4,
      endCol: 10,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(true);
    expect(indicators.bottom).toBe(false);
    expect(indicators.left).toBe(true);
    expect(indicators.right).toBe(true);
  });

  it('should not indicate left edge when at puzzle left', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 4,
      endRow: 10,
      startCol: 0,
      endCol: 6,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(true);
    expect(indicators.bottom).toBe(true);
    expect(indicators.left).toBe(false);
    expect(indicators.right).toBe(true);
  });

  it('should not indicate right edge when at puzzle right', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 4,
      endRow: 10,
      startCol: 8,
      endCol: 14,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(true);
    expect(indicators.bottom).toBe(true);
    expect(indicators.left).toBe(true);
    expect(indicators.right).toBe(false);
  });

  it('should not indicate any edges when showing full puzzle', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 0,
      endRow: 14,
      startCol: 0,
      endCol: 14,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(false);
    expect(indicators.bottom).toBe(false);
    expect(indicators.left).toBe(false);
    expect(indicators.right).toBe(false);
  });

  it('should not indicate any edges for corner viewport at top-left', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 0,
      endRow: 6,
      startCol: 0,
      endCol: 6,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(false);
    expect(indicators.left).toBe(false);
    expect(indicators.bottom).toBe(true);
    expect(indicators.right).toBe(true);
  });

  it('should not indicate any edges for corner viewport at bottom-right', () => {
    const puzzle = createTestPuzzle(15, 15);
    const viewport: ViewportBounds = {
      startRow: 8,
      endRow: 14,
      startCol: 8,
      endCol: 14,
    };

    const indicators = computeEdgeIndicators(viewport, puzzle);

    expect(indicators.top).toBe(true);
    expect(indicators.left).toBe(true);
    expect(indicators.bottom).toBe(false);
    expect(indicators.right).toBe(false);
  });
});
