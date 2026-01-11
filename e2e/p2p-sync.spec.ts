import { test, expect, type Page } from '@playwright/test';

/**
 * P2P sync test suite for WebRTC-based puzzle synchronization.
 *
 * Uses two separate browser contexts to simulate two peers connecting
 * to the same room and syncing keystrokes via y-webrtc.
 */
test.describe('P2P Sync', () => {
  test('two peers sync keystrokes', async ({ browser }) => {
    // Generate unique room ID for this test
    const roomId = `test-room-${Date.now()}`;
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

      // Give WebRTC significant time to discover peers and connect
      // y-webrtc needs time to: connect to signaling server, discover peers, establish WebRTC connection
      await page1.waitForTimeout(5000);

      // In page1: click cell at (0,0) and type 'X'
      await clickCell(page1, 0, 0);
      await page1.keyboard.type('X');

      // Wait for sync propagation (longer for WebRTC)
      await page1.waitForTimeout(2000);

      // Verify page2 sees the 'X' in cell (0,0)
      const cell1Value = await getCellValue(page2, 0, 0);
      expect(cell1Value).toBe('X');

      // In page2: click cell at (0,1) and type 'Y'
      await clickCell(page2, 0, 1);
      await page2.keyboard.type('Y');

      // Wait for sync propagation
      await page2.waitForTimeout(1000);

      // Verify page1 sees the 'Y' in cell (0,1)
      const cell2Value = await getCellValue(page1, 0, 1);
      expect(cell2Value).toBe('Y');

      // Final verification: both pages should have both letters
      const finalValue00Page1 = await getCellValue(page1, 0, 0);
      const finalValue01Page1 = await getCellValue(page1, 0, 1);
      const finalValue00Page2 = await getCellValue(page2, 0, 0);
      const finalValue01Page2 = await getCellValue(page2, 0, 1);

      expect(finalValue00Page1).toBe('X');
      expect(finalValue01Page1).toBe('Y');
      expect(finalValue00Page2).toBe('X');
      expect(finalValue01Page2).toBe('Y');
    } finally {
      // Clean up contexts
      await context1.close();
      await context2.close();
    }
  });
});

/**
 * Wait for the puzzle grid to be visible and interactive
 */
async function waitForPuzzleReady(page: Page): Promise<void> {
  // Wait for the grid to be visible
  await page.waitForSelector('.crossword-grid', { state: 'visible' });
  // Wait for the "Loading puzzle state..." to disappear
  await page.waitForSelector('.puzzle-loading', { state: 'hidden' });
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
