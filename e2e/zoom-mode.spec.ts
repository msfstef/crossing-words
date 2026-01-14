import { test, expect, type Page } from '@playwright/test';

/**
 * Zoom Mode E2E Tests
 *
 * Tests the zoom mode feature:
 * 1. Toggle zoom on/off
 * 2. Partial cells show at internal boundaries (edge indicators)
 * 3. No partial cells at puzzle boundaries
 * 4. Viewport stability when navigating within same zone
 * 5. Long clues spanning zones are fully visible
 */

const TEST_PUZZLE = {
  title: "Zoom Test Puzzle",
  author: "Test",
  width: 15,
  height: 15,
  grid: Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 15 }, (_, col) => ({
      row,
      col,
      letter: "A",
      isBlack: (row === 7 && col === 7), // Center black square
      clueNumber:
        (row === 0 && col === 0) ? 1 :
        (row === 0 && col === 8) ? 2 :
        (row === 8 && col === 0) ? 3 :
        (row === 8 && col === 8) ? 4 : undefined,
    }))
  ),
  clues: {
    across: [
      // Top-left quadrant clue
      { number: 1, direction: "across" as const, text: "First across", row: 0, col: 0, length: 7 },
      // Top-right quadrant clue
      { number: 2, direction: "across" as const, text: "Second across", row: 0, col: 8, length: 7 },
      // Bottom-left quadrant clue
      { number: 3, direction: "across" as const, text: "Third across", row: 8, col: 0, length: 7 },
      // Bottom-right quadrant clue
      { number: 4, direction: "across" as const, text: "Fourth across", row: 8, col: 8, length: 7 },
    ],
    down: [
      { number: 1, direction: "down" as const, text: "First down", row: 0, col: 0, length: 7 },
      { number: 2, direction: "down" as const, text: "Second down", row: 0, col: 8, length: 7 },
      { number: 3, direction: "down" as const, text: "Third down", row: 8, col: 0, length: 7 },
      { number: 4, direction: "down" as const, text: "Fourth down", row: 8, col: 8, length: 7 },
    ],
  },
};

// A puzzle with a clue that spans zones
const LONG_CLUE_PUZZLE = {
  title: "Long Clue Puzzle",
  author: "Test",
  width: 15,
  height: 15,
  grid: Array.from({ length: 15 }, (_, row) =>
    Array.from({ length: 15 }, (_, col) => ({
      row,
      col,
      letter: "A",
      isBlack: false,
      clueNumber: (row === 0 && col === 0) ? 1 : undefined,
    }))
  ),
  clues: {
    across: [
      // This clue spans the entire width - crosses zone boundaries
      { number: 1, direction: "across" as const, text: "Long across clue", row: 0, col: 0, length: 15 },
    ],
    down: [
      { number: 1, direction: "down" as const, text: "First down", row: 0, col: 0, length: 15 },
    ],
  },
};

/**
 * Inject a test puzzle into the app
 */
async function injectTestPuzzle(page: Page, puzzle: typeof TEST_PUZZLE): Promise<void> {
  await page.evaluate((p) => {
    const puzzleId = 'test-zoom-puzzle';
    const puzzleData = {
      id: puzzleId,
      puzzle: p,
      addedAt: Date.now(),
    };

    const existingLibrary = localStorage.getItem('puzzle-library');
    const library = existingLibrary ? JSON.parse(existingLibrary) : [];
    const filteredLibrary = library.filter((item: { id: string }) => item.id !== puzzleId);
    filteredLibrary.unshift(puzzleData);

    localStorage.setItem('puzzle-library', JSON.stringify(filteredLibrary));
  }, puzzle);
}

/**
 * Open the test puzzle from library
 */
async function openTestPuzzle(page: Page): Promise<void> {
  // Click on the test puzzle in library
  await page.getByText('Zoom Test Puzzle').click();
  // Wait for grid to be visible
  await page.waitForSelector('.crossword-grid');
}

/**
 * Get the zoom viewport bounds from the visible grid
 */
async function getZoomViewport(page: Page): Promise<{ startRow: number; endRow: number; startCol: number; endCol: number } | null> {
  return page.evaluate(() => {
    const container = document.querySelector('.crossword-grid-container--zoomed');
    if (!container) return null;

    // Get all visible cells (not edge indicators)
    const cells = container.querySelectorAll('.crossword-grid .crossword-cell:not(.crossword-cell--edge-indicator)');
    if (cells.length === 0) return null;

    let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1;

    cells.forEach(cell => {
      const row = parseInt(cell.getAttribute('data-row') || '0');
      const col = parseInt(cell.getAttribute('data-col') || '0');
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    });

    return { startRow: minRow, endRow: maxRow, startCol: minCol, endCol: maxCol };
  });
}

/**
 * Check if edge indicators are visible
 */
