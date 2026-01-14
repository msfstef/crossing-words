/**
 * E2E Test Helpers for Test Puzzle Loading
 *
 * These helpers provide standardized ways to load test puzzles in Playwright tests.
 * They work with the test puzzle generator exposed by the app in dev mode.
 *
 * @example Basic usage with URL params (recommended for most tests)
 * ```typescript
 * import { test } from '@playwright/test';
 * import { navigateToTestPuzzle, waitForPuzzleReady } from './helpers/testPuzzleHelpers';
 *
 * test('grid renders correctly', async ({ page }) => {
 *   await navigateToTestPuzzle(page, 'standard');
 *   await waitForPuzzleReady(page);
 *   // ... assertions
 * });
 * ```
 *
 * @example Custom puzzle size
 * ```typescript
 * await navigateToTestPuzzle(page, 'custom', { width: 10, height: 10 });
 * ```
 *
 * @example Dynamic loading (useful for testing multiple sizes)
 * ```typescript
 * await navigateToApp(page);
 * await loadTestPuzzleDynamically(page, 'sunday');
 * ```
 */

import { expect, type Page } from '@playwright/test';

// ============================================================================
// Type Definitions
// ============================================================================

/** Pre-defined test puzzle names matching TEST_PUZZLES in testPuzzleGenerator.ts */
export type TestPuzzleName =
  | 'mini'
  | 'standard'
  | 'sunday'
  | 'large'
  | 'miniNoBlack'
  | 'standardSymmetric'
  | 'standardDense'
  | 'standardHalfFilled'
  | 'sundayNearComplete';

/** Options for custom test puzzles */
export interface CustomPuzzleOptions {
  width: number;
  height: number;
  pattern?: 'none' | 'standard' | 'symmetric' | 'dense' | 'minimal';
  prefill?: number;
}

/** Puzzle grid visibility check result */
export interface GridVisibilityResult {
  visible: boolean;
  gridRect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  viewportHeight: number;
  viewportWidth: number;
  issues: string[];
}

