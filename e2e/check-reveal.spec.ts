import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 7 Check/Reveal test suite
 *
 * Tests all check/reveal functionality including:
 * - Check letter (correct -> verified, incorrect -> error)
 * - Check word
 * - Check puzzle
 * - Reveal letter/word/puzzle
 * - Verified cell locking and navigation skip
 * - Auto-check mode
 * - P2P verification sync
 *
 * Sample puzzle grid reference:
 *   0   1   2   3   4
 * +---+---+---+---+---+
 * | S | T | A | R | . |  0  (1-ACROSS: STAR)
 * +---+---+---+---+---+
 * | P | . | L | O | W |  1  (4-ACROSS: LOW)
 * +---+---+---+---+---+
 * | A | I | L | S | . |  2  (5-ACROSS: AILS)
 * +---+---+---+---+---+
 * | M | . | E | . | . |  3
 * +---+---+---+---+---+
 * | . | T | O | P | S |  4  (6-ACROSS: TOPS)
 * +---+---+---+---+---+
 */

/**
 * Wait for the puzzle grid to be visible and interactive
 */
async function waitForPuzzleReady(page: Page): Promise<void> {
  await page.waitForSelector('.crossword-grid', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('.puzzle-loading', { state: 'hidden', timeout: 10000 });
}

/**
 * Click on a specific cell in the grid
 */
async function clickCell(page: Page, row: number, col: number): Promise<void> {
  const cell = page.locator(`.crossword-cell[data-row="${row}"][data-col="${col}"]`);
  await cell.click();
}

/**
 * Get the value displayed in a cell
 */
async function getCellValue(page: Page, row: number, col: number): Promise<string> {
  const cell = page.locator(`.crossword-cell[data-row="${row}"][data-col="${col}"]`);
  const letter = cell.locator('.cell-letter');
  return await letter.textContent() ?? '';
}

/**
 * Helper to clear IndexedDB for a clean test start
 */
async function clearIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
    localStorage.clear();
  });
}

