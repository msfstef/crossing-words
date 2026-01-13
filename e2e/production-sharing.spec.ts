import { test, expect, type Page } from '@playwright/test';

/**
 * Production P2P sharing test
 *
 * Tests the actual peer-to-peer connection flow on the deployed production site.
 * This test reproduces the sharing workflow:
 * 1. User A opens the production site and gets a puzzle
 * 2. User A clicks share and gets a share URL
 * 3. User B opens the share URL
 * 4. Verify they can connect and sync
 */

const PRODUCTION_URL = 'https://msfstef.dev/crossing-words/';
const TIMEOUT = 30000; // 30 seconds for production

/**
 * Wait for the puzzle grid to be visible and interactive
 */
async function waitForPuzzleReady(page: Page, timeout = TIMEOUT): Promise<void> {
  await page.waitForSelector('.crossword-grid', { state: 'visible', timeout });
  await page.waitForSelector('.puzzle-loading', { state: 'hidden', timeout }).catch(() => {
    // Loading indicator may not appear if puzzle loads fast
  });
}

/**
 * Wait for a specific connection state
 */
async function waitForConnectionState(
  page: Page,
  state: 'disconnected' | 'connecting' | 'connected',
  timeout = TIMEOUT
): Promise<void> {
  await page.waitForSelector(
    `.connection-indicator[data-connection-state="${state}"]`,
    { state: 'visible', timeout }
  );
}

/**
 * Open share dialog and get the share URL
 */
