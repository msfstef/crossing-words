import { test, expect, type Page } from '@playwright/test';

/**
 * Follow Button E2E Tests
 *
 * Tests the collaborative follow button feature:
 * 1. Follow button appears when collaborators are present
 * 2. Clicking follow button follows collaborator's cursor
 * 3. Local movement disables follow mode
 * 4. Cycling through collaborators works
 * 5. Follow disabled when collaborator leaves
 */

const TEST_PUZZLE = {
  title: "Follow Test Puzzle",
  author: "Test",
  width: 5,
  height: 5,
  grid: [
    [
      { row: 0, col: 0, letter: "T", isBlack: false, clueNumber: 1 },
      { row: 0, col: 1, letter: "E", isBlack: false },
      { row: 0, col: 2, letter: "S", isBlack: false },
      { row: 0, col: 3, letter: "T", isBlack: false },
      { row: 0, col: 4, letter: "S", isBlack: false },
    ],
    [
      { row: 1, col: 0, letter: "O", isBlack: false, clueNumber: 2 },
      { row: 1, col: 1, letter: null, isBlack: true },
      { row: 1, col: 2, letter: "T", isBlack: false, clueNumber: 3 },
      { row: 1, col: 3, letter: "O", isBlack: false },
      { row: 1, col: 4, letter: "O", isBlack: false },
    ],
    [
      { row: 2, col: 0, letter: "W", isBlack: false },
      { row: 2, col: 1, letter: null, isBlack: true },
      { row: 2, col: 2, letter: "A", isBlack: false },
      { row: 2, col: 3, letter: "P", isBlack: false },
      { row: 2, col: 4, letter: "S", isBlack: false },
    ],
    [
      { row: 3, col: 0, letter: "E", isBlack: false, clueNumber: 4 },
      { row: 3, col: 1, letter: "X", isBlack: false },
      { row: 3, col: 2, letter: "A", isBlack: false },
      { row: 3, col: 3, letter: "M", isBlack: false },
      { row: 3, col: 4, letter: "S", isBlack: false },
    ],
    [
      { row: 4, col: 0, letter: "R", isBlack: false },
      { row: 4, col: 1, letter: "S", isBlack: false },
      { row: 4, col: 2, letter: "T", isBlack: false },
      { row: 4, col: 3, letter: "S", isBlack: false },
      { row: 4, col: 4, letter: null, isBlack: true },
    ],
  ],
  clues: {
    across: [
      { number: 1, direction: "across", text: "Trials", row: 0, col: 0, length: 5 },
      { number: 2, direction: "across", text: "Towards", row: 1, col: 0, length: 1 },
      { number: 3, direction: "across", text: "Also", row: 1, col: 2, length: 3 },
      { number: 4, direction: "across", text: "Tests", row: 3, col: 0, length: 5 },
    ],
    down: [
      { number: 1, direction: "down", text: "Tower", row: 0, col: 0, length: 5 },
      { number: 3, direction: "down", text: "Start", row: 0, col: 2, length: 5 },
    ],
  },
};

/**
 * Inject a test puzzle into the app
 */
async function injectTestPuzzle(page: Page): Promise<string> {
  const puzzleId = await page.evaluate((puzzle) => {
    // Store the puzzle in localStorage with a known ID
    const id = 'test-follow-puzzle-' + Date.now();
    const puzzleData = {
      id,
      puzzle: puzzle,
      addedAt: Date.now(),
    };

    // Add to library
    const existingLibrary = localStorage.getItem('puzzle-library');
    const library = existingLibrary ? JSON.parse(existingLibrary) : [];
    library.unshift(puzzleData);
    localStorage.setItem('puzzle-library', JSON.stringify(library));

    return id;
  }, TEST_PUZZLE);

  return puzzleId;
}

/**
 * Get the currently selected cell's position
 */
