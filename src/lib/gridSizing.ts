/**
 * Shared grid sizing utilities for CrosswordGrid and PuzzleSkeleton.
 *
 * These utilities compute exact grid dimensions from viewport dimensions,
 * enabling both the skeleton and the actual grid to render at the same size
 * from the very first frame - eliminating resize flash.
 *
 * The sizing calculation is based on the SolveLayout CSS structure:
 * - header: fixed height (from CSS variable)
 * - grid area: remaining space with padding
 * - clue bar: fixed height (from CSS variable)
 * - keyboard: conditional on device and viewport (from CSS variable)
 */

import {
  GRID_GAP,
  GRID_PADDING,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
  EDGE_INDICATOR_FRACTION,
} from '../components/CrosswordGrid';

/** Default layout values matching SolveLayout.css variables */
const DEFAULT_LAYOUT = {
  headerHeight: 48,
  clueBarHeight: 52,
  keyboardHeight: 160,
  gridPadding: 8,
  clueBarPadding: 8, // 0.25rem top + 0.25rem bottom ≈ 8px
};

/** Title area estimate (puzzle-grid-header: title + author + padding) */
const TITLE_AREA_HEIGHT = 40;

/**
 * Read CSS variables from the document root if available.
 * Falls back to defaults for SSR or before CSS loads.
 */
function getLayoutValues(): typeof DEFAULT_LAYOUT {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DEFAULT_LAYOUT;
  }

  try {
    const styles = getComputedStyle(document.documentElement);
    const getValue = (name: string, fallback: number): number => {
      const value = styles.getPropertyValue(name).trim();
      if (!value) return fallback;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? fallback : parsed;
    };

    return {
      headerHeight: getValue('--header-height', DEFAULT_LAYOUT.headerHeight),
      clueBarHeight: getValue('--clue-bar-height', DEFAULT_LAYOUT.clueBarHeight),
      keyboardHeight: getValue('--keyboard-height', DEFAULT_LAYOUT.keyboardHeight),
      gridPadding: getValue('--grid-padding', DEFAULT_LAYOUT.gridPadding),
      clueBarPadding: DEFAULT_LAYOUT.clueBarPadding,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * Determine if keyboard should be shown based on device and viewport.
 * Matches the CSS media queries in SolveLayout.css:
 * - Touch devices: always show keyboard
 * - Desktop (≥768px): hide by default, show only if height ≥ 700px
 */
function shouldShowKeyboard(isTouchDevice: boolean, viewportWidth: number, viewportHeight: number): boolean {
  if (isTouchDevice) {
    return true;
  }
  // Desktop: show keyboard only when enough vertical space
  return viewportWidth >= 768 && viewportHeight >= 700;
}

/**
 * Calculate the container dimensions available for the grid wrapper.
 * This is the space inside puzzle-grid-wrapper where CrosswordGrid renders.
 */
export function calculateContainerDimensions(
  viewportWidth: number,
  viewportHeight: number,
  isTouchDevice: boolean
): { width: number; height: number } {
  const layout = getLayoutValues();

  // Start with full viewport
  let availableHeight = viewportHeight;

  // Subtract fixed elements
  availableHeight -= layout.headerHeight;
  availableHeight -= layout.clueBarHeight + layout.clueBarPadding;
  availableHeight -= layout.gridPadding * 2; // padding on grid area

  // Subtract keyboard if shown
  if (shouldShowKeyboard(isTouchDevice, viewportWidth, viewportHeight)) {
    availableHeight -= layout.keyboardHeight;
  }

  // Subtract title area (puzzle-grid-header)
  availableHeight -= TITLE_AREA_HEIGHT;

  // Width is viewport minus grid area padding
  const availableWidth = viewportWidth - layout.gridPadding * 2;

  return {
    width: Math.max(0, availableWidth),
    height: Math.max(0, availableHeight),
  };
}

/**
 * Calculate optimal cell size to fit puzzle within container bounds.
 * Returns cell size in pixels, clamped between min and max.
 *
 * This is the same algorithm as CrosswordGrid.calculateCellSize but
 * extracted here for reuse in pre-mount calculations.
 */
export function calculateCellSize(
  containerWidth: number,
  containerHeight: number,
  cols: number,
  rows: number,
  edgeIndicators?: { top: boolean; bottom: boolean; left: boolean; right: boolean } | null
): number {
  const totalGapX = (cols - 1) * GRID_GAP + GRID_PADDING * 2;
  const totalGapY = (rows - 1) * GRID_GAP + GRID_PADDING * 2;

  let horizontalEdgeFraction = 0;
  let verticalEdgeFraction = 0;

  if (edgeIndicators) {
    if (edgeIndicators.left) horizontalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.right) horizontalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.top) verticalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.bottom) verticalEdgeFraction += EDGE_INDICATOR_FRACTION;
  }

  const maxCellWidth = (containerWidth - totalGapX) / (cols + horizontalEdgeFraction);
  const maxCellHeight = (containerHeight - totalGapY) / (rows + verticalEdgeFraction);

  const cellSize = Math.min(maxCellWidth, maxCellHeight);

  return Math.max(MIN_CELL_SIZE, Math.min(cellSize, MAX_CELL_SIZE));
}

/**
 * Calculate the exact pixel dimensions of the rendered grid.
 * Returns the outer dimensions of the .crossword-grid element.
 */
export function calculateGridPixelDimensions(
  cellSize: number,
  cols: number,
  rows: number
): { width: number; height: number } {
  // Grid dimensions: cells + gaps + padding
  const width = cols * cellSize + (cols - 1) * GRID_GAP + GRID_PADDING * 2;
  const height = rows * cellSize + (rows - 1) * GRID_GAP + GRID_PADDING * 2;
  return { width, height };
}

export interface GridDimensions {
  /** Cell size in pixels */
  cellSize: number;
  /** Total grid width in pixels */
  gridWidth: number;
  /** Total grid height in pixels */
  gridHeight: number;
  /** Number of columns */
  cols: number;
  /** Number of rows */
  rows: number;
}

/**
 * Compute exact grid dimensions from viewport and puzzle size.
 * This is the main entry point for pre-calculating grid size.
 *
 * Use this function in both PuzzleSkeleton and CrosswordGrid to ensure
 * they render at identical sizes from the first frame.
 */
export function computeGridDimensions(
  cols: number,
  rows: number,
  isTouchDevice: boolean,
  viewportWidth?: number,
  viewportHeight?: number
): GridDimensions {
  // Use provided viewport or read from window
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 375);
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 667);

  const container = calculateContainerDimensions(vw, vh, isTouchDevice);
  const cellSize = calculateCellSize(container.width, container.height, cols, rows);
  const gridPixels = calculateGridPixelDimensions(cellSize, cols, rows);

  return {
    cellSize,
    gridWidth: gridPixels.width,
    gridHeight: gridPixels.height,
    cols,
    rows,
  };
}

/**
 * Default puzzle dimensions when puzzle is not yet known.
 * Uses standard crossword size (15x15) as a reasonable default.
 */
export const DEFAULT_PUZZLE_DIMENSIONS = { cols: 15, rows: 15 };
