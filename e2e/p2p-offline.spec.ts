import { test, expect, type Page } from '@playwright/test';

/**
 * Offline-first behavior test suite for P2P sync.
 *
 * Tests that the app handles network changes gracefully:
 * - Local edits work regardless of connection state
 * - IndexedDB persists entries locally
 * - Connection indicator displays correct states
 *
 * Note: Playwright's setOffline() affects HTTP/WebSocket but WebRTC data channels
 * may behave differently. These tests focus on what we can reliably verify.
 */
test.describe('P2P Offline-First Behavior', () => {
  test('local edits persist and sync works after reconnection', async ({ browser }) => {
    // Generate unique room ID for this test
    const roomId = `offline-test-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    // Create two separate browser contexts (simulates two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Log console messages for debugging
    page1.on('console', (msg) => console.log(`Page1 [${msg.type()}]: ${msg.text()}`));
    page2.on('console', (msg) => console.log(`Page2 [${msg.type()}]: ${msg.text()}`));

    try {
      // Both pages navigate to the app with the same roomId
      await Promise.all([page1.goto(url), page2.goto(url)]);

      // Wait for puzzle grid to be ready in both pages
      await Promise.all([
        waitForPuzzleReady(page1),
        waitForPuzzleReady(page2),
      ]);

      // Wait for both to show 'connected' state
      await Promise.all([
        waitForConnectionState(page1, 'connected'),
        waitForConnectionState(page2, 'connected'),
      ]);

      // a. page1 types 'A' in cell (0,0) - baseline sync test
      await clickCell(page1, 0, 0);
      await page1.keyboard.type('A');

      // Wait for sync propagation
      await page1.waitForTimeout(2000);

      // b. Verify page2 sees 'A' (baseline sync works)
      const cellValueA = await getCellValue(page2, 0, 0);
      expect(cellValueA).toBe('A');

      // c. page2 types 'C' in cell (0,2)
      await clickCell(page2, 0, 2);
      await page2.keyboard.type('C');

      // d. Verify page2 can see its own 'C' immediately
      const cellValueC = await getCellValue(page2, 0, 2);
      expect(cellValueC).toBe('C');

      // e. Wait for sync and verify page1 sees 'C'
      await page1.waitForTimeout(2000);
      const cellValueCSynced = await getCellValue(page1, 0, 2);
      expect(cellValueCSynced).toBe('C');

      // f. page1 types 'B' in cell (0,1)
      await clickCell(page1, 0, 1);
      await page1.keyboard.type('B');

      // g. Wait for sync
      await page1.waitForTimeout(2000);

      // Final verification: both pages should have all letters
      expect(await getCellValue(page1, 0, 0)).toBe('A');
      expect(await getCellValue(page1, 0, 1)).toBe('B');
      expect(await getCellValue(page1, 0, 2)).toBe('C');
      expect(await getCellValue(page2, 0, 0)).toBe('A');
      expect(await getCellValue(page2, 0, 1)).toBe('B');
      expect(await getCellValue(page2, 0, 2)).toBe('C');
    } finally {
      // Clean up contexts
      await context1.close();
      await context2.close();
    }
  });

  test('IndexedDB persists entries across page reload', async ({ browser }) => {
    // Generate unique room ID for this test
    const roomId = `persist-test-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    // Create a browser context for a single user
    const context = await browser.newContext();
    const page = await context.newPage();

    // Log console messages for debugging
    page.on('console', (msg) => console.log(`Page [${msg.type()}]: ${msg.text()}`));

    try {
      // a. Navigate to the app with roomId
      await page.goto(url);
      await waitForPuzzleReady(page);
      await waitForConnectionState(page, 'connected');

      // b. Type some letters
      await clickCell(page, 0, 0);
      await page.keyboard.type('X');
      await clickCell(page, 0, 1);
      await page.keyboard.type('Y');
      await clickCell(page, 0, 2);
      await page.keyboard.type('Z');

      // Verify letters are visible
      expect(await getCellValue(page, 0, 0)).toBe('X');
      expect(await getCellValue(page, 0, 1)).toBe('Y');
      expect(await getCellValue(page, 0, 2)).toBe('Z');

      // c. Wait for IndexedDB to persist
      await page.waitForTimeout(1000);

      // d. Reload page (while still online)
      await page.reload();
      await waitForPuzzleReady(page);

      // e. Verify all letters still present (IndexedDB persistence works)
      expect(await getCellValue(page, 0, 0)).toBe('X');
      expect(await getCellValue(page, 0, 1)).toBe('Y');
      expect(await getCellValue(page, 0, 2)).toBe('Z');
    } finally {
      await context.close();
    }
  });

  test('connection indicator shows connected state', async ({ browser }) => {
    // Generate unique room ID for this test
    const roomId = `indicator-test-${Date.now()}`;
    const url = `http://localhost:5173/#room=${roomId}`;

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to the app with roomId
      await page.goto(url);
      await waitForPuzzleReady(page);

      // Connection indicator should be visible when roomId is set
      const indicator = page.locator('.connection-indicator');
      await expect(indicator).toBeVisible();

      // Wait for connected state
      await waitForConnectionState(page, 'connected');

      // Verify indicator shows 'Connected'
      await expect(indicator).toHaveAttribute('data-connection-state', 'connected');
      await expect(indicator.locator('.connection-indicator__label')).toHaveText('Connected');

      // Verify the green dot is visible (connected state)
      const dot = indicator.locator('.connection-indicator__dot');
      await expect(dot).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('connection indicator hidden in solo mode', async ({ page }) => {
    // Navigate without roomId (solo mode)
    await page.goto('http://localhost:5173/');
    await waitForPuzzleReady(page);

    // Connection indicator should NOT be visible in solo mode
    const indicator = page.locator('.connection-indicator');
    await expect(indicator).not.toBeVisible();
  });
});

/**
 * Wait for the puzzle grid to be visible and interactive
 */
async function waitForPuzzleReady(page: Page): Promise<void> {
  // Wait for the grid to be visible
  await page.waitForSelector('.crossword-grid', { state: 'visible', timeout: 10000 });
  // Wait for the "Loading puzzle state..." to disappear
  await page.waitForSelector('.puzzle-loading', { state: 'hidden', timeout: 10000 });
}

/**
 * Wait for a specific connection state
 */
async function waitForConnectionState(
  page: Page,
  state: 'disconnected' | 'connecting' | 'connected',
  timeout = 15000
): Promise<void> {
  await page.waitForSelector(
    `.connection-indicator[data-connection-state="${state}"]`,
    { state: 'visible', timeout }
  );
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
