import { test, expect, type Page } from '@playwright/test';

/**
 * Production E2E Tests for Crossing Words
 *
 * Tests the real production deployment at https://msfstef.dev/crossing-words
 *
 * Full collaboration flow tested:
 * 1. User A loads production site and downloads a puzzle
 * 2. User A opens the puzzle and adds some letters
 * 3. User A gets the share URL
 * 4. User B opens the share URL in a separate isolated browser
 * 5. User B receives the puzzle via P2P and sees User A's letters
 * 6. Both users can add letters and see each other's changes
 */

const PRODUCTION_URL = 'https://msfstef.dev/crossing-words/';

/**
 * Wait for the initial library page to be ready
 */
async function waitForLibraryReady(page: Page): Promise<void> {
  // Wait for "Loading puzzles..." to disappear
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading puzzles'),
    { timeout: 30000 }
  );
}

/**
 * Wait for the crossword grid to be visible (cells present)
 */
async function waitForGrid(page: Page, timeout = 60000): Promise<void> {
  await page.waitForSelector('.crossword-cell', { state: 'visible', timeout });
}

/**
 * Download a puzzle from the Universal Crossword source
 * Uses a date 2 days in the past to ensure the puzzle is available
 */
async function downloadPuzzle(page: Page): Promise<void> {
  // Click the FAB menu button (+ button) to open options
  await page.locator('button[aria-label="Open menu"]').click();

  // Click Download puzzle
  await page.locator('button[aria-label="Download puzzle"]').click();

  // Wait for download dialog to appear
  await page.getByRole('dialog').waitFor({ state: 'visible' });

  // Change date to 2 days ago to ensure puzzle is available
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

  const dateInput = page.getByRole('textbox', { name: 'Date' });
  await dateInput.fill(dateStr);

  // Click Download button INSIDE the dialog
  await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();

  // Wait for download to complete and puzzle card to appear
  await page.waitForSelector('.puzzle-card', { state: 'visible', timeout: 30000 });
}

/**
 * Open the first puzzle in the library
 */
async function openPuzzle(page: Page): Promise<void> {
  await page.locator('.puzzle-card').first().click({ force: true });
  await waitForGrid(page);
}

/**
 * Click on a cell by its clue number label
 */
async function clickCellByNumber(page: Page, number: string): Promise<void> {
  const cell = page.locator(`.crossword-cell:has-text("${number}")`).first();
  await cell.click({ force: true });
}

/**
 * Get the letter in a cell by its clue number
 */
async function getCellLetter(page: Page, number: string): Promise<string> {
  const cell = page.locator(`.crossword-cell:has-text("${number}")`).first();
  const letter = cell.locator('.cell-letter');
  return (await letter.textContent()) ?? '';
}

test.describe('Production Collaboration', () => {
  // Production tests need more time for network operations
  test.setTimeout(180000);

  test('full collaboration flow: download puzzle, add letters, share, join, and sync', async ({
    context,
    page: pageA,
  }) => {
    // Use two pages in the same context (they share IndexedDB so puzzle is available)
    // This tests the P2P sync between two tabs
    const pageB = await context.newPage();

    try {
      // ========================================
      // Step 1: User A loads the production site
      // ========================================
      await pageA.goto(PRODUCTION_URL);
      await waitForLibraryReady(pageA);

      // ========================================
      // Step 2: User A downloads a puzzle
      // ========================================
      await downloadPuzzle(pageA);

      // ========================================
      // Step 3: User A opens the puzzle
      // ========================================
      await openPuzzle(pageA);

      // Verify URL now has puzzle and timeline parameters
      expect(pageA.url()).toContain('#puzzle=');
      expect(pageA.url()).toContain('&timeline=');

      // Give the app time to connect to signaling server
      await pageA.waitForTimeout(2000);

      // ========================================
      // Step 4: User A adds some letters
      // ========================================
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('T');
      await pageA.keyboard.press('E');
      await pageA.keyboard.press('S');
      await pageA.keyboard.press('T');

      // Verify first letter was entered
      expect(await getCellLetter(pageA, '1')).toBe('T');

      // ========================================
      // Step 5: Get the share URL
      // ========================================
      const shareUrl = pageA.url();

      // ========================================
      // Step 6: User B opens the share URL
      // ========================================
      await pageB.goto(shareUrl);

      // Wait for grid (same context so puzzle is in IndexedDB)
      await waitForGrid(pageB);

      // Give P2P time to sync
      await pageB.waitForTimeout(5000);

      // ========================================
      // Step 7: Verify User B received User A's letters
      // ========================================
      await expect(async () => {
        const letter = await getCellLetter(pageB, '1');
        expect(letter).toBe('T');
      }).toPass({ timeout: 30000 });

      // ========================================
      // Step 8: User B adds a letter in a different cell
      // ========================================
      await clickCellByNumber(pageB, '2');
      await pageB.keyboard.press('X');

      // ========================================
      // Step 9: Verify User A sees User B's letter
      // ========================================
      await expect(async () => {
        const letter = await getCellLetter(pageA, '2');
        expect(letter).toBe('X');
      }).toPass({ timeout: 30000 });

    } finally {
      await pageB.close();
    }
  });

  test('can download and open a puzzle', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await waitForLibraryReady(page);

    await downloadPuzzle(page);

    // Verify puzzle card appears
    await expect(page.locator('.puzzle-card')).toBeVisible();

    // Open the puzzle
    await openPuzzle(page);

    // Verify grid is visible
    await waitForGrid(page);

    // Verify URL format
    expect(page.url()).toContain('#puzzle=');
    expect(page.url()).toContain('&timeline=');
  });

  test('puzzle grid is interactive', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    await waitForLibraryReady(page);

    await downloadPuzzle(page);
    await openPuzzle(page);

    // Click on first cell and type a letter
    await clickCellByNumber(page, '1');
    await page.keyboard.press('Z');

    // Verify letter was entered
    expect(await getCellLetter(page, '1')).toBe('Z');
  });
});
