import { test, expect, type Page } from '@playwright/test';

/**
 * Connectivity E2E Tests for Crossing Words
 *
 * Tests P2P connection reliability and reconnection scenarios:
 * 1. Connection persistence after idle time
 * 2. Reconnection after network offline/online simulation
 * 3. Multiple peers staying connected
 * 4. Connection state indicators
 */

const PRODUCTION_URL = 'https://msfstef.dev/crossing-words/';
const BASE_URL = process.env.BASE_URL || PRODUCTION_URL;

/**
 * Wait for the initial library page to be ready
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
async function waitForGrid(page: Page, timeout = 60000): Promise<void> {
  await page.waitForSelector('.crossword-cell', { state: 'visible', timeout });
}

/**
 * Download a puzzle from Universal Crossword
 */
async function downloadPuzzle(page: Page): Promise<void> {
  await page.locator('button[aria-label="Open menu"]').click();
  await page.locator('button[aria-label="Download puzzle"]').click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split('T')[0];

  const dateInput = page.getByRole('textbox', { name: 'Date' });
  await dateInput.fill(dateStr);

  await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();
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
 * Click on a cell by its clue number
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

test.describe('P2P Connectivity Reliability', () => {
  test.setTimeout(300000); // 5 minutes for long-running tests

  test('connection persists after 2 minutes of idle time', async ({ context, page: pageA }) => {
    const pageB = await context.newPage();

    try {
      // Setup: Both users join the same session
      await pageA.goto(BASE_URL);
      await waitForLibraryReady(pageA);
      await downloadPuzzle(pageA);
      await openPuzzle(pageA);

      const shareUrl = pageA.url();
      await pageB.goto(shareUrl);
      await waitForGrid(pageB);

      // User A adds a letter
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('A');

      // Verify User B sees it
      await expect(async () => {
        expect(await getCellLetter(pageB, '1')).toBe('A');
      }).toPass({ timeout: 30000 });

      // Wait for 2 minutes (idle time)
      console.log('Waiting 2 minutes to test connection persistence...');
      await pageA.waitForTimeout(120000);

      // User B adds a letter after idle time
      await clickCellByNumber(pageB, '2');
      await pageB.keyboard.press('B');

      // Verify User A still sees changes (connection persisted)
      await expect(async () => {
        expect(await getCellLetter(pageA, '2')).toBe('B');
      }).toPass({ timeout: 30000 });

      console.log('✓ Connection persisted after 2 minutes of idle time');
    } finally {
      await pageB.close();
    }
  });

  test('reconnects after simulated offline/online cycle', async ({ context, page: pageA }) => {
    const pageB = await context.newPage();

    try {
      // Setup: Both users join the same session
      await pageA.goto(BASE_URL);
      await waitForLibraryReady(pageA);
      await downloadPuzzle(pageA);
      await openPuzzle(pageA);

      const shareUrl = pageA.url();
      await pageB.goto(shareUrl);
      await waitForGrid(pageB);

      // User A adds a letter
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('X');

      // Verify initial sync works
      await expect(async () => {
        expect(await getCellLetter(pageB, '1')).toBe('X');
      }).toPass({ timeout: 30000 });

      // Simulate offline/online on User A
      console.log('Simulating offline...');
      await pageA.context().setOffline(true);
      await pageA.waitForTimeout(2000);

      console.log('Simulating back online...');
      await pageA.context().setOffline(false);

      // Wait for reconnection (exponential backoff should kick in)
      await pageA.waitForTimeout(10000);

      // User B adds a letter after User A reconnects
      await clickCellByNumber(pageB, '2');
      await pageB.keyboard.press('Y');

      // Verify User A sees it after reconnection
      await expect(async () => {
        expect(await getCellLetter(pageA, '2')).toBe('Y');
      }).toPass({ timeout: 45000 }); // Longer timeout for reconnection

      console.log('✓ Successfully reconnected after offline/online cycle');
    } finally {
      await pageB.close();
    }
  });

  test('three peers can all see each other\'s changes', async ({ context, page: pageA }) => {
    const pageB = await context.newPage();
    const pageC = await context.newPage();

    try {
      // Setup: User A creates session
      await pageA.goto(BASE_URL);
      await waitForLibraryReady(pageA);
      await downloadPuzzle(pageA);
      await openPuzzle(pageA);

      const shareUrl = pageA.url();

      // Users B and C join
      await pageB.goto(shareUrl);
      await waitForGrid(pageB);

      await pageC.goto(shareUrl);
      await waitForGrid(pageC);

      // Give time for all peers to connect
      await pageA.waitForTimeout(5000);

      // User A adds a letter
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('A');

      // Verify B and C see it
      await expect(async () => {
        expect(await getCellLetter(pageB, '1')).toBe('A');
      }).toPass({ timeout: 30000 });

      await expect(async () => {
        expect(await getCellLetter(pageC, '1')).toBe('A');
      }).toPass({ timeout: 30000 });

      // User B adds a letter
      await clickCellByNumber(pageB, '2');
      await pageB.keyboard.press('B');

      // Verify A and C see it
      await expect(async () => {
        expect(await getCellLetter(pageA, '2')).toBe('B');
      }).toPass({ timeout: 30000 });

      await expect(async () => {
        expect(await getCellLetter(pageC, '2')).toBe('B');
      }).toPass({ timeout: 30000 });

      // User C adds a letter
      await clickCellByNumber(pageC, '3');
      await pageC.keyboard.press('C');

      // Verify A and B see it
      await expect(async () => {
        expect(await getCellLetter(pageA, '3')).toBe('C');
      }).toPass({ timeout: 30000 });

      await expect(async () => {
        expect(await getCellLetter(pageB, '3')).toBe('C');
      }).toPass({ timeout: 30000 });

      console.log('✓ All three peers can see each other\'s changes');
    } finally {
      await pageB.close();
      await pageC.close();
    }
  });

  test('new peer can join after others have been connected for a while', async ({
    context,
    page: pageA,
  }) => {
    const pageB = await context.newPage();

    try {
      // User A creates session
      await pageA.goto(BASE_URL);
      await waitForLibraryReady(pageA);
      await downloadPuzzle(pageA);
      await openPuzzle(pageA);

      const shareUrl = pageA.url();

      // User A adds letters
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('F');
      await pageA.keyboard.press('I');
      await pageA.keyboard.press('R');
      await pageA.keyboard.press('S');
      await pageA.keyboard.press('T');

      // Wait a bit to simulate "established session"
      await pageA.waitForTimeout(5000);

      // User B joins later
      await pageB.goto(shareUrl);
      await waitForGrid(pageB);

      // User B should see User A's existing letters
      await expect(async () => {
        expect(await getCellLetter(pageB, '1')).toBe('F');
      }).toPass({ timeout: 30000 });

      // User B adds a letter
      await clickCellByNumber(pageB, '5');
      await pageB.keyboard.press('Z');

      // User A should see User B's letter
      await expect(async () => {
        expect(await getCellLetter(pageA, '5')).toBe('Z');
      }).toPass({ timeout: 30000 });

      console.log('✓ New peer successfully joined established session');
    } finally {
      await pageB.close();
    }
  });

  test('connection recovers after page visibility change', async ({ context, page: pageA }) => {
    const pageB = await context.newPage();

    try {
      // Setup: Both users join
      await pageA.goto(BASE_URL);
      await waitForLibraryReady(pageA);
      await downloadPuzzle(pageA);
      await openPuzzle(pageA);

      const shareUrl = pageA.url();
      await pageB.goto(shareUrl);
      await waitForGrid(pageB);

      // Initial sync
      await clickCellByNumber(pageA, '1');
      await pageA.keyboard.press('M');

      await expect(async () => {
        expect(await getCellLetter(pageB, '1')).toBe('M');
      }).toPass({ timeout: 30000 });

      // Simulate visibility change on User A (mobile sleep/wake)
      console.log('Simulating page visibility hidden (mobile sleep)...');
      await pageA.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          configurable: true,
          value: 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await pageA.waitForTimeout(2000);

      console.log('Simulating page visibility visible (mobile wake)...');
      await pageA.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          writable: true,
          configurable: true,
          value: 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Wait for reconnection
      await pageA.waitForTimeout(5000);

      // User B adds a letter after User A's "wake"
      await clickCellByNumber(pageB, '2');
      await pageB.keyboard.press('N');

      // User A should see it after reconnection
      await expect(async () => {
        expect(await getCellLetter(pageA, '2')).toBe('N');
      }).toPass({ timeout: 30000 });

      console.log('✓ Connection recovered after visibility change');
    } finally {
      await pageB.close();
    }
  });
});
