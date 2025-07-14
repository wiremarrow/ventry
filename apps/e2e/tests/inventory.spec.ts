import { test, expect } from '../fixtures/base.fixture';
import { createTestUser } from '../utils/test-helpers';
import { cleanupTestDataForUser } from '../utils/db-cleanup';

test.describe('Inventory Management', () => {
  let testUser: any;

  test.beforeAll(async () => {
    // Create a test user with organization
    testUser = await createTestUser({
      email: `inventory-test-${Date.now()}@ventry.e2e.test`,
      username: `invtest-${Date.now()}`,
      password: 'TestPassword123!',
      createOrganization: true,
      seedInventory: true, // This should create test inventory data
    });
  });

  test.afterAll(async () => {
    if (testUser) {
      await cleanupTestDataForUser(testUser.id);
    }
  });

  test.beforeEach(async ({ cleanPage: page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
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
    await expect(page.locator('th').filter({ hasText: 'Product' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'SKU' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Category' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Location' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'On Hand' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Available' })).toBeVisible();
  });

  test('should filter inventory by search term', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Type in search box
    const searchInput = page.locator('input[placeholder="Search products..."]');
    await searchInput.fill('Laptop');
    
    // Wait for filtered results
    await page.waitForTimeout(500); // Debounce delay
    
    // Check that results are filtered
    const productCells = page.locator('td:first-child');
    const count = await productCells.count();
    
    for (let i = 0; i < count; i++) {
      const text = await productCells.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('laptop');
    }
  });

  test('should filter inventory by warehouse', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Open warehouse dropdown
    const warehouseSelect = page.locator('button[role="combobox"]');
    await warehouseSelect.click();
    
    // Select a specific warehouse (assuming test data has "Main Warehouse")
    await page.locator('text=Main Warehouse').click();
    
    // Wait for filtered results
    await page.waitForTimeout(500);
    
    // Verify that all items shown are from the selected warehouse
    const locationCells = page.locator('td:nth-child(4)'); // Location column
    const count = await locationCells.count();
    
    for (let i = 0; i < count; i++) {
      const text = await locationCells.nth(i).textContent();
      expect(text).toContain('Main Warehouse');
    }
  });

  test('should toggle low stock filter', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Toggle low stock switch
    const lowStockSwitch = page.locator('label').filter({ hasText: 'Low stock only' }).locator('button');
    await lowStockSwitch.click();
    
    // Wait for filtered results
    await page.waitForTimeout(500);
    
    // Check that low stock indicator is visible on items
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    
    // Should have at least one low stock item
    expect(rowCount).toBeGreaterThan(0);
    
    // All visible items should be low stock (check for visual indicator)
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      // Look for low stock styling or indicator
      const classes = await row.getAttribute('class');
      expect(classes).toContain('bg-red-50');
    }
  });

  test('should open stock adjustment dialog', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Click adjust button on first item
    const adjustButton = page.locator('button').filter({ hasText: 'Adjust' }).first();
    await adjustButton.click();
    
    // Check dialog is open
    await expect(page.locator('h2').filter({ hasText: 'Adjust Stock' })).toBeVisible();
    
    // Check dialog shows current stock info
    await expect(page.locator('text=Current Stock:')).toBeVisible();
    await expect(page.locator('text=Location:')).toBeVisible();
  });

  test('should adjust stock quantity', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Get initial stock value
    const initialStock = await page.locator('tbody tr').first().locator('td:nth-child(5)').textContent();
    const initialValue = parseInt(initialStock || '0');
    
    // Open adjustment dialog
    await page.locator('button').filter({ hasText: 'Adjust' }).first().click();
    
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
    const newStock = await page.locator('tbody tr').first().locator('td:nth-child(5)').textContent();
    const newValue = parseInt(newStock || '0');
    
    expect(newValue).toBe(initialValue + 10);
    
    // Check for success toast
    await expect(page.locator('text=Stock adjusted successfully')).toBeVisible();
  });

  test('should validate stock adjustment form', async ({ cleanPage: page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    
    // Open adjustment dialog
    await page.locator('button').filter({ hasText: 'Adjust' }).first().click();
    
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
      const onHand = await row.locator('td:nth-child(5)').textContent();
      const available = await row.locator('td:nth-child(6)').textContent();
      
      const onHandValue = parseInt(onHand || '0');
      const availableValue = parseInt(available || '0');
      
      // Available should be less than or equal to on hand
      expect(availableValue).toBeLessThanOrEqual(onHandValue);
    }
  });
});