async function openShareDialogAndGetUrl(page: Page): Promise<string> {
  const shareButton = page.locator('.share-button');
  await shareButton.click();

  // Wait for dialog to open
  await page.waitForSelector('.share-dialog[open]', { state: 'visible', timeout: 10000 });

  // Get the share URL from the input field
  const urlInput = page.locator('.share-dialog__url-input');
  return await urlInput.inputValue();
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
 * Clear IndexedDB for a clean test start
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

test.describe('Production P2P Sharing', () => {
  // Increase timeout for production tests
  test.setTimeout(120000);

  test('can share puzzle and connect two peers on production', async ({ browser }) => {
    console.log('Testing production P2P sharing on:', PRODUCTION_URL);

    // Create two separate browser contexts (simulating two different users/devices)
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      // Enable console logging for debugging
      pageA.on('console', msg => console.log('[Page A]', msg.text()));
      pageB.on('console', msg => console.log('[Page B]', msg.text()));

      // Track WebSocket connections
      pageA.on('websocket', ws => {
        console.log('[Page A] WebSocket created:', ws.url());
        ws.on('framesent', frame => console.log('[Page A] WS sent:', frame.payload));
        ws.on('framereceived', frame => console.log('[Page A] WS received:', frame.payload));
        ws.on('close', () => console.log('[Page A] WebSocket closed'));
      });

      pageB.on('websocket', ws => {
        console.log('[Page B] WebSocket created:', ws.url());
        ws.on('framesent', frame => console.log('[Page B] WS sent:', frame.payload));
        ws.on('framereceived', frame => console.log('[Page B] WS received:', frame.payload));
        ws.on('close', () => console.log('[Page B] WebSocket closed'));
      });

      // User A: Load the production site
      console.log('[User A] Loading production site...');
      await pageA.goto(PRODUCTION_URL);
      await waitForPuzzleReady(pageA);
      console.log('[User A] Puzzle loaded');

      // Get the puzzle title
      const puzzleTitle = await pageA.locator('.puzzle-title').textContent();
      console.log('[User A] Puzzle title:', puzzleTitle);
      expect(puzzleTitle).toBeTruthy();

      // User A: Click share button and get share URL
      console.log('[User A] Opening share dialog...');
      const shareUrl = await openShareDialogAndGetUrl(pageA);
      console.log('[User A] Share URL:', shareUrl);

      // Verify share URL format
      expect(shareUrl).toContain('#puzzle=');
      expect(shareUrl).toContain('&timeline=');

      // Close share dialog
      await pageA.keyboard.press('Escape');

      // Wait for User A to be connected to signaling server
      console.log('[User A] Waiting for connection...');
      await waitForConnectionState(pageA, 'connected', TIMEOUT);
      console.log('[User A] Connected to signaling server');

      // User B: Clear storage to ensure fresh state
      console.log('[User B] Clearing storage...');
      await pageB.goto(PRODUCTION_URL);
      await clearIndexedDB(pageB);

      // User B: Navigate to the share URL
      console.log('[User B] Navigating to share URL:', shareUrl);
      await pageB.goto(shareUrl);

      // Wait for User B to load the puzzle
      console.log('[User B] Waiting for puzzle to load...');
      await waitForPuzzleReady(pageB);
      console.log('[User B] Puzzle loaded');

      // Verify User B has the same puzzle
      const receivedTitle = await pageB.locator('.puzzle-title').textContent();
      console.log('[User B] Received puzzle title:', receivedTitle);
      expect(receivedTitle).toBe(puzzleTitle);

      // Wait for User B to connect
      console.log('[User B] Waiting for connection...');
      await waitForConnectionState(pageB, 'connected', TIMEOUT);
      console.log('[User B] Connected to signaling server');

      // Give awareness some time to sync
      await pageA.waitForTimeout(3000);

      // Test collaboration: User A types a letter
      console.log('[User A] Typing letter X at (0,0)...');
      await clickCell(pageA, 0, 0);
      await pageA.keyboard.press('X');

      // User B should receive the letter
      console.log('[User B] Waiting for letter X to sync...');
      await expect(async () => {
        const cellValue = await getCellValue(pageB, 0, 0);
        console.log('[User B] Cell (0,0) value:', cellValue);
        expect(cellValue).toBe('X');
      }).toPass({ timeout: 10000 });
      console.log('[User B] Letter X received!');

      // Test reverse sync: User B types a letter
      console.log('[User B] Typing letter Y at (0,1)...');
      await clickCell(pageB, 0, 1);
      await pageB.keyboard.press('Y');

      // User A should receive the letter
      console.log('[User A] Waiting for letter Y to sync...');
      await expect(async () => {
        const cellValue = await getCellValue(pageA, 0, 1);
        console.log('[User A] Cell (0,1) value:', cellValue);
        expect(cellValue).toBe('Y');
      }).toPass({ timeout: 10000 });
      console.log('[User A] Letter Y received!');

      // Check for collaborator avatars
      console.log('[User A] Checking for collaborator avatars...');
      const avatarsA = await pageA.locator('.collaborator-avatar').count();
      console.log('[User A] Collaborator avatar count:', avatarsA);

      console.log('[User B] Checking for collaborator avatars...');
      const avatarsB = await pageB.locator('.collaborator-avatar').count();
      console.log('[User B] Collaborator avatar count:', avatarsB);

      // At least one should see the other
      expect(avatarsA + avatarsB).toBeGreaterThan(0);

      console.log('✅ Production P2P sharing test PASSED');

    } catch (error) {
      console.error('❌ Production P2P sharing test FAILED:', error);
      throw error;
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('can connect to production signaling server', async ({ page }) => {
    console.log('Testing signaling server connection...');

    // Enable console and WebSocket logging
    page.on('console', msg => console.log('[Console]', msg.text()));
    page.on('websocket', ws => {
      console.log('[WebSocket] Created:', ws.url());
      ws.on('framesent', frame => console.log('[WebSocket] Sent:', frame.payload));
      ws.on('framereceived', frame => console.log('[WebSocket] Received:', frame.payload));
      ws.on('close', () => console.log('[WebSocket] Closed'));
    });

    // Track network requests
    page.on('request', request => {
      if (request.url().includes('signaling') || request.url().includes('proxy')) {
        console.log('[Network] Request:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('signaling') || response.url().includes('proxy')) {
        console.log('[Network] Response:', response.status(), response.url());
      }
    });

    // Load the production site with a unique room
    const roomId = `signaling-test-${Date.now()}`;
    const url = `${PRODUCTION_URL}#room=${roomId}`;

    console.log('Loading:', url);
    await page.goto(url);

    // Wait for puzzle to be ready
    await waitForPuzzleReady(page);
    console.log('Puzzle ready');

    // Wait for connection indicator to appear
    const indicator = page.locator('.connection-indicator');
    await expect(indicator).toBeVisible({ timeout: TIMEOUT });
    console.log('Connection indicator visible');

    // Should eventually connect (even if alone in the room)
    await waitForConnectionState(page, 'connected', TIMEOUT);
    console.log('✅ Connected to signaling server');

    // Verify the connection indicator shows connected state
    await expect(indicator).toHaveAttribute('data-connection-state', 'connected');
    await expect(indicator.locator('.connection-indicator__label')).toHaveText('Connected');
  });
});
