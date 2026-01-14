/**
 * Zoom zone computation utilities.
 *
 * Pre-computes stable viewport zones for zoom mode to avoid
 * jarring viewport changes when navigating between clues.
 */

import type { Puzzle, Clue } from '../types/puzzle';

/**
 * Viewport bounds defining a rectangular region of the grid.
 */
export interface ViewportBounds {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/**
 * A pre-computed zoom zone.
 */
export interface ZoomZone {
  id: string;
  bounds: ViewportBounds;
}

/**
 * Assignment of a clue to a zoom zone.
 */
export interface ClueZoneAssignment {
  clueId: string; // "across-1" or "down-5"
  primaryZone: string; // zone.id
  expandedBounds?: ViewportBounds; // If clue spans multiple zones
}

/**
 * Complete zoom zone map for a puzzle.
 */
export interface ZoomZoneMap {
  zones: ZoomZone[];
  clueAssignments: Map<string, ClueZoneAssignment>;
}

/**
 * Get all cells belonging to a clue.
 */
export function getClueCells(
  clue: Clue
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];

  if (clue.direction === 'across') {
    for (let i = 0; i < clue.length; i++) {
      cells.push({ row: clue.row, col: clue.col + i });
    }
  } else {
    for (let i = 0; i < clue.length; i++) {
      cells.push({ row: clue.row + i, col: clue.col });
    }
  }

  return cells;
}

/**
 * Find which zone contains a given cell.
 */
function findZoneForCell(
  row: number,
  col: number,
  zones: ZoomZone[]
): ZoomZone | null {
  for (const zone of zones) {
    if (
      row >= zone.bounds.startRow &&
      row <= zone.bounds.endRow &&
      col >= zone.bounds.startCol &&
      col <= zone.bounds.endCol
    ) {
      return zone;
    }
  }
  return null;
}

/**
 * Compute base zones for a puzzle.
 * Divides the puzzle into a grid of zones based on puzzle size.
 */
export function computeBaseZones(puzzle: Puzzle): ZoomZone[] {
  const { width, height } = puzzle;

  // Determine grid division based on puzzle size
  let rowDivisions: number, colDivisions: number;

  const maxDim = Math.max(width, height);
  if (maxDim < 10) {
    // Small puzzles: 2x2 (halves)
    rowDivisions = colDivisions = 2;
  } else if (maxDim <= 15) {
    // Medium puzzles (standard 15x15): 2x2 (quadrants)
    rowDivisions = colDivisions = 2;
  } else if (maxDim <= 21) {
    // Larger puzzles (21x21): 3x3
    rowDivisions = colDivisions = 3;
  } else {
    // Very large puzzles: scale divisions
    rowDivisions = Math.ceil(height / 8);
    colDivisions = Math.ceil(width / 8);
  }

  const zones: ZoomZone[] = [];
  const rowsPerZone = Math.ceil(height / rowDivisions);
  const colsPerZone = Math.ceil(width / colDivisions);

  for (let r = 0; r < rowDivisions; r++) {
    for (let c = 0; c < colDivisions; c++) {
      zones.push({
        id: `zone-${r}-${c}`,
        bounds: {
          startRow: r * rowsPerZone,
          endRow: Math.min((r + 1) * rowsPerZone - 1, height - 1),
          startCol: c * colsPerZone,
          endCol: Math.min((c + 1) * colsPerZone - 1, width - 1),
        },
      });
    }
  }

  return zones;
}

/**
 * Assign each clue to a primary zone and compute expanded bounds if needed.
 */
export function assignCluesToZones(
  puzzle: Puzzle,
  zones: ZoomZone[]
): Map<string, ClueZoneAssignment> {
  const assignments = new Map<string, ClueZoneAssignment>();

  const allClues = [
    ...puzzle.clues.across.map((c) => ({ ...c, id: `across-${c.number}` })),
    ...puzzle.clues.down.map((c) => ({ ...c, id: `down-${c.number}` })),
  ];

  for (const clue of allClues) {
    const cells = getClueCells(clue);

    // Count cells per zone
    const zoneCounts = new Map<string, number>();
    for (const cell of cells) {
      const zone = findZoneForCell(cell.row, cell.col, zones);
      if (zone) {
        zoneCounts.set(zone.id, (zoneCounts.get(zone.id) || 0) + 1);
      }
    }

    // Find zone with most cells (primary zone)
    let primaryZone = zones[0];
    let maxCount = 0;
    for (const [zoneId, count] of zoneCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryZone = zones.find((z) => z.id === zoneId)!;
      }
    }

    // Check if clue spans multiple zones
    const spansMultipleZones = zoneCounts.size > 1;

    const assignment: ClueZoneAssignment = {
      clueId: clue.id,
      primaryZone: primaryZone.id,
    };

    // If clue spans zones, compute expanded bounds
    if (spansMultipleZones) {
      const rows = cells.map((c) => c.row);
      const cols = cells.map((c) => c.col);
      const clueMinRow = Math.min(...rows);
      const clueMaxRow = Math.max(...rows);
      const clueMinCol = Math.min(...cols);
      const clueMaxCol = Math.max(...cols);

      // Expand primary zone bounds to include entire clue
      assignment.expandedBounds = {
        startRow: Math.min(primaryZone.bounds.startRow, clueMinRow),
        endRow: Math.max(primaryZone.bounds.endRow, clueMaxRow),
        startCol: Math.min(primaryZone.bounds.startCol, clueMinCol),
        endCol: Math.max(primaryZone.bounds.endCol, clueMaxCol),
      };
    }

    assignments.set(clue.id, assignment);
  }

  return assignments;
}