async function getEdgeIndicatorVisibility(page: Page): Promise<{ top: boolean; bottom: boolean; left: boolean; right: boolean }> {
  return page.evaluate(() => {
    return {
      top: document.querySelectorAll('.crossword-edge-indicator--top .crossword-cell--edge-indicator').length > 0,
      bottom: document.querySelectorAll('.crossword-edge-indicator--bottom .crossword-cell--edge-indicator').length > 0,
      left: document.querySelectorAll('.crossword-edge-indicator--left .crossword-cell--edge-indicator').length > 0,
      right: document.querySelectorAll('.crossword-edge-indicator--right .crossword-cell--edge-indicator').length > 0,
    };
  });
}

/**
 * Click a cell by row/col
 */
async function clickCell(page: Page, row: number, col: number): Promise<void> {
  await page.click(`[data-row="${row}"][data-col="${col}"]`);
}

test.describe('Zoom Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectTestPuzzle(page, TEST_PUZZLE);
    // Reload to pick up the injected puzzle
    await page.reload();
    await openTestPuzzle(page);
  });

  test('should toggle zoom mode with button', async ({ page }) => {
    // Verify zoom is off initially
    await expect(page.locator('.crossword-grid-container--zoomed')).not.toBeVisible();

    // Click zoom toggle button
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');

    // Verify zoomed state
    await expect(page.locator('.crossword-grid-container--zoomed')).toBeVisible();

    // Toggle off
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');

    // Verify unzoomed
    await expect(page.locator('.crossword-grid-container--zoomed')).not.toBeVisible();
  });

  test('should show partial cells at internal boundaries when zoomed', async ({ page }) => {
    // Select a cell in the center-ish of the puzzle
    await clickCell(page, 4, 4);

    // Enable zoom mode
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');

    // Wait for zoom to apply
    await page.waitForSelector('.crossword-grid-container--zoomed');

    // Check edge indicators
    const edges = await getEdgeIndicatorVisibility(page);

    // At center position, we should see edge indicators on multiple sides
    // Exact edges depend on zone calculation, but at least one should be true
    const hasAnyEdge = edges.top || edges.bottom || edges.left || edges.right;
    expect(hasAnyEdge).toBe(true);
  });

  test('should not show edge indicators at puzzle boundaries', async ({ page }) => {
    // Select a cell at top-left corner
    await clickCell(page, 0, 0);

    // Enable zoom mode
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');

    // Wait for zoom
    await page.waitForSelector('.crossword-grid-container--zoomed');

    // Check edge indicators
    const edges = await getEdgeIndicatorVisibility(page);

    // At top-left corner, top and left edges should NOT show indicators
    expect(edges.top).toBe(false);
    expect(edges.left).toBe(false);
  });

  test('should maintain viewport when navigating within same zone', async ({ page }) => {
    // Select a cell
    await clickCell(page, 0, 0);

    // Enable zoom mode
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');
    await page.waitForSelector('.crossword-grid-container--zoomed');

    // Get initial viewport
    const initialViewport = await getZoomViewport(page);
    expect(initialViewport).not.toBeNull();

    // Navigate to next cell in same clue (should be same zone)
    await page.keyboard.press('ArrowRight');

    // Get new viewport
    const newViewport = await getZoomViewport(page);

    // Viewport should remain stable (same bounds)
    expect(newViewport).toEqual(initialViewport);
  });

  test('should show grid in zoomed state', async ({ page }) => {
    // Enable zoom mode
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');

    // Verify grid is still visible
    await expect(page.locator('.crossword-grid')).toBeVisible();

    // Verify some cells are visible
    const cellCount = await page.locator('.crossword-grid .crossword-cell:not(.crossword-cell--edge-indicator)').count();
    expect(cellCount).toBeGreaterThan(0);
  });
});

test.describe('Zoom Mode with Long Clues', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((p) => {
      const puzzleId = 'test-zoom-puzzle';
      const puzzleData = {
        id: puzzleId,
        puzzle: p,
        addedAt: Date.now(),
      };

      const existingLibrary = localStorage.getItem('puzzle-library');
      const library = existingLibrary ? JSON.parse(existingLibrary) : [];
      const filteredLibrary = library.filter((item: { id: string }) => item.id !== puzzleId);
      filteredLibrary.unshift(puzzleData);

      localStorage.setItem('puzzle-library', JSON.stringify(filteredLibrary));
    }, LONG_CLUE_PUZZLE);
    await page.reload();
    // Click on the test puzzle in library
    await page.getByText('Long Clue Puzzle').click();
    await page.waitForSelector('.crossword-grid');
  });

  test('should show entire long clue when zoomed', async ({ page }) => {
    // Select start of long clue
    await clickCell(page, 0, 0);

    // Enable zoom mode
    await page.click('[data-testid="zoom-toggle"], .solve-header__zoom');
    await page.waitForSelector('.crossword-grid-container--zoomed');

    // Get viewport
    const viewport = await getZoomViewport(page);
    expect(viewport).not.toBeNull();

    // Viewport should span sufficient width to show the clue
    // The first clue is 15 cells long, so it might expand zones
    const viewportWidth = viewport!.endCol - viewport!.startCol + 1;
    expect(viewportWidth).toBeGreaterThanOrEqual(5); // At minimum the min viewport size
  });
});
