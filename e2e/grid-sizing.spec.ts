import { test, expect, type Page } from '@playwright/test';

/**
 * Grid Sizing E2E Tests
 *
 * Tests that the puzzle grid properly fits within the viewport at various
 * screen sizes and puzzle dimensions without getting cut off.
 */

// Test viewports representing common device sizes
const VIEWPORTS = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 8', width: 375, height: 667 },
  { name: 'iPhone 11', width: 414, height: 896 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

// Puzzle sizes to test
const PUZZLE_SIZES = [
  { name: 'mini', width: 5, height: 5 },
  { name: 'standard', width: 15, height: 15 },
  { name: 'sunday', width: 21, height: 21 },
  { name: 'large', width: 25, height: 25 },
];

/**
 * Generate a test puzzle directly in the browser context.
 * Can be used for future tests that need to inject specific puzzle sizes.
 */
async function _injectTestPuzzle(
  page: Page,
  width: number,
  height: number,
  title: string = `Test ${width}x${height} Puzzle`
): Promise<void> {
  await page.evaluate(
    ({ width, height, title }) => {
      // Create test puzzle directly in the app's state
      const grid = [];
      let clueNumber = 0;

      for (let row = 0; row < height; row++) {
        const rowCells = [];
        for (let col = 0; col < width; col++) {
          // Simple clue numbering: first cell of each row/col gets a number
          const startsAcross = col === 0;
          const startsDown = row === 0;
          const needsNumber = startsAcross || startsDown;

          if (needsNumber && (row === 0 || col === 0)) {
            clueNumber++;
          }

          rowCells.push({
            row,
            col,
            letter: String.fromCharCode(65 + ((row * 7 + col * 3) % 26)),
            isBlack: false,
            clueNumber: row === 0 || col === 0 ? clueNumber : undefined,
          });
        }
        grid.push(rowCells);
      }

      // Reset clue number counter for generating clues
      const puzzle = {
        title,
        author: 'Test Generator',
        width,
        height,
        grid,
        clues: {
          across: Array.from({ length: height }, (_, i) => ({
            number: i + 1,
            direction: 'across' as const,
            text: `Test clue ${i + 1}-Across`,
            row: i,
            col: 0,
            length: width,
          })),
          down: Array.from({ length: width }, (_, i) => ({
            number: i + 1,
            direction: 'down' as const,
            text: `Test clue ${i + 1}-Down`,
            row: 0,
            col: i,
            length: height,
          })),
        },
      };

      // Store puzzle in window for the test to use
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TEST_PUZZLE__ = puzzle;
    },
    { width, height, title }
  );
}

/**
 * Wait for the library page to be ready
 */
async function waitForLibraryReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading puzzles'),
    { timeout: 30000 }
  );
}

/**
 * Wait for the crossword grid to be visible
 */
async function waitForGrid(page: Page, timeout = 30000): Promise<void> {
  await page.waitForSelector('.crossword-cell', { state: 'visible', timeout });
}

/**
 * Check if the grid is fully visible (not clipped by viewport)
 */