/** Cell information from the grid */
export interface CellInfo {
  row: number;
  col: number;
  width: number;
  height: number;
  isBlack: boolean;
  hasClueNumber: boolean;
  clueNumber?: number;
  content?: string;
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Get the base URL for the test server.
 * Supports TEST_URL environment variable for flexibility.
 */
export function getBaseUrl(): string {
  return process.env.TEST_URL || 'http://localhost:5173';
}

/**
 * Navigate directly to a test puzzle using URL parameters.
 * This is the recommended approach for most tests as it's fastest and most reliable.
 *
 * @param page - Playwright page object
 * @param puzzleName - Pre-defined puzzle name or 'custom'
 * @param customOptions - Options for custom puzzle (when puzzleName is 'custom')
 *
 * @example Pre-defined puzzle
 * ```typescript
 * await navigateToTestPuzzle(page, 'standard');
 * ```
 *
 * @example Custom puzzle
 * ```typescript
 * await navigateToTestPuzzle(page, 'custom', { width: 10, height: 10 });
 * ```
 */
export async function navigateToTestPuzzle(
  page: Page,
  puzzleName: TestPuzzleName | 'custom',
  customOptions?: CustomPuzzleOptions
): Promise<void> {
  const baseUrl = getBaseUrl();

  if (puzzleName !== 'custom') {
    await page.goto(`${baseUrl}?testPuzzle=${puzzleName}`);
  } else if (customOptions) {
    const params = new URLSearchParams();
    params.set('testPuzzle', 'custom');
    params.set('width', customOptions.width.toString());
    params.set('height', customOptions.height.toString());
    if (customOptions.pattern) {
      params.set('pattern', customOptions.pattern);
    }
    if (customOptions.prefill !== undefined) {
      params.set('prefill', customOptions.prefill.toString());
    }
    await page.goto(`${baseUrl}?${params.toString()}`);
  } else {
    throw new Error('Custom puzzle options required when puzzleName is "custom"');
  }
}

/**
 * Navigate to the app without loading a specific puzzle.
 * Use this when you need to test the library view or dynamically load puzzles.
 */
export async function navigateToApp(page: Page): Promise<void> {
  await page.goto(getBaseUrl());
}

// ============================================================================
// Puzzle Loading Helpers
// ============================================================================

/**
 * Load a test puzzle dynamically using the window.__loadTestPuzzle__ function.
 * Useful for testing multiple puzzle sizes in a single test without page reloads.
 *
 * @param page - Playwright page object
 * @param puzzleName - Pre-defined puzzle name
 *
 * @example
 * ```typescript
 * await navigateToApp(page);
 * await loadTestPuzzleDynamically(page, 'mini');
 * // ... test mini puzzle
 * await loadTestPuzzleDynamically(page, 'standard');
 * // ... test standard puzzle
 * ```
 */
export async function loadTestPuzzleDynamically(
  page: Page,
  puzzleName: TestPuzzleName
): Promise<void> {
  await page.evaluate((name) => {
    if (window.__loadTestPuzzle__) {
      window.__loadTestPuzzle__(name as TestPuzzleName);
    } else {
      throw new Error('Test puzzle loader not available. Is dev mode enabled?');
    }
  }, puzzleName);
}

/**
 * Create and load a custom test puzzle dynamically.
 *
 * @param page - Playwright page object
 * @param options - Custom puzzle options
 */
export async function createAndLoadCustomPuzzle(
  page: Page,
  options: CustomPuzzleOptions
): Promise<void> {
  await page.evaluate(
    (opts) => {
      if (window.__createTestPuzzle__) {
        const puzzle = window.__createTestPuzzle__({
          width: opts.width,
          height: opts.height,
          blackCellPattern: opts.pattern || 'standard',
          prefillPercent: opts.prefill || 0,
        });
        // Note: This creates the puzzle but doesn't load it
        // You'd need additional app integration to actually render it
        console.log('[Test] Created custom puzzle:', puzzle.title);
        return puzzle;
      }
      throw new Error('Test puzzle creator not available. Is dev mode enabled?');
    },
    options
  );
}

// ============================================================================
// Wait Helpers
// ============================================================================

/**
 * Wait for the puzzle grid to be fully rendered and interactive.
 * This is the standard wait to use after navigating to a test puzzle.
 *
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in milliseconds (default: 30000)
 */
export async function waitForPuzzleReady(
  page: Page,
  timeout = 30000
): Promise<void> {
  // Wait for the grid to appear
  await page.waitForSelector('.crossword-grid', {
    state: 'visible',
    timeout,
  });

  // Wait for at least one cell to be visible
  await page.waitForSelector('.crossword-cell', {
    state: 'visible',
    timeout,
  });

  // Wait for any loading overlays to disappear
  await page.waitForFunction(
    () => {
      const overlay = document.querySelector('.puzzle-loading-overlay');
      return !overlay || getComputedStyle(overlay).display === 'none';
    },
    { timeout }
  );
}

/**
 * Wait for the library view to be ready.
 */
export async function waitForLibraryReady(page: Page, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading puzzles'),
    { timeout }
  );
}

/**
 * Wait for a specific number of cells to be rendered.
 * Useful for verifying the correct puzzle size loaded.
 *
 * @param page - Playwright page object
 * @param expectedCount - Expected number of cells
 * @param timeout - Maximum wait time in milliseconds
 */
export async function waitForCellCount(
  page: Page,
  expectedCount: number,
  timeout = 10000
): Promise<void> {
  await page.waitForFunction(
    (count) => {
      const cells = document.querySelectorAll('.crossword-cell');
      return cells.length === count;
    },
    expectedCount,
    { timeout }
  );
}

// ============================================================================
// Grid Inspection Helpers
// ============================================================================

/**
 * Check if the grid is fully visible within the viewport.
 * Returns detailed information about visibility issues.
 */
export async function isGridFullyVisible(page: Page): Promise<GridVisibilityResult> {
  return page.evaluate(() => {
    const grid = document.querySelector('.crossword-grid');
    const title = document.querySelector('.puzzle-title-above-grid');
    const issues: string[] = [];

    if (!grid) {
      return {
        visible: false,
        gridRect: { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 },
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        issues: ['Grid element not found'],
      };
    }

    const gridRect = grid.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Check if grid is cut off at bottom
    if (gridRect.bottom > viewportHeight) {
      issues.push(
        `Grid bottom (${gridRect.bottom.toFixed(0)}px) exceeds viewport height (${viewportHeight}px)`
      );
    }

    // Check if grid is cut off at top
    if (gridRect.top < 0) {
      issues.push(`Grid top (${gridRect.top.toFixed(0)}px) is above viewport`);
    }

    // Check if grid is cut off on sides
    if (gridRect.left < 0) {
      issues.push(`Grid left (${gridRect.left.toFixed(0)}px) is outside viewport`);
    }
    if (gridRect.right > viewportWidth) {
      issues.push(
        `Grid right (${gridRect.right.toFixed(0)}px) exceeds viewport width (${viewportWidth}px)`
      );
    }

    // Check if title is visible (if present)
    if (title) {
      const titleRect = title.getBoundingClientRect();
      if (titleRect.top < 0) {
        issues.push(`Title top (${titleRect.top.toFixed(0)}px) is above viewport`);
      }
      if (titleRect.bottom < 0) {
        issues.push('Title is completely above viewport');
      }
    }

    return {
      visible: issues.length === 0,
      gridRect: {
        top: gridRect.top,
        left: gridRect.left,
        bottom: gridRect.bottom,
        right: gridRect.right,
        width: gridRect.width,
        height: gridRect.height,
      },
      viewportHeight,
      viewportWidth,
      issues,
    };
  });
}

/**
 * Get the dimensions of a single cell in the grid.
 * Returns the first white cell's dimensions.
 */
export async function getCellSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const cell = document.querySelector('.crossword-cell:not(.cell--black)');
    if (!cell) {
      return { width: 0, height: 0 };
    }
    const rect = cell.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
}

/**
 * Get all unique cell sizes in the grid.
 * Useful for verifying all cells are consistently sized.
 */
export async function getUniqueCellSizes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cells = document.querySelectorAll('.crossword-cell:not(.cell--black)');
    const sizes = new Set<string>();
    cells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      sizes.add(`${Math.round(rect.width)}x${Math.round(rect.height)}`);
    });
    return Array.from(sizes);
  });
}

/**
 * Get the puzzle title displayed above the grid.
 */
export async function getPuzzleTitle(page: Page): Promise<string | null> {
  const title = page.locator('.puzzle-title-above-grid');
  if (await title.isVisible()) {
    return title.textContent();
  }
  return null;
}

/**
 * Get the current puzzle from window.__CURRENT_TEST_PUZZLE__.
 * Only works in dev mode when a test puzzle is loaded.
 */
export async function getCurrentTestPuzzle(page: Page): Promise<{
  title: string;
  width: number;
  height: number;
} | null> {
  return page.evaluate(() => {
    const puzzle = window.__CURRENT_TEST_PUZZLE__;
    if (!puzzle) return null;
    return {
      title: puzzle.title,
      width: puzzle.width,
      height: puzzle.height,
    };
  });
}

/**
 * Count the number of cells in the grid.
 */
export async function getCellCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return document.querySelectorAll('.crossword-cell').length;
  });
}

/**
 * Count the number of black cells in the grid.
 */
export async function getBlackCellCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return document.querySelectorAll('.crossword-cell.cell--black').length;
  });
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that the grid is fully visible within the viewport.
 * Throws an assertion error with detailed issue information if not visible.
 */
export async function assertGridFullyVisible(page: Page): Promise<void> {
  const result = await isGridFullyVisible(page);
  expect(result.visible, `Grid visibility issues: ${result.issues.join(', ')}`).toBe(
    true
  );
}

/**
 * Assert that the puzzle has the expected dimensions.
 */
export async function assertPuzzleDimensions(
  page: Page,
  expectedWidth: number,
  expectedHeight: number
): Promise<void> {
  const cellCount = await getCellCount(page);
  const expectedCells = expectedWidth * expectedHeight;
  expect(cellCount, `Expected ${expectedCells} cells (${expectedWidth}x${expectedHeight})`).toBe(
    expectedCells
  );
}

/**
 * Assert that all cells have consistent sizing (within 2px tolerance).
 */
export async function assertConsistentCellSizing(page: Page): Promise<void> {
  const sizes = await getUniqueCellSizes(page);
  expect(
    sizes.length,
    `Expected 1-2 unique cell sizes, found ${sizes.length}: ${sizes.join(', ')}`
  ).toBeLessThanOrEqual(2);
}

// ============================================================================
// Test Data Constants
// ============================================================================

/** Standard viewports for testing responsive behavior */
export const STANDARD_VIEWPORTS = {
  iPhoneSE: { width: 320, height: 568 },
  iPhone8: { width: 375, height: 667 },
  iPhone11: { width: 414, height: 896 },
  iPad: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
} as const;

/** Expected cell counts for pre-defined puzzles */
export const PUZZLE_CELL_COUNTS = {
  mini: 25, // 5x5
  standard: 225, // 15x15
  sunday: 441, // 21x21
  large: 625, // 25x25
  miniNoBlack: 25,
  standardSymmetric: 225,
  standardDense: 225,
  standardHalfFilled: 225,
  sundayNearComplete: 441,
} as const;