async function getSelectedCellPosition(page: Page): Promise<{ row: number; col: number } | null> {
  return page.evaluate(() => {
    const selectedCell = document.querySelector('.crossword-cell.selected');
    if (!selectedCell) return null;

    const row = selectedCell.getAttribute('data-row');
    const col = selectedCell.getAttribute('data-col');

    if (row && col) {
      return { row: parseInt(row), col: parseInt(col) };
    }
    return null;
  });
}

/**
 * Click on a specific cell
 */
async function clickCell(page: Page, row: number, col: number): Promise<void> {
  await page.evaluate(({ r, c }) => {
    const cell = document.querySelector(`.crossword-cell[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
    if (cell) cell.click();
  }, { r: row, c: col });
}

/**
 * Check if follow button exists and is visible
 */
async function isFollowButtonVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const followBtn = document.querySelector('.solve-header__follow');
    return followBtn !== null && (followBtn as HTMLElement).offsetParent !== null;
  });
}

/**
 * Click the follow button
 */
async function clickFollowButton(page: Page): Promise<void> {
  await page.locator('.solve-header__follow').click();
}

/**
 * Check if follow button is in active state
 */
async function isFollowButtonActive(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const followBtn = document.querySelector('.solve-header__follow');
    return followBtn?.classList.contains('solve-header__follow--active') ?? false;
  });
}

/**
 * Get the number of collaborator avatars shown
 */
async function getCollaboratorCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const avatars = document.querySelectorAll('.solve-header__avatar:not(.solve-header__avatar--overflow)');
    return avatars.length;
  });
}

test.describe('Follow Button', () => {
  test.setTimeout(90000);

  let devServerUrl: string;

  test.beforeAll(async () => {
    // Use localhost dev server
    devServerUrl = 'http://localhost:5173';
  });

  test('follow button appears when collaborators join', async ({ browser }) => {
    // Create two browser contexts to simulate two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both pages to dev server
      await page1.goto(devServerUrl);
      await page2.goto(devServerUrl);

      // Inject test puzzle in both pages
      await injectTestPuzzle(page1);
      await injectTestPuzzle(page2);

      // Reload both pages
      await page1.reload();
      await page2.reload();

      // Wait for library to be ready in both pages
      await page1.waitForFunction(
        () => !document.body.textContent?.includes('Loading puzzles'),
        { timeout: 10000 }
      );
      await page2.waitForFunction(
        () => !document.body.textContent?.includes('Loading puzzles'),
        { timeout: 10000 }
      );

      // Open the same puzzle in both pages (using Share feature to join same room)
      await page1.locator('.puzzle-card').first().click();
      await page1.waitForSelector('.crossword-cell', { state: 'visible' });

      // Get share link from page1
      const shareButton = page1.locator('button[aria-label="Share puzzle"]');
      await shareButton.click();

      // Wait for share dialog
      await page1.waitForSelector('.share-dialog', { state: 'visible', timeout: 5000 });

      // Get the share URL
      const shareUrl = await page1.evaluate(() => {
        const input = document.querySelector('.share-dialog input[type="text"]') as HTMLInputElement;
        return input?.value || '';
      });

      // Close share dialog
      await page1.keyboard.press('Escape');

      // Navigate page2 to the share URL
      await page2.goto(shareUrl);
      await page2.waitForSelector('.crossword-cell', { state: 'visible' });

      // Wait a bit for WebRTC connection to establish
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Check if follow button appears in page1 (should see page2 as collaborator)
      const followVisible1 = await isFollowButtonVisible(page1);
      expect(followVisible1).toBe(true);

      // Check if follow button appears in page2 (should see page1 as collaborator)
      const followVisible2 = await isFollowButtonVisible(page2);
      expect(followVisible2).toBe(true);

      // Verify collaborator avatars are shown
      const collabCount1 = await getCollaboratorCount(page1);
      const collabCount2 = await getCollaboratorCount(page2);
      expect(collabCount1).toBeGreaterThan(0);
      expect(collabCount2).toBeGreaterThan(0);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('following a collaborator syncs cursor position', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both pages
      await page1.goto(devServerUrl);
      await page2.goto(devServerUrl);

      // Inject test puzzle
      await injectTestPuzzle(page1);
      await injectTestPuzzle(page2);

      // Reload
      await page1.reload();
      await page2.reload();

      // Wait for library
      await page1.waitForFunction(() => !document.body.textContent?.includes('Loading puzzles'));
      await page2.waitForFunction(() => !document.body.textContent?.includes('Loading puzzles'));

      // Open puzzle in page1
      await page1.locator('.puzzle-card').first().click();
      await page1.waitForSelector('.crossword-cell', { state: 'visible' });

      // Get share URL and join from page2
      const shareButton = page1.locator('button[aria-label="Share puzzle"]');
      await shareButton.click();
      await page1.waitForSelector('.share-dialog', { state: 'visible' });

      const shareUrl = await page1.evaluate(() => {
        const input = document.querySelector('.share-dialog input[type="text"]') as HTMLInputElement;
        return input?.value || '';
      });

      await page1.keyboard.press('Escape');

      await page2.goto(shareUrl);
      await page2.waitForSelector('.crossword-cell', { state: 'visible' });

      // Wait for connection
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      // Page1: Enable follow mode
      await clickFollowButton(page1);
      await page1.waitForTimeout(500);

      // Verify follow button is active
      const isActive = await isFollowButtonActive(page1);
      expect(isActive).toBe(true);

      // Page2: Move to a specific cell
      await clickCell(page2, 2, 3);
      await page2.waitForTimeout(500);

      // Page1: Verify cursor moved to the same cell
      const page1Position = await getSelectedCellPosition(page1);
      expect(page1Position).toEqual({ row: 2, col: 3 });

      // Page2: Move to another cell
      await clickCell(page2, 1, 2);
      await page2.waitForTimeout(500);

      // Page1: Verify cursor followed
      const page1Position2 = await getSelectedCellPosition(page1);
      expect(page1Position2).toEqual({ row: 1, col: 2 });

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('local movement disables follow mode', async ({ browser }) => {
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Navigate both pages
      await page1.goto(devServerUrl);
      await page2.goto(devServerUrl);

      // Inject test puzzle
      await injectTestPuzzle(page1);
      await injectTestPuzzle(page2);

      // Reload
      await page1.reload();
      await page2.reload();

      // Wait for library
      await page1.waitForFunction(() => !document.body.textContent?.includes('Loading puzzles'));
      await page2.waitForFunction(() => !document.body.textContent?.includes('Loading puzzles'));

      // Open puzzle in page1
      await page1.locator('.puzzle-card').first().click();
      await page1.waitForSelector('.crossword-cell', { state: 'visible' });

      // Get share URL and join from page2
      const shareButton = page1.locator('button[aria-label="Share puzzle"]');
      await shareButton.click();
      await page1.waitForSelector('.share-dialog', { state: 'visible' });

      const shareUrl = await page1.evaluate(() => {
        const input = document.querySelector('.share-dialog input[type="text"]') as HTMLInputElement;
        return input?.value || '';
      });

      await page1.keyboard.press('Escape');

      await page2.goto(shareUrl);
      await page2.waitForSelector('.crossword-cell', { state: 'visible' });

      // Wait for connection
      await page1.waitForTimeout(2000);

      // Page1: Enable follow mode
      await clickFollowButton(page1);
      await page1.waitForTimeout(500);

      // Verify follow is active
      let isActive = await isFollowButtonActive(page1);
      expect(isActive).toBe(true);

      // Page1: Make a local movement (click a cell)
      await clickCell(page1, 3, 0);
      await page1.waitForTimeout(500);

      // Verify follow mode is disabled
      isActive = await isFollowButtonActive(page1);
      expect(isActive).toBe(false);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
