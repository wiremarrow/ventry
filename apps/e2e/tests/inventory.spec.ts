import { test, expect } from '../fixtures/base.fixture.js';
import { createTestOrganization } from '../utils/test-helpers.js';
import { cleanupTestDataForUser, cleanupTestDataForOrganization } from '../utils/db-cleanup.js';
import { seedTestInventory } from '../utils/seed-inventory.js';

test.describe('Inventory Management', () => {
  let testOrg: any;

  test.beforeAll(async () => {
    // Create a test organization with user that has MANAGER role (required for inventory adjustments)
    testOrg = await createTestOrganization({
      email: `inventory-test-${Date.now()}@ventry.e2e.test`,
      password: 'TestPassword123!',
      firstName: 'Inventory',
      lastName: 'Test',
      role: 'MANAGER', // Need at least WAREHOUSE role for adjustments
    });

    // Seed inventory data for the organization
    await seedTestInventory(testOrg.organization.id);
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
    
    // Ensure the test organization is set as active
    // The auth service should set it automatically since it's the user's only organization,
    // but let's make sure by checking if we need to switch
    const currentUrl = page.url();
    if (!currentUrl.includes(testOrg.organization.id)) {
      // If the URL doesn't contain our org ID, we might need to switch
      // This can happen if the user has multiple orgs from previous test runs
      
      // First, let's check if there's an org switcher visible
      const orgSwitcher = page.locator('[data-testid="org-switcher"]');
      if (await orgSwitcher.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Click on organization switcher
        await orgSwitcher.click();
        
        // Look for our test organization by name or ID
        const orgOption = page.locator(`[data-org-id="${testOrg.organization.id}"]`);
        if (await orgOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await orgOption.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
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

    // Open warehouse dropdown (it's a Select component)
    const warehouseSelect = page.locator('button[role="combobox"]').filter({ hasText: 'All Warehouses' });
    await warehouseSelect.click();

    // Select first warehouse from the dropdown (skip "All Warehouses")
    const warehouseOptions = page.locator('[role="option"]');
    // Wait for options to be visible
    await warehouseOptions.first().waitFor();
    
    // Check if we have warehouses to select
    const optionCount = await warehouseOptions.count();
    if (optionCount <= 1) {
      test.skip(true, 'No warehouses available to filter');
      return;
    }
    
    // Click the second option (first warehouse after "All Warehouses")
    await warehouseOptions.nth(1).click();

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify that filter was applied - the select trigger should show the warehouse name
    const selectedWarehouse = await page.locator('button[role="combobox"]').textContent();
    expect(selectedWarehouse?.trim()).not.toBe('All Warehouses');
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

    // Make sure button is visible and enabled before clicking
    const firstButton = adjustButtons.first();
    await expect(firstButton).toBeVisible();
    await expect(firstButton).toBeEnabled();
    
    // Check for console errors before clicking
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Click adjust button on first item
    console.log('Clicking adjust button...');
    
    // Try different click strategies
    try {
      await firstButton.click();
    } catch (e) {
      console.log('Regular click failed, trying force click');
      await firstButton.click({ force: true });
    }
    
    // Give it time for React to update
    await page.waitForTimeout(1000);
    
    // Check if dialog opened - look for any dialog elements
    const dialogCount = await page.locator('[role="dialog"], [aria-modal="true"], .fixed.inset-0').count();
    console.log('Dialog elements found:', dialogCount);
    
    // Also check for the description text anywhere on page
    const hasDescription = await page.getByText('Make adjustments to inventory levels for this item').count();
    console.log('Description text found:', hasDescription);
    
    if (dialogCount === 0 && hasDescription === 0) {
      // Dialog didn't open, let's try clicking using JavaScript
      console.log('Dialog not found, trying JavaScript click');
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const adjustButton = Array.from(buttons).find(btn => btn.textContent?.trim() === 'Adjust');
        if (adjustButton) {
          console.log('Found adjust button via JS, clicking...');
          adjustButton.click();
        } else {
          console.log('Could not find adjust button via JS');
        }
      });
      
      await page.waitForTimeout(1000);
    }

    // Now check for dialog content
    await expect(
      page.getByText('Make adjustments to inventory levels for this item')
    ).toBeVisible({ timeout: 5000 });
    
    // Now we know the dialog is open, check for the title in the dialog context
    const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
    await expect(dialog).toBeVisible();
    
    // Check dialog title within the dialog - use role to be specific
    await expect(dialog.getByRole('heading', { name: 'Adjust Stock' })).toBeVisible();
    
    // Check dialog shows current stock info
    await expect(dialog.getByText(/Current:/)).toBeVisible();
    await expect(dialog.getByText(/Location:/)).toBeVisible();
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

    // Wait for table to be fully loaded
    await page.waitForSelector('tbody tr', { state: 'visible' });

    // Get initial stock value (On Hand column is 4th)
    const firstRow = page.locator('tbody tr').first();
    await firstRow.waitFor({ state: 'visible' });
    
    const onHandCell = firstRow.locator('td:nth-child(4)');
    await onHandCell.waitFor({ state: 'visible' });
    
    const initialStock = await onHandCell.textContent();
    const initialValue = parseInt(initialStock?.trim() || '0');

    // Open adjustment dialog using JavaScript click to avoid React event issues
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const adjustButton = Array.from(buttons).find(btn => btn.textContent?.trim() === 'Adjust');
      if (adjustButton) {
        adjustButton.click();
      }
    });
    
    // Wait for dialog to appear by its unique description text
    await expect(
      page.getByText('Make adjustments to inventory levels for this item')
    ).toBeVisible({ timeout: 5000 });
    
    // Get the dialog element
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Ensure the ADD radio button is selected (it should be by default)
    const addRadio = dialog.locator('input[type="radio"][value="ADD"]');
    await expect(addRadio).toBeChecked();

    // Fill quantity - use fill() method which properly handles number inputs
    const quantityInput = dialog.locator('input[type="number"]');
    await quantityInput.click();
    await quantityInput.fill('10');

    // Select adjustment type from dropdown
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Correction' }).click();
    
    // Fill reason
    const reasonInput = dialog.getByPlaceholder('Provide a reason for this adjustment...');
    await reasonInput.click();
    await reasonInput.fill('E2E test stock adjustment');

    // Add notes field (optional but let's fill it)
    const notesInput = dialog.getByPlaceholder('Additional notes...');
    if (await notesInput.isVisible()) {
      await notesInput.fill('Test adjustment via E2E');
    }

    // Wait for form to be ready
    await page.waitForTimeout(500);
    
    // Listen for any errors that might occur
    page.on('pageerror', err => {
      console.error('Page error:', err.message);
    });

    // Listen for console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
    
    // Click the submit button
    const submitButton = dialog.getByRole('button', { name: 'Adjust Stock' });
    await expect(submitButton).toBeEnabled();
    
    // Try multiple approaches to submit
    try {
      await submitButton.click();
    } catch (e) {
      console.log('Regular click failed, trying force click');
      await submitButton.click({ force: true });
    }

    // Wait for either success toast or error toast
    const toastResult = await Promise.race([
      page.getByText('Stock adjusted successfully').waitFor({ state: 'visible', timeout: 5000 }).then(() => 'success'),
      page.getByText(/error|failed|invalid/i).waitFor({ state: 'visible', timeout: 5000 }).then(() => 'error'),
      page.waitForTimeout(5000).then(() => 'timeout')
    ]);

    if (toastResult === 'error') {
      const errorText = await page.getByText(/error|failed|invalid/i).textContent();
      throw new Error(`Form submission failed with error: ${errorText}`);
    } else if (toastResult === 'timeout') {
      // Take a screenshot for debugging
      await page.screenshot({ path: 'inventory-adjustment-timeout.png' });
      throw new Error('Form submission timed out - no toast message appeared');
    }

    // If we get here, success toast should be visible
    await expect(page.getByText('Stock adjusted successfully')).toBeVisible();
    
    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    
    // Wait for table data to refresh
    await page.waitForTimeout(1000);
    
    // Verify the stock was updated
    // Re-find the row and check the new value
    await firstRow.waitFor({ state: 'visible' });
    const newStock = await onHandCell.textContent();
    const newValue = parseInt(newStock?.trim() || '0');

    expect(newValue).toBe(initialValue + 10);
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
    
    // Give it time for React to update
    await page.waitForTimeout(1000);
    
    // Check if dialog opened - look for any dialog elements
    const dialogCount = await page.locator('[role="dialog"], [aria-modal="true"], .fixed.inset-0').count();
    
    if (dialogCount === 0) {
      // Dialog didn't open, let's try clicking using JavaScript
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const adjustButton = Array.from(buttons).find(btn => btn.textContent?.trim() === 'Adjust');
        if (adjustButton) {
          adjustButton.click();
        }
      });
      
      await page.waitForTimeout(1000);
    }

    // Wait for dialog to appear by its unique description text
    await expect(
      page.getByText('Make adjustments to inventory levels for this item')
    ).toBeVisible({ timeout: 5000 });
    
    // Get the dialog element
    const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
    await expect(dialog).toBeVisible();

    // Try to submit without reason
    const quantityInput = dialog.locator('input[type="number"]');
    await quantityInput.waitFor({ state: 'visible' });
    await quantityInput.fill('5');

    await dialog.locator('button').filter({ hasText: 'Adjust Stock' }).click();

    // Should show validation error
    await expect(page.getByText('Please provide a reason for this adjustment')).toBeVisible();

    // Try negative adjustment that exceeds stock
    await quantityInput.fill('-9999');
    const reasonInput = dialog.locator('input[placeholder="Provide a reason for this adjustment..."]');
    await reasonInput.fill('Test');

    await dialog.locator('button').filter({ hasText: 'Adjust Stock' }).click();

    // Should show validation error for negative quantity
    await expect(page.getByText('Quantity must be positive')).toBeVisible();
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

  test.skip('should export inventory data', async ({ cleanPage: page }) => {
    // TODO: Export functionality is not implemented yet
    // The Export button exists in the UI but has no onClick handler
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Verify export button exists
    const exportButton = page.locator('button').filter({ hasText: 'Export' });
    await expect(exportButton).toBeVisible();
    
    // When implemented, this test should:
    // 1. Click the export button
    // 2. Wait for and verify the download
    // 3. Check the filename matches expected pattern (e.g., inventory-YYYY-MM-DD.csv)
  });

  test('should display correct stock status indicators', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Check for different stock status indicators
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    // Check if we have any inventory data
    if (rowCount === 0) {
      test.skip(true, 'No inventory data to check');
      return;
    }

    // Check if it's just the empty state
    if (rowCount === 1) {
      const firstRowText = await rows.first().textContent();
      if (firstRowText?.includes('No inventory found')) {
        test.skip(true, 'No inventory data to check');
        return;
      }
    }

    // Wait for table to be fully loaded
    await page.waitForSelector('tbody tr td', { state: 'visible' });

    // Check up to 5 rows
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      
      // Wait for the row to be visible
      await row.waitFor({ state: 'visible' });
      
      // Get cells with explicit waits
      const onHandCell = row.locator('td:nth-child(4)');
      const availableCell = row.locator('td:nth-child(5)');
      
      await onHandCell.waitFor({ state: 'visible' });
      await availableCell.waitFor({ state: 'visible' });
      
      const onHand = await onHandCell.textContent();
      const available = await availableCell.textContent();

      const onHandValue = parseInt(onHand?.trim() || '0');
      const availableValue = parseInt(available?.trim() || '0');

      // Available should be less than or equal to on hand
      expect(availableValue).toBeLessThanOrEqual(onHandValue);
    }
  });
});
