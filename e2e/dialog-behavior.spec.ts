import { test, expect, type Page } from '@playwright/test';

test.describe('Dialog Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Wait for library to load
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading puzzles'),
      { timeout: 10000 }
    );
  });

  test.describe('Download Dialog', () => {
    test('should open download dialog via FAB menu', async ({ page }) => {
      // Open FAB menu
      await page.locator('button[aria-label="Open menu"]').click();

      // Click Download
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Download dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Download Puzzle')).toBeVisible();
    });

    test('should close download dialog when clicking outside', async ({ page }) => {
      // Open FAB menu and download dialog
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click on backdrop (outside the dialog)
      // The backdrop covers the entire screen, so click near the edge
      await page.click('.download-dialog-backdrop', {
        position: { x: 10, y: 10 },
        force: true
      });

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close download dialog when pressing Escape', async ({ page }) => {
      // Open FAB menu and download dialog
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close download dialog when pressing Cancel button', async ({ page }) => {
      // Open FAB menu and download dialog
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click Cancel button
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should allow selecting dates without closing the dialog', async ({ page }) => {
      // Open FAB menu and download dialog
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click on date picker trigger (but not a specific date yet)
      const datePickerTrigger = page.locator('.datepicker__trigger');
      await datePickerTrigger.click();

      // DatePicker dropdown should be visible
      await expect(page.locator('.datepicker__dropdown')).toBeVisible();

      // Select an available date (find a day button that's not disabled)
      const availableDay = page.locator('.datepicker__day:not(.datepicker__day--disabled):not(.datepicker__day--empty)').first();
      if (await availableDay.count() > 0) {
        await availableDay.click();

        // The download dialog should still be open after selecting a date
        await expect(page.getByText('Download Puzzle')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
      }
    });

    test('should reopen download dialog after closing via back button', async ({ page }) => {
      // Open FAB menu and download dialog
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Wait for dialog
      await expect(page.getByRole('dialog')).toBeVisible();

      // Press browser back button
      await page.goBack();

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Wait a moment for any state cleanup
      await page.waitForTimeout(100);

      // Open FAB menu and download dialog again
      await page.locator('button[aria-label="Open menu"]').click();
      await page.locator('button[aria-label="Download puzzle"]').click();

      // Dialog should open successfully again
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Download Puzzle')).toBeVisible();
    });
  });

  test.describe('Profile Dialog', () => {
    test('should open profile dialog', async ({ page }) => {
      // Click profile button
      await page.locator('button[aria-label="Profile settings"]').click();

      // Profile dialog should be visible
      await expect(page.locator('.profile-dialog')).toBeVisible();
      await expect(page.getByText('Profile')).toBeVisible();
    });

    test('should close profile dialog when clicking outside', async ({ page }) => {
      // Open profile dialog
      await page.locator('button[aria-label="Profile settings"]').click();
      await expect(page.locator('.profile-dialog')).toBeVisible();

      // Click outside the dialog (on the backdrop)
      // For native dialog, clicking on dialog element itself (outside content) triggers close
      await page.locator('.profile-dialog').click({ position: { x: -50, y: -50 }, force: true });

      // Dialog should be closed
      await expect(page.locator('.profile-dialog')).not.toBeVisible();
    });

    test('should close profile dialog when pressing Escape', async ({ page }) => {
      // Open profile dialog
      await page.locator('button[aria-label="Profile settings"]').click();
      await expect(page.locator('.profile-dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.locator('.profile-dialog')).not.toBeVisible();
    });

    test('should close profile dialog when pressing X button', async ({ page }) => {
      // Open profile dialog
      await page.locator('button[aria-label="Profile settings"]').click();
      await expect(page.locator('.profile-dialog')).toBeVisible();

      // Click close button
      await page.locator('.profile-dialog__close').click();

      // Dialog should be closed
      await expect(page.locator('.profile-dialog')).not.toBeVisible();
    });

    test('should reopen profile dialog after closing via back button', async ({ page }) => {
      // Open profile dialog
      await page.locator('button[aria-label="Profile settings"]').click();
      await expect(page.locator('.profile-dialog')).toBeVisible();

      // Press browser back button
      await page.goBack();

      // Dialog should be closed
      await expect(page.locator('.profile-dialog')).not.toBeVisible();

      // Wait a moment for state cleanup
      await page.waitForTimeout(100);

      // Open profile dialog again
      await page.locator('button[aria-label="Profile settings"]').click();

      // Dialog should open successfully again
      await expect(page.locator('.profile-dialog')).toBeVisible();
    });
  });

  test.describe('Puzzle Options Dialog', () => {
    // Helper to download a puzzle if none exist
    async function ensurePuzzleExists(page: Page): Promise<void> {
      const noPuzzles = await page.locator('.library-empty').isVisible().catch(() => false);
      if (noPuzzles) {
        // Open FAB menu and download dialog
        await page.locator('button[aria-label="Open menu"]').click();
        await page.locator('button[aria-label="Download puzzle"]').click();

        // Wait for dialog
        await page.getByRole('dialog').waitFor({ state: 'visible' });

        // Click Download button
        await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();

        // Wait for puzzle card to appear
        await page.waitForSelector('.puzzle-card', { state: 'visible', timeout: 30000 });
      }
    }

    test('should close puzzle options dialog when clicking outside', async ({ page }) => {
      await ensurePuzzleExists(page);

      const puzzleCard = page.locator('.puzzle-card').first();
      await expect(puzzleCard).toBeVisible();

      // Get coordinates for long press
      const box = await puzzleCard.boundingBox();
      if (!box) throw new Error('Puzzle card not found');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      // Trigger long press
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();

      // Wait for dialog
      await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

      // Click outside (on overlay)
      await page.locator('.puzzle-options-overlay').click({ position: { x: 10, y: 10 } });

      // Dialog should be closed
      await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();
    });

    test('should close puzzle options dialog when pressing Escape', async ({ page }) => {
      await ensurePuzzleExists(page);

      const puzzleCard = page.locator('.puzzle-card').first();
      await expect(puzzleCard).toBeVisible();

      // Get coordinates for long press
      const box = await puzzleCard.boundingBox();
      if (!box) throw new Error('Puzzle card not found');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      // Trigger long press
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();

      // Wait for dialog
      await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();
    });

    test('should reopen puzzle options dialog after closing via back button', async ({ page }) => {
      await ensurePuzzleExists(page);

      const puzzleCard = page.locator('.puzzle-card').first();
      await expect(puzzleCard).toBeVisible();

      // Get coordinates for long press
      const box = await puzzleCard.boundingBox();
      if (!box) throw new Error('Puzzle card not found');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;

      // Trigger long press
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();

      // Wait for dialog
      await expect(page.locator('.puzzle-options-dialog')).toBeVisible();

      // Press browser back button
      await page.goBack();

      // Dialog should be closed
      await expect(page.locator('.puzzle-options-dialog')).not.toBeVisible();

      // Wait a moment for state cleanup
      await page.waitForTimeout(300);

      // Trigger long press again
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(400);
      await page.mouse.up();

      // Dialog should open successfully again
      await expect(page.locator('.puzzle-options-dialog')).toBeVisible();
    });
  });
});