/**
 * Ensure viewport meets minimum size requirements.
 * Expands viewport symmetrically if needed.
 */
export function ensureMinimumViewportSize(
  bounds: ViewportBounds,
  puzzle: Puzzle,
  minSize: number = 5
): ViewportBounds {
  let { startRow, endRow, startCol, endCol } = bounds;
  const { width, height } = puzzle;

  // Ensure minimum row span
  const rowSpan = endRow - startRow + 1;
  if (rowSpan < minSize) {
    const expansion = Math.ceil((minSize - rowSpan) / 2);
    startRow = Math.max(0, startRow - expansion);
    endRow = Math.min(height - 1, endRow + expansion);

    // If still not enough, expand on the available side
    const newRowSpan = endRow - startRow + 1;
    if (newRowSpan < minSize) {
      if (startRow === 0) {
        endRow = Math.min(height - 1, startRow + minSize - 1);
      } else {
        startRow = Math.max(0, endRow - minSize + 1);
      }
    }
  }

  // Ensure minimum column span
  const colSpan = endCol - startCol + 1;
  if (colSpan < minSize) {
    const expansion = Math.ceil((minSize - colSpan) / 2);
    startCol = Math.max(0, startCol - expansion);
    endCol = Math.min(width - 1, endCol + expansion);

    // If still not enough, expand on the available side
    const newColSpan = endCol - startCol + 1;
    if (newColSpan < minSize) {
      if (startCol === 0) {
        endCol = Math.min(width - 1, startCol + minSize - 1);
      } else {
        startCol = Math.max(0, endCol - minSize + 1);
      }
    }
  }

  return { startRow, endRow, startCol, endCol };
}

/**
 * Add padding to viewport bounds.
 * Padding is adjusted based on clue direction for better context.
 */
export function addViewportPadding(
  bounds: ViewportBounds,
  puzzle: Puzzle,
  direction: 'across' | 'down',
  padding: number = 2
): ViewportBounds {
  let { startRow, endRow, startCol, endCol } = bounds;
  const { width, height } = puzzle;

  if (direction === 'across') {
    // For across clues, add more padding vertically
    startRow = Math.max(0, startRow - padding);
    endRow = Math.min(height - 1, endRow + padding);
    // Minimal horizontal padding
    startCol = Math.max(0, startCol - 1);
    endCol = Math.min(width - 1, endCol + 1);
  } else {
    // For down clues, add more padding horizontally
    startCol = Math.max(0, startCol - padding);
    endCol = Math.min(width - 1, endCol + padding);
    // Minimal vertical padding
    startRow = Math.max(0, startRow - 1);
    endRow = Math.min(height - 1, endRow + 1);
  }

  return { startRow, endRow, startCol, endCol };
}

/**
 * Compute the complete zoom zone map for a puzzle.
 */
export function computeZoomZoneMap(puzzle: Puzzle): ZoomZoneMap {
  const zones = computeBaseZones(puzzle);
  const clueAssignments = assignCluesToZones(puzzle, zones);

  return { zones, clueAssignments };
}

/**
 * Get viewport bounds for a specific clue.
 */
export function getViewportForClue(
  clue: Clue,
  zoomZoneMap: ZoomZoneMap,
  puzzle: Puzzle
): ViewportBounds | null {
  const clueId = `${clue.direction}-${clue.number}`;
  const assignment = zoomZoneMap.clueAssignments.get(clueId);

  if (!assignment) {
    return null;
  }

  const zone = zoomZoneMap.zones.find((z) => z.id === assignment.primaryZone);
  if (!zone) {
    return null;
  }

  // Use expanded bounds if clue spans zones, otherwise use zone bounds
  let bounds = assignment.expandedBounds
    ? { ...assignment.expandedBounds }
    : { ...zone.bounds };

  // Add padding based on clue direction
  bounds = addViewportPadding(bounds, puzzle, clue.direction);

  // Ensure minimum viewport size
  bounds = ensureMinimumViewportSize(bounds, puzzle, 5);

  return bounds;
}

/**
 * Compute which edges of the viewport are internal (not at puzzle boundaries).
 * Used to determine where to show edge indicators.
 */
export function computeEdgeIndicators(
  viewport: ViewportBounds,
  puzzle: Puzzle
): {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
} {
  return {
    top: viewport.startRow > 0,
    bottom: viewport.endRow < puzzle.height - 1,
    left: viewport.startCol > 0,
    right: viewport.endCol < puzzle.width - 1,
  };
}
