import { test, expect } from '../fixtures/base.fixture.js';
import { createTestOrganization } from '../utils/test-helpers.js';
import { cleanupTestDataForUser, cleanupTestDataForOrganization } from '../utils/db-cleanup.js';

test.describe('Inventory Management', () => {
  let testOrg: any;

  test.beforeAll(async () => {
    // Create a test organization with user
    testOrg = await createTestOrganization({
      email: `inventory-test-${Date.now()}@ventry.e2e.test`,
      password: 'TestPassword123!',
      firstName: 'Inventory',
      lastName: 'Test',
    });
  });

  test.afterAll(async () => {
    if (testOrg) {
      await cleanupTestDataForOrganization(testOrg.organization.id);
      await cleanupTestDataForUser(testOrg.owner.id);
    }
  });

  test.beforeEach(async ({ cleanPage: page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', testOrg.owner.email);
    await page.fill('input[type="password"]', testOrg.owner.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('should display inventory page with items', async ({ cleanPage: page }) => {
    // Navigate to inventory
    await page.goto('/inventory');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page.locator('h1').filter({ hasText: 'Inventory' })).toBeVisible();

    // Check if inventory table is visible
    await expect(page.locator('table')).toBeVisible();

    // Check for inventory headers
    await expect(page.locator('th').filter({ hasText: 'Item' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'SKU' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Location' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'On Hand' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Available' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Reserved' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Status' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Actions' })).toBeVisible();

    // Check if we have inventory data or empty state
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 1) {
      // Check if it's the empty state
      const emptyStateText = await rows.first().textContent();
      if (emptyStateText?.includes('No inventory found')) {
        // This is okay - new organization might not have inventory yet
        console.log('Note: New organization has no inventory data yet');
      }
    }
  });

  test('should filter inventory by search term', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // First check if we have any inventory
    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 1) {
      const emptyStateText = await page.locator('tbody tr').first().textContent();
      if (emptyStateText?.includes('No inventory found')) {
        test.skip(true, 'No inventory data to filter');
        return;
      }
    }

    // Type in search box
    const searchInput = page.locator('input[placeholder="Search by SKU, name, or barcode..."]');
    await searchInput.fill('TEST-SEARCH-TERM-12345');

    // Wait for filtered results
    await page.waitForTimeout(500); // Debounce delay

    // Should show empty state for non-existent search term
    await expect(page.locator('text=No inventory found')).toBeVisible();
  });

  test('should filter inventory by warehouse', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Open warehouse dropdown (it's a Select component, not combobox)
    const warehouseSelect = page.locator('button:has-text("All Warehouses")');
    await warehouseSelect.click();

    // Select first warehouse from the dropdown (skip "All Warehouses")
    const warehouseOptions = page.locator('[role="option"]');
    // Wait for options to be visible
    await warehouseOptions.first().waitFor();
    // Click the second option (first warehouse after "All Warehouses")
    if ((await warehouseOptions.count()) > 1) {
      await warehouseOptions.nth(1).click();
    }

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify that filter was applied (we should have filtered results or empty state)
    await page.waitForTimeout(500);
    // The warehouse name should be visible in the select trigger
    const selectedWarehouse = await page.locator('button[role="combobox"]').textContent();
    expect(selectedWarehouse).not.toBe('All Warehouses');
  });

  test('should toggle low stock filter', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Toggle low stock switch
    const lowStockSwitch = page.locator('button[role="switch"]');
    await lowStockSwitch.click();

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Check that we have results or empty state
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount === 1) {
      // Check if it's empty state
      const emptyStateText = await rows.first().textContent();
      if (emptyStateText?.includes('No inventory found')) {
        // No low stock items - this is valid
        console.log('Note: No low stock items found');
        return;
      }
    }

    // If we have items, they should all be low stock
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      // Look for status badge indicating low/out of stock
      const statusBadge = row.locator('td:nth-child(7)'); // Status column
      const statusText = await statusBadge.textContent();
      expect(['Low Stock', 'Out of Stock']).toContain(statusText?.trim());
    }
  });

  test('should open stock adjustment dialog', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check if we have inventory items
    const adjustButtons = page.locator('button').filter({ hasText: 'Adjust' });
    const buttonCount = await adjustButtons.count();

    if (buttonCount === 0) {
      test.skip(true, 'No inventory items to adjust');
      return;
    }

    // Click adjust button on first item
    await adjustButtons.first().click();

    // Check dialog is open
    await expect(page.locator('h2').filter({ hasText: 'Adjust Stock' })).toBeVisible();

    // Check dialog shows current stock info
    await expect(page.locator('text=Current Stock:')).toBeVisible();
    await expect(page.locator('text=Location:')).toBeVisible();
  });

  test('should adjust stock quantity', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check if we have inventory items
    const adjustButtons = page.locator('button').filter({ hasText: 'Adjust' });
    const buttonCount = await adjustButtons.count();

    if (buttonCount === 0) {
      test.skip(true, 'No inventory items to adjust');
      return;
    }

    // Get initial stock value (On Hand column is 4th)
    const initialStock = await page
      .locator('tbody tr')
      .first()
      .locator('td:nth-child(4)')
      .textContent();
    const initialValue = parseInt(initialStock?.trim() || '0');

    // Open adjustment dialog
    await adjustButtons.first().click();

    // Fill adjustment form
    const quantityInput = page.locator('input[type="number"]');
    await quantityInput.fill('10');

    const reasonInput = page.locator('textarea');
    await reasonInput.fill('E2E test stock adjustment');

    // Submit adjustment
    await page.locator('button').filter({ hasText: 'Adjust Stock' }).click();

    // Wait for dialog to close and data to refresh
    await page.waitForTimeout(1000);

    // Check that stock was updated
    const newStock = await page
      .locator('tbody tr')
      .first()
      .locator('td:nth-child(4)')
      .textContent();
    const newValue = parseInt(newStock?.trim() || '0');

    expect(newValue).toBe(initialValue + 10);

    // Check for success toast
    await expect(page.locator('text=Stock adjusted successfully')).toBeVisible();
  });

  test('should validate stock adjustment form', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check if we have inventory items
    const adjustButtons = page.locator('button').filter({ hasText: 'Adjust' });
    const buttonCount = await adjustButtons.count();

    if (buttonCount === 0) {
      test.skip(true, 'No inventory items to adjust');
      return;
    }

    // Open adjustment dialog
    await adjustButtons.first().click();

    // Try to submit without reason
    const quantityInput = page.locator('input[type="number"]');
    await quantityInput.fill('5');

    await page.locator('button').filter({ hasText: 'Adjust Stock' }).click();

    // Should show validation error
    await expect(page.locator('text=/reason is required/i')).toBeVisible();

    // Try negative adjustment that exceeds stock
    await quantityInput.fill('-9999');
    const reasonInput = page.locator('textarea');
    await reasonInput.fill('Test');

    await page.locator('button').filter({ hasText: 'Adjust Stock' }).click();

    // Should show validation error
    await expect(page.locator('text=/cannot be negative/i')).toBeVisible();
  });

  test('should handle pagination', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check if pagination controls exist (if there are enough items)
    const paginationControls = page.locator('[aria-label="Pagination"]');

    if (await paginationControls.isVisible()) {
      // Click next page
      const nextButton = page.locator('button[aria-label="Go to next page"]');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Verify page changed
        const currentPageIndicator = page.locator('text=/Page 2/');
        await expect(currentPageIndicator).toBeVisible();
      }
    }
  });

  test('should export inventory data', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Look for export button
    const exportButton = page.locator('button').filter({ hasText: 'Export' });

    if (await exportButton.isVisible()) {
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/inventory.*\.csv/);
    }
  });

  test('should display correct stock status indicators', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check for different stock status indicators
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      const onHand = await row.locator('td:nth-child(4)').textContent();
      const available = await row.locator('td:nth-child(5)').textContent();

      const onHandValue = parseInt(onHand || '0');
      const availableValue = parseInt(available || '0');

      // Available should be less than or equal to on hand
      expect(availableValue).toBeLessThanOrEqual(onHandValue);
    }
  });
});