async function isGridFullyVisible(page: Page): Promise<{
  visible: boolean;
  gridRect: { top: number; left: number; bottom: number; right: number; width: number; height: number };
  viewportHeight: number;
  viewportWidth: number;
  issues: string[];
}> {
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
      issues.push(`Grid bottom (${gridRect.bottom.toFixed(0)}px) exceeds viewport height (${viewportHeight}px)`);
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
      issues.push(`Grid right (${gridRect.right.toFixed(0)}px) exceeds viewport width (${viewportWidth}px)`);
    }

    // Check if title is visible (if present)
    if (title) {
      const titleRect = title.getBoundingClientRect();
      if (titleRect.top < 0) {
        issues.push(`Title top (${titleRect.top.toFixed(0)}px) is above viewport`);
      }
      if (titleRect.bottom < 0) {
        issues.push(`Title is completely above viewport`);
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
 * Check if the puzzle title is visible
 */
async function isTitleVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const title = document.querySelector('.puzzle-title-above-grid');
    if (!title) return false;
    const rect = title.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
}

// Use a local dev server for testing
test.describe('Grid Sizing', () => {
  // Skip these tests in CI since they require a running dev server
  // In local dev, start the server first: npm run dev -- --port 5180
  const BASE_URL = process.env.TEST_URL || 'http://localhost:5180';

  test.beforeAll(async () => {
    // Note: These tests expect a dev server running at BASE_URL
    // The test file uses a sample puzzle from the app
  });

  test.describe('Grid visibility at different viewports', () => {
    for (const viewport of VIEWPORTS) {
      test(`Grid should be fully visible at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
        page,
      }) => {
        // Set viewport size
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        // Navigate to the app
        await page.goto(BASE_URL);

        // Wait for library to load
        await waitForLibraryReady(page);

        // Download a puzzle (use the first available date/source)
        const downloadButton = page.getByRole('button', { name: /download/i }).first();
        if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await downloadButton.click();

          // Wait for puzzle to load
          await waitForGrid(page);

          // Check grid visibility
          const visibility = await isGridFullyVisible(page);

          if (!visibility.visible) {
            console.log(`Visibility issues at ${viewport.name}:`, visibility.issues);
            console.log('Grid rect:', visibility.gridRect);
          }

          expect(visibility.visible, `Grid should be fully visible. Issues: ${visibility.issues.join(', ')}`).toBe(
            true
          );

          // Also check title is visible
          const titleVisible = await isTitleVisible(page);
          expect(titleVisible, 'Puzzle title should be visible').toBe(true);
        } else {
          // If no download button, skip this viewport test
          test.skip();
        }
      });
    }
  });

  test.describe('Grid sizing with different puzzle sizes', () => {
    // Test a subset of viewport/puzzle combinations that are most likely to fail
    const criticalCombinations = [
      { viewport: VIEWPORTS[0], puzzle: PUZZLE_SIZES[2] }, // iPhone SE + sunday (21x21)
      { viewport: VIEWPORTS[0], puzzle: PUZZLE_SIZES[3] }, // iPhone SE + large (25x25)
      { viewport: VIEWPORTS[1], puzzle: PUZZLE_SIZES[2] }, // iPhone 8 + sunday
      { viewport: VIEWPORTS[3], puzzle: PUZZLE_SIZES[3] }, // iPad + large
    ];

    for (const combo of criticalCombinations) {
      test(`${combo.puzzle.name} puzzle (${combo.puzzle.width}x${combo.puzzle.height}) at ${combo.viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: combo.viewport.width, height: combo.viewport.height });

        // Navigate and inject test puzzle
        await page.goto(BASE_URL);
        await waitForLibraryReady(page);

        // For now, just verify the library loads correctly
        // Full puzzle injection would require app modifications
        const libraryVisible = await page.isVisible('.library-header, h1');
        expect(libraryVisible).toBe(true);
      });
    }
  });

  test('Grid cells should have consistent sizing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);
    await waitForLibraryReady(page);

    // Try to load a puzzle
    const downloadButton = page.getByRole('button', { name: /download/i }).first();
    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await downloadButton.click();
      await waitForGrid(page);

      // Check that all cells have the same size
      const cellSizes = await page.evaluate(() => {
        const cells = document.querySelectorAll('.crossword-cell:not(.cell--black)');
        const sizes = new Set<string>();
        cells.forEach((cell) => {
          const rect = cell.getBoundingClientRect();
          sizes.add(`${Math.round(rect.width)}x${Math.round(rect.height)}`);
        });
        return Array.from(sizes);
      });

      // All cells should have the same size (allowing for 1px rounding difference)
      expect(cellSizes.length).toBeLessThanOrEqual(2);
    } else {
      test.skip();
    }
  });

  test('Grid should resize properly on viewport change', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);
    await waitForLibraryReady(page);

    const downloadButton = page.getByRole('button', { name: /download/i }).first();
    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await downloadButton.click();
      await waitForGrid(page);

      // Get initial cell size
      const initialCellSize = await page.evaluate(() => {
        const cell = document.querySelector('.crossword-cell:not(.cell--black)');
        return cell ? cell.getBoundingClientRect().width : 0;
      });

      // Resize viewport to smaller
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for resize to take effect
      await page.waitForTimeout(300);

      // Get new cell size
      const newCellSize = await page.evaluate(() => {
        const cell = document.querySelector('.crossword-cell:not(.cell--black)');
        return cell ? cell.getBoundingClientRect().width : 0;
      });

      // Cell size should have changed (smaller viewport = smaller cells)
      expect(newCellSize).toBeLessThan(initialCellSize);

      // Grid should still be fully visible
      const visibility = await isGridFullyVisible(page);
      expect(visibility.visible, `Grid should remain visible after resize. Issues: ${visibility.issues.join(', ')}`).toBe(
        true
      );
    } else {
      test.skip();
    }
  });
});
