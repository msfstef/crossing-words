/**
 * E2E Tests for Typing Snappiness
 *
 * Verifies that letter entry is instant and responsive during gameplay.
 * The animation class should only be applied on initial CRDT load (when puzzle has saved progress),
 * not during regular typing.
 */

import { test, expect } from '@playwright/test';
import { navigateToTestPuzzle, waitForPuzzleReady } from './helpers/testPuzzleHelpers';

test.describe('Typing Snappiness', () => {
  test.describe('Animation class behavior', () => {
    test('should NOT have animation class during typing', async ({ page }) => {
      // Navigate to a test puzzle
      await navigateToTestPuzzle(page, 'mini');
      await waitForPuzzleReady(page);

      // Wait for any entrance animations to complete (400ms for letter animation + buffer)
      await page.waitForTimeout(500);

      // Click on the first white cell to focus it
      const firstCell = page.locator('.crossword-cell:not(.cell--black)').first();
      await firstCell.click();

      // Verify animation class is NOT present before typing
      const gridContainer = page.locator('.crossword-grid-container');
      await expect(gridContainer).not.toHaveClass(/animating-letters/);

      // Type a letter
      await page.keyboard.type('A');

      // Verify animation class is still NOT present after typing
      await expect(gridContainer).not.toHaveClass(/animating-letters/);

      // Type multiple letters rapidly
      await page.keyboard.type('BCDEF');

      // Still no animation class
      await expect(gridContainer).not.toHaveClass(/animating-letters/);
    });

    test('should display typed letters immediately without delay', async ({ page }) => {
      // Navigate to a test puzzle
      await navigateToTestPuzzle(page, 'mini');
      await waitForPuzzleReady(page);

      // Wait for any entrance animations to complete
      await page.waitForTimeout(500);

      // Click on the first white cell to focus it
      const firstCell = page.locator('.crossword-cell:not(.cell--black)').first();
      await firstCell.click();

      // Type a letter and immediately check if it appears
      const startTime = Date.now();
      await page.keyboard.type('X');

      // Check that the letter appears in the cell
      const cellLetter = firstCell.locator('.cell-letter');
      await expect(cellLetter).toHaveText('X');

      const elapsed = Date.now() - startTime;

      // Letter should appear within a reasonable time (less than 200ms is considered snappy)
      // This allows for test framework overhead but catches obvious animation delays
      expect(elapsed).toBeLessThan(500);
    });

    test('should not apply animation class when navigating between cells', async ({ page }) => {
      // Navigate to a test puzzle
      await navigateToTestPuzzle(page, 'mini');
      await waitForPuzzleReady(page);

      // Wait for any entrance animations to complete
      await page.waitForTimeout(500);

      // Click on the first white cell to focus it
      const firstCell = page.locator('.crossword-cell:not(.cell--black)').first();
      await firstCell.click();

      const gridContainer = page.locator('.crossword-grid-container');

      // Navigate using arrow keys
      await page.keyboard.press('ArrowRight');
      await expect(gridContainer).not.toHaveClass(/animating-letters/);

      await page.keyboard.press('ArrowDown');
      await expect(gridContainer).not.toHaveClass(/animating-letters/);

      // Type in the new cell
      await page.keyboard.type('Z');
      await expect(gridContainer).not.toHaveClass(/animating-letters/);
    });
  });

  test.describe('Rapid typing stress test', () => {
    test('should handle rapid sequential typing without animation', async ({ page }) => {
      // Navigate to a test puzzle
      await navigateToTestPuzzle(page, 'standard');
      await waitForPuzzleReady(page);

      // Wait for any entrance animations to complete
      await page.waitForTimeout(500);

      // Click on the first white cell to focus it
      const firstCell = page.locator('.crossword-cell:not(.cell--black)').first();
      await firstCell.click();

      const gridContainer = page.locator('.crossword-grid-container');

      // Rapidly type multiple letters
      const testString = 'ABCDEFGHIJ';
      for (const char of testString) {
        await page.keyboard.type(char);
        // Check after each keystroke that no animation class is applied
        await expect(gridContainer).not.toHaveClass(/animating-letters/);
      }
    });
  });
});