test.describe('Check/Reveal Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear IndexedDB to ensure a clean state
    await clearIndexedDB(page);
    await page.reload();
    await waitForPuzzleReady(page);
  });

  test.describe('Check Letter', () => {
    test('marks correct letter as verified with green class', async ({ page }) => {
      // Click first cell (0,0) - solution is 'S'
      await clickCell(page, 0, 0);

      // Type the correct letter
      await page.keyboard.type('S');

      // Click back on first cell (cursor auto-advanced after typing)
      await clickCell(page, 0, 0);

      // Click Check > Letter
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-letter').click();

      // Verify cell has verified class
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--verified/);
    });

    test('marks incorrect letter as error with red class', async ({ page }) => {
      // Click first cell (0,0) - solution is 'S'
      await clickCell(page, 0, 0);

      // Type wrong letter
      await page.keyboard.type('Z');

      // Click back on first cell (cursor auto-advanced after typing)
      await clickCell(page, 0, 0);

      // Click Check > Letter
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-letter').click();

      // Verify cell has error class
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--error/);
    });

    test('error clears when letter is changed', async ({ page }) => {
      // Click first cell (0,0) and type wrong letter
      await clickCell(page, 0, 0);
      await page.keyboard.type('Z');

      // Click back on first cell (cursor auto-advanced after typing)
      await clickCell(page, 0, 0);

      // Check the letter
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-letter').click();

      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--error/);

      // Change the letter
      await clickCell(page, 0, 0);
      await page.keyboard.type('S');

      // Error should be cleared
      await expect(firstCell).not.toHaveClass(/cell--error/);
    });

    test('does nothing for empty cell', async ({ page }) => {
      // Click first cell but don't type anything
      await clickCell(page, 0, 0);

      // Check the letter
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-letter').click();

      // Cell should have neither verified nor error class
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).not.toHaveClass(/cell--verified/);
      await expect(firstCell).not.toHaveClass(/cell--error/);
    });
  });

  test.describe('Check Word', () => {
    test('checks all letters in current word', async ({ page }) => {
      // Click first cell and type first word (STAR)
      await clickCell(page, 0, 0);
      await page.keyboard.type('STAR');

      // Go back to first cell and check word
      await clickCell(page, 0, 0);
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-word').click();

      // All cells in STAR should be verified
      for (let col = 0; col < 4; col++) {
        const cell = page.locator(`.crossword-cell[data-row="0"][data-col="${col}"]`);
        await expect(cell).toHaveClass(/cell--verified/);
      }
    });

    test('marks mix of correct and incorrect letters', async ({ page }) => {
      // Click first cell and type partially correct word
      await clickCell(page, 0, 0);
      await page.keyboard.type('STOP'); // Correct: STAR

      // Go back to first cell and check word
      await clickCell(page, 0, 0);
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-word').click();

      // S and T are correct, O and P are wrong
      const cell0 = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const cell1 = page.locator('.crossword-cell[data-row="0"][data-col="1"]');
      const cell2 = page.locator('.crossword-cell[data-row="0"][data-col="2"]');
      const cell3 = page.locator('.crossword-cell[data-row="0"][data-col="3"]');

      await expect(cell0).toHaveClass(/cell--verified/); // S is correct
      await expect(cell1).toHaveClass(/cell--verified/); // T is correct
      await expect(cell2).toHaveClass(/cell--error/);    // O should be A
      await expect(cell3).toHaveClass(/cell--error/);    // P should be R
    });
  });

  test.describe('Reveal Letter', () => {
    test('reveals correct letter and marks as verified', async ({ page }) => {
      // Click first cell
      await clickCell(page, 0, 0);

      // Reveal the letter
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-letter').click();

      // Check cell has verified class and correct letter
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--verified/);
      await expect(firstCell.locator('.cell-letter')).toHaveText('S');
    });

    test('revealed cell is locked - cannot be deleted', async ({ page }) => {
      // Reveal first cell
      await clickCell(page, 0, 0);
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-letter').click();

      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const letterBefore = await firstCell.locator('.cell-letter').textContent();

      // Try to delete
      await clickCell(page, 0, 0);
      await page.keyboard.press('Backspace');

      // Letter should remain unchanged
      const letterAfter = await firstCell.locator('.cell-letter').textContent();
      expect(letterAfter).toBe(letterBefore);
    });

    test('revealed cell is locked - cannot be overwritten', async ({ page }) => {
      // Reveal first cell
      await clickCell(page, 0, 0);
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-letter').click();

      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const letterBefore = await firstCell.locator('.cell-letter').textContent();

      // Try to type over it
      await clickCell(page, 0, 0);
      await page.keyboard.type('X');

      // Letter should remain unchanged (cursor moved to next cell)
      const letterAfter = await firstCell.locator('.cell-letter').textContent();
      expect(letterAfter).toBe(letterBefore);
    });
  });

  test.describe('Reveal Word', () => {
    test('reveals all letters in current word', async ({ page }) => {
      // Click first cell
      await clickCell(page, 0, 0);

      // Reveal the word
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-word').click();

      // All cells in STAR should be verified with correct letters
      const expectedLetters = ['S', 'T', 'A', 'R'];
      for (let col = 0; col < 4; col++) {
        const cell = page.locator(`.crossword-cell[data-row="0"][data-col="${col}"]`);
        await expect(cell).toHaveClass(/cell--verified/);
        await expect(cell.locator('.cell-letter')).toHaveText(expectedLetters[col]);
      }
    });
  });

  test.describe('Verified Cell Navigation', () => {
    test('typing skips verified cells in word direction', async ({ page }) => {
      // Reveal first and second cells of first word (STAR)
      // First reveal cell (0,0)
      await clickCell(page, 0, 0);
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-letter').click();

      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--verified/);

      // Now reveal cell (0,1) as well
      await clickCell(page, 0, 1);
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-letter').click();

      const secondCell = page.locator('.crossword-cell[data-row="0"][data-col="1"]');
      await expect(secondCell).toHaveClass(/cell--verified/);

      // Now click on cell (0,0) and type - should skip both verified cells
      // and land on cell (0,2)
      await clickCell(page, 0, 0);
      // First keypress advances from (0,0) to (0,2) skipping verified (0,1)
      await page.keyboard.type('X');
      // Second keypress types X in (0,2) and advances to (0,3)
      await page.keyboard.type('X');

      // Cell (0,2) should have X (we typed twice: first moved us there, second typed)
      const thirdCell = page.locator('.crossword-cell[data-row="0"][data-col="2"]');
      await expect(thirdCell.locator('.cell-letter')).toHaveText('X');

      // First two cells should still have revealed letters
      await expect(firstCell.locator('.cell-letter')).toHaveText('S');
      await expect(secondCell.locator('.cell-letter')).toHaveText('T');
    });

    test('backspace skips verified cells', async ({ page }) => {
      // Type in first two cells
      await clickCell(page, 0, 0);
      await page.keyboard.type('ST');

      // Verify first cell (S)
      await clickCell(page, 0, 0);
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-letter').click();

      // Move to cell 2 and press backspace
      await clickCell(page, 0, 2);
      await page.keyboard.press('Backspace');

      // Should have cleared cell 1 (T), not cell 0 (S which is verified)
      const cell0 = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const cell1 = page.locator('.crossword-cell[data-row="0"][data-col="1"]');

      await expect(cell0.locator('.cell-letter')).toHaveText('S');
      await expect(cell1.locator('.cell-letter')).toHaveText('');
    });
  });

  test.describe('Auto-Check Mode', () => {
    test('toggles auto-check mode', async ({ page }) => {
      const toggle = page.getByTestId('auto-check-toggle');
      const checkbox = toggle.locator('input');

      await expect(checkbox).not.toBeChecked();
      await toggle.click();
      await expect(checkbox).toBeChecked();
      await toggle.click();
      await expect(checkbox).not.toBeChecked();
    });

    test('auto-check shows errors as you type', async ({ page }) => {
      // Enable auto-check
      await page.getByTestId('auto-check-toggle').click();

      // Click first cell and type wrong letter
      await clickCell(page, 0, 0);
      await page.keyboard.type('Z');

      // Should immediately show error (no manual check needed)
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).toHaveClass(/cell--error/);
    });

    test('auto-check does not mark correct letters as error', async ({ page }) => {
      // Enable auto-check
      await page.getByTestId('auto-check-toggle').click();

      // Click first cell and type correct letter
      await clickCell(page, 0, 0);
      await page.keyboard.type('S');

      // Move back to check the first cell (auto-advance moved us)
      await clickCell(page, 0, 0);

      // Should not have error class
      const firstCell = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(firstCell).not.toHaveClass(/cell--error/);
    });
  });

  test.describe('Check/Reveal Puzzle', () => {
    test('check puzzle marks all filled cells', async ({ page }) => {
      // Fill first row with correct and incorrect letters
      await clickCell(page, 0, 0);
      await page.keyboard.type('STOP'); // Correct: STAR

      // Check puzzle
      await page.getByTestId('check-button').click();
      await page.getByTestId('check-puzzle').click();

      // Should have mix of verified and error cells
      const cell0 = page.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const cell2 = page.locator('.crossword-cell[data-row="0"][data-col="2"]');

      await expect(cell0).toHaveClass(/cell--verified/); // S is correct
      await expect(cell2).toHaveClass(/cell--error/);    // O should be A
    });

    test('reveal puzzle fills all cells', async ({ page }) => {
      // Reveal entire puzzle
      await page.getByTestId('reveal-button').click();
      await page.getByTestId('reveal-puzzle').click();

      // All non-black cells should be verified
      const whiteCells = page.locator('.crossword-cell:not(.cell--black)');
      const whiteCount = await whiteCells.count();

      const verifiedCells = page.locator('.cell--verified');
      const verifiedCount = await verifiedCells.count();

      expect(verifiedCount).toBe(whiteCount);

      // Spot check some cells
      await expect(page.locator('.crossword-cell[data-row="0"][data-col="0"] .cell-letter')).toHaveText('S');
      await expect(page.locator('.crossword-cell[data-row="0"][data-col="1"] .cell-letter')).toHaveText('T');
      await expect(page.locator('.crossword-cell[data-row="0"][data-col="2"] .cell-letter')).toHaveText('A');
      await expect(page.locator('.crossword-cell[data-row="0"][data-col="3"] .cell-letter')).toHaveText('R');
    });
  });

  test.describe('Dropdown Menu Behavior', () => {
    test('clicking outside closes menu', async ({ page }) => {
      // Open check menu
      await page.getByTestId('check-button').click();

      // Menu should be visible
      const checkLetter = page.getByTestId('check-letter');
      await expect(checkLetter).toBeVisible();

      // Click outside (on header)
      await page.locator('h1').click();

      // Menu should be hidden
      await expect(checkLetter).not.toBeVisible();
    });

    test('opening one menu closes the other', async ({ page }) => {
      // Open check menu
      await page.getByTestId('check-button').click();
      const checkLetter = page.getByTestId('check-letter');
      await expect(checkLetter).toBeVisible();

      // Open reveal menu
      await page.getByTestId('reveal-button').click();
      const revealLetter = page.getByTestId('reveal-letter');

      // Check menu should be closed, reveal menu should be open
      await expect(checkLetter).not.toBeVisible();
      await expect(revealLetter).toBeVisible();
    });
  });
});

