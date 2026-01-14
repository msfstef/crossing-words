import { test, expect, type Page } from '@playwright/test';

/**
 * Download a puzzle from the Universal Crossword source
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

test.describe('Puzzle Card Long Press Menu', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173/');

    // Wait for library to load
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading puzzles'),
      { timeout: 10000 }
    );

    // Download a test puzzle if no puzzles exist
    const noPuzzles = await page.locator('.library-empty').isVisible().catch(() => false);
    if (noPuzzles) {
      await downloadPuzzle(page);
    }
  });

  test('should show options menu on long press', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    // Get bounding box for accurate coordinates
    const box = await puzzleCard.boundingBox();
    if (!box) throw new Error('Puzzle card not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Perform long press (500ms+)
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600); // Wait longer than LONG_PRESS_DURATION
    await page.mouse.up();

    // Options dialog should appear
    await expect(page.locator('.puzzle-options-dialog')).toBeVisible({ timeout: 1000 });
  });

  test('should not show menu on quick tap', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    // Quick tap
    await puzzleCard.click();

    // Wait a moment to ensure dialog doesn't appear
    await page.waitForTimeout(200);

    // Options dialog should NOT appear
    await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();
  });

  test('should not select text during long press', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    const box = await puzzleCard.boundingBox();
    if (!box) throw new Error('Puzzle card not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Perform long press
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600);

    // Check that no text is selected
    const selection = await page.evaluate(() => window.getSelection()?.toString());
    expect(selection).toBe('');

    await page.mouse.up();
  });

  test('should show all three menu options', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    const box = await puzzleCard.boundingBox();
    if (!box) throw new Error('Puzzle card not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Trigger long press
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    // Wait for dialog
    await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

    // Check all three options are present
    const resetPuzzleBtn = page.getByText('Reset Puzzle');
    const resetSharingBtn = page.getByText('Reset Sharing');
    const deleteBtn = page.locator('.puzzle-options-button--danger').getByText('Delete');

    await expect(resetPuzzleBtn).toBeVisible();
    await expect(resetSharingBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();
  });

  test('should close dialog when clicking close button', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    const box = await puzzleCard.boundingBox();
    if (!box) throw new Error('Puzzle card not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Trigger long press
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    // Wait for dialog
    await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

    // Click close button
    await page.locator('.puzzle-options-close').click();

    // Dialog should be closed
    await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();
  });

  test('should close dialog when clicking outside', async ({ page }) => {
    const puzzleCard = page.locator('.puzzle-card').first();
    await expect(puzzleCard).toBeVisible();

    const box = await puzzleCard.boundingBox();
    if (!box) throw new Error('Puzzle card not found');

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Trigger long press
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();

    // Wait for dialog
    await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

    // Click outside (on overlay)
    await page.locator('.puzzle-options-overlay').click({ position: { x: 10, y: 10 } });

    // Dialog should be closed
    await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();
  });
});
