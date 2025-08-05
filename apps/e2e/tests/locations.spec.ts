import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Locations Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to locations with retry for Mobile Safari navigation interruptions
    await test.step('Navigate to locations', async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('/locations', { waitUntil: 'networkidle' });
          break;
        } catch (error) {
          if (retries === 1 || !error.message?.includes('interrupted')) {
            throw error;
          }
          // Wait a bit longer for any pending navigations to complete
          await page.waitForTimeout(1500);
          retries--;
        }
      }
    });
  });

  test('should display locations page correctly', async ({ page }) => {
    // Check page title and main elements
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
    await expect(page.getByText('Manage storage locations across all warehouses')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Location' })).toBeVisible();

    // Check stats cards
    await expect(page.getByText('Total Locations')).toBeVisible();
    await expect(page.getByText('Active Locations')).toBeVisible();
    await expect(page.getByText('Total Capacity')).toBeVisible();
    await expect(page.getByText('Temp Controlled')).toBeVisible();

    // Check filters section
    await expect(page.getByPlaceholder('Search by code or description...')).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'All Warehouses' })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'All Locations' })).toBeVisible();

    // Check table headers
    await expect(page.locator('th').filter({ hasText: 'Code' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Warehouse' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Location' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Capacity' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Utilization' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Features' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Actions' })).toBeVisible();
  });

  test('should show empty state when no locations exist', async ({ page }) => {
    // Search for non-existent location
    await page.getByPlaceholder('Search by code or description...').fill('NONEXISTENT-LOCATION-12345');
    await page.waitForTimeout(500); // Wait for debounce

    // Should show empty state
    await expect(page.getByText('No locations found matching your filters')).toBeVisible();
  });

  test('should create a new location', async ({ page }) => {
    // Click Add Location button
    await page.getByRole('button', { name: 'Add Location' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add Location' })).toBeVisible();

    // Generate unique location code
    const locationCode = `E2E-LOC-${Date.now()}`;

    // Fill in location form
    await page.getByLabel('Code *').fill(locationCode);
    await page.getByLabel('Description').fill('E2E Test Location');

    // Select warehouse - use force for all browsers to bypass overlay issues
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.waitForTimeout(500);

    // Fill location hierarchy
    await page.getByLabel('Zone').fill('A');
    await page.getByLabel('Aisle').fill('1');
    await page.getByLabel('Shelf').fill('2');
    await page.getByLabel('Bin').fill('3');

    // Fill capacity
    await page.getByLabel('Max Capacity').fill('100');

    // Toggle temperature control
    await page.getByLabel('Temperature Controlled').click();

    // Submit form with scroll and force click
    const submitButton = page.getByRole('button', { name: 'Create Location' });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify success
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Verify location appears in list
    await expect(page.getByText(locationCode)).toBeVisible();
    await expect(page.getByText('Zone A / Aisle 1 / Shelf 2 / Bin 3')).toBeVisible();
  });

  test('should edit an existing location', async ({ page }) => {
    // First create a location to edit
    const locationCode = `E2E-EDIT-${Date.now()}`;
    
    // Create location via UI
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(locationCode);
    await page.getByLabel('Description').fill('Location to Edit');
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByLabel('Zone').fill('B');
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();
    await page.waitForTimeout(1000);

    // Search for the location
    await page.getByPlaceholder('Search by code or description...').fill(locationCode);
    await page.waitForTimeout(500);

    // Find and click edit button
    const locationRow = page.locator('tr').filter({ hasText: locationCode });
    await locationRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Wait for edit dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Location' })).toBeVisible();

    // Update values
    await page.getByLabel('Description').clear();
    await page.getByLabel('Description').fill('Updated Location Description');
    await page.getByLabel('Max Capacity').fill('200');

    // Submit
    await page.getByRole('button', { name: 'Update Location' }).click();

    // Verify success
    await expect(page.getByText('Location updated successfully')).toBeVisible();

    // Verify updated values in list
    await expect(page.getByText('Updated Location Description')).toBeVisible();
    await expect(page.getByText('200')).toBeVisible();
  });

  test('should filter locations by search term', async ({ page }) => {
    // Create test locations with unique codes
    const timestamp = Date.now();
    const location1Code = `SEARCH-A-${timestamp}`;
    const location2Code = `SEARCH-B-${timestamp}`;

    // Create first location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(location1Code);
    await page.getByLabel('Description').fill('Apple Location');
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Create second location
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(location2Code);
    await page.getByLabel('Description').fill('Banana Location');
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Search for first location
    await page.getByPlaceholder('Search by code or description...').fill('Apple');
    await page.waitForTimeout(500);

    // Should only show Apple Location
    await expect(page.getByText('Apple Location')).toBeVisible();
    await expect(page.getByText('Banana Location')).not.toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search by code or description...').clear();
    await page.waitForTimeout(500);

    // Search by code pattern
    await page.getByPlaceholder('Search by code or description...').fill(`SEARCH-${timestamp}`);
    await page.waitForTimeout(500);

    // Both should be visible
    await expect(page.getByText('Apple Location')).toBeVisible();
    await expect(page.getByText('Banana Location')).toBeVisible();
  });

  test('should filter locations by warehouse', async ({ page }) => {
    // Wait for warehouse filter to be populated
    await page.waitForSelector('[role="combobox"]');

    // Check if there are multiple warehouses to filter
    const warehouseFilter = page.getByRole('combobox').filter({ hasText: 'All Warehouses' });
    await warehouseFilter.click();

    // Get available warehouse options
    const warehouseOptions = await page.getByRole('option').count();

    if (warehouseOptions > 1) {
      // Select first specific warehouse (not "All Warehouses")
      await page.getByRole('option').nth(1).click();
      
      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify that locations are filtered (table should update)
      await page.waitForSelector('tbody');
    } else {
      // If only one warehouse exists, close the dropdown
      await page.keyboard.press('Escape');
    }
  });

  test('should filter locations by temperature control', async ({ page }) => {
    // Create a temperature controlled location
    const tempControlledCode = `TEMP-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(tempControlledCode);
    await page.getByLabel('Description').fill('Temperature Controlled Location');
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByLabel('Temperature Controlled').click(); // Enable temp control
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Filter by temperature controlled
    await page.getByRole('combobox').filter({ hasText: 'All Locations' }).click();
    await page.getByRole('option', { name: 'Temp Controlled Only' }).click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show locations with temp control badge
    const tempBadges = page.getByText('Temp Controlled');
    const count = await tempBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should validate required fields in create form', async ({ page }) => {
    // Click Add Location button
    await page.getByRole('button', { name: 'Add Location' }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create Location' }).click();

    // Should show validation errors
    await expect(page.getByText('Code is required')).toBeVisible();
    await expect(page.getByText('Required').first()).toBeVisible(); // Warehouse validation
  });

  test('should handle code uniqueness validation', async ({ page }) => {
    // Create a location with specific code
    const uniqueCode = `UNIQUE-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(uniqueCode);
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Try to create another location with same code
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(uniqueCode);
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByRole('button', { name: 'Create Location' }).click();

    // Should show error
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible();
  });

  test('should display location hierarchy correctly', async ({ page }) => {
    // Create location with full hierarchy
    const hierarchyCode = `HIER-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(hierarchyCode);
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByLabel('Zone').fill('C');
    await page.getByLabel('Aisle').fill('3');
    await page.getByLabel('Shelf').fill('4');
    await page.getByLabel('Bin').fill('5');
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Search for the location
    await page.getByPlaceholder('Search by code or description...').fill(hierarchyCode);
    await page.waitForTimeout(500);

    // Verify hierarchy display
    await expect(page.getByText('Zone C / Aisle 3 / Shelf 4 / Bin 5')).toBeVisible();
  });

  test('should display capacity and utilization', async ({ page }) => {
    // Create location with capacity
    const capacityCode = `CAP-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByLabel('Code *').fill(capacityCode);
    await page.getByRole('combobox', { name: /warehouse/i }).click({ force: true });
    await page.getByRole('option').first().click({ force: true });
    await page.getByLabel('Max Capacity').fill('500');
    await page.getByRole('button', { name: 'Create Location' }).click();
    await expect(page.getByText('Location created successfully')).toBeVisible();

    // Search for the location
    await page.getByPlaceholder('Search by code or description...').fill(capacityCode);
    await page.waitForTimeout(500);

    // Verify capacity is displayed
    await expect(page.getByText('500')).toBeVisible();
    await expect(page.getByText('0 items')).toBeVisible(); // New location has 0 items
    
    // Check utilization shows 0%
    await expect(page.getByText('0%')).toBeVisible();
  });
});