test.describe('P2P Verification Sync', () => {
  test('verified state syncs between peers', async ({ browser }) => {
    const roomId = `verify-sync-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both pages connect to same room
      await page1.goto(url);
      await page2.goto(url);

      await waitForPuzzleReady(page1);
      await waitForPuzzleReady(page2);

      // Wait for connection
      await page1.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });
      await page2.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });

      // Wait for awareness sync
      await page1.waitForTimeout(3000);

      // Page 1 reveals a letter
      await clickCell(page1, 0, 0);
      await page1.getByTestId('reveal-button').click();
      await page1.getByTestId('reveal-letter').click();

      // Page 1 should show verified
      const cell1 = page1.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(cell1).toHaveClass(/cell--verified/);

      // Page 2 should also show verified after sync
      const cell2 = page2.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(cell2).toHaveClass(/cell--verified/, { timeout: 5000 });

      // Both should have the same letter
      await expect(cell1.locator('.cell-letter')).toHaveText('S');
      await expect(cell2.locator('.cell-letter')).toHaveText('S');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('error state syncs between peers', async ({ browser }) => {
    const roomId = `error-sync-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await page1.goto(url);
      await page2.goto(url);

      await waitForPuzzleReady(page1);
      await waitForPuzzleReady(page2);

      await page1.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });
      await page2.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });

      await page1.waitForTimeout(3000);

      // Page 1 types wrong letter and checks
      await clickCell(page1, 0, 0);
      await page1.keyboard.type('Z');

      // Click back on first cell (cursor auto-advanced after typing)
      await clickCell(page1, 0, 0);

      await page1.getByTestId('check-button').click();
      await page1.getByTestId('check-letter').click();

      // Page 1 should show error
      const cell1 = page1.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(cell1).toHaveClass(/cell--error/);

      // Page 2 should also show error after sync
      const cell2 = page2.locator('.crossword-cell[data-row="0"][data-col="0"]');
      await expect(cell2).toHaveClass(/cell--error/, { timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('one peer can fix error created by another', async ({ browser }) => {
    const roomId = `fix-error-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      await page1.goto(url);
      await page2.goto(url);

      await waitForPuzzleReady(page1);
      await waitForPuzzleReady(page2);

      await page1.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });
      await page2.waitForSelector('.connection-indicator[data-connection-state="connected"]', { timeout: 15000 });

      await page1.waitForTimeout(3000);

      // Page 1 types wrong letter and checks
      await clickCell(page1, 0, 0);
      await page1.keyboard.type('Z');

      // Click back on first cell (cursor auto-advanced after typing)
      await clickCell(page1, 0, 0);

      await page1.getByTestId('check-button').click();
      await page1.getByTestId('check-letter').click();

      // Wait for sync
      await page1.waitForTimeout(2000);

      // Page 2 fixes the error by typing correct letter
      await clickCell(page2, 0, 0);
      await page2.keyboard.type('S');

      // Wait for sync
      await page2.waitForTimeout(2000);

      // Both should no longer show error
      const cell1 = page1.locator('.crossword-cell[data-row="0"][data-col="0"]');
      const cell2 = page2.locator('.crossword-cell[data-row="0"][data-col="0"]');

      await expect(cell1).not.toHaveClass(/cell--error/);
      await expect(cell2).not.toHaveClass(/cell--error/);

      // Both should have the correct letter
      await expect(cell1.locator('.cell-letter')).toHaveText('S');
      await expect(cell2.locator('.cell-letter')).toHaveText('S');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
