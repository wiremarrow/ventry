import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

test.describe('Warehouses Page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    
    // Navigate to warehouses with retry for Mobile Safari navigation interruptions
    await test.step('Navigate to warehouses', async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('/warehouses', { waitUntil: 'networkidle' });
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
    
    // Verify we're on the warehouses page
    await expect(page.getByRole('heading', { name: 'Warehouses', level: 1 })).toBeVisible();
  });

  test('displays warehouses page with correct layout', async ({ page }) => {
    // Check page title and description
    await expect(page.getByRole('heading', { name: 'Warehouses', level: 1 })).toBeVisible();
    await expect(page.getByText('Manage warehouse locations and storage capacity')).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add warehouse/i })).toBeVisible();

    // Check stats cards
    await expect(page.getByText('Total Warehouses')).toBeVisible();
    await expect(page.getByText('Total Locations')).toBeVisible();
    await expect(page.getByText('Total Capacity')).toBeVisible();

    // Check search input
    await expect(page.getByPlaceholder('Search warehouses...')).toBeVisible();
  });

  test('can create a new warehouse', async ({ page }) => {
    // Click add warehouse button
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });

    // Check dialog opens
    await expect(page.getByText('Add New Warehouse')).toBeVisible();

    // Fill out form with unique code and name
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `E2E-${timestamp}`;
    const warehouseName = `E2E Test Warehouse ${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill(warehouseName);
    await page.getByLabel('Address Line 1 *').fill('123 Test Street');
    await page.getByLabel('City *').fill('Test City');
    await page.getByLabel('State/Province *').fill('TC');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('12345');
    await page.getByLabel('Phone').fill('+1-555-0123');
    await page.getByLabel('Notes').fill('Created via E2E test');

    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Wait a moment for the list to refresh
    await page.waitForTimeout(1000);

    // Verify warehouse appears in list - find the specific row
    const warehouseRow = page.locator('tr').filter({ hasText: warehouseCode });
    await expect(warehouseRow).toBeVisible({ timeout: 10000 });
    await expect(warehouseRow.getByText(warehouseName)).toBeVisible();
    await expect(warehouseRow.getByText('Test City, TC')).toBeVisible();
  });

  test('validates required fields in create dialog', async ({ page }) => {
    // Click add warehouse button
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });

    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Check validation errors appear
    await expect(page.getByText('Code is required', { exact: true })).toBeVisible();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Address is required')).toBeVisible();
    await expect(page.getByText('City is required')).toBeVisible();
    await expect(page.getByText('State is required')).toBeVisible();
    await expect(page.getByText('Postal code is required')).toBeVisible();
  });

  test('can search warehouses', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `SCH-${timestamp}`;
    const warehouseName = `Searchable Warehouse ${timestamp}`; // Make name unique
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill(warehouseName);
    await page.getByLabel('Address Line 1 *').fill('456 Search Ave');
    await page.getByLabel('City *').fill('Search City');
    await page.getByLabel('State/Province *').fill('SC');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('54321');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Wait for the new warehouse to appear in the list
    await page.waitForTimeout(1000);

    // Search for the warehouse using a unique part of the name
    await page.getByPlaceholder('Search warehouses...').fill(timestamp.toString());

    // Verify filtered results - look for the specific warehouse name
    await expect(page.getByText(warehouseName)).toBeVisible();

    // Search for something that doesn't exist
    await page.getByPlaceholder('Search warehouses...').fill('xyznonexistent123');
    await expect(page.getByText('No warehouses found')).toBeVisible();
    await expect(page.getByText('Try adjusting your search')).toBeVisible();
  });

  test('can view warehouse details', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `DTL-${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill('Details Test Warehouse');
    await page.getByLabel('Address Line 1 *').fill('789 Details Blvd');
    await page.getByLabel('City *').fill('Details City');
    await page.getByLabel('State/Province *').fill('DC');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('78901');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Wait for the new warehouse to appear in the list
    await page.waitForTimeout(1000);

    // Find the specific warehouse row and click its menu
    const warehouseRow = page.locator('tr').filter({ hasText: warehouseCode });
    await warehouseRow.getByRole('button', { name: 'Open menu' }).click();

    // Click view details
    await page.getByRole('menuitem', { name: 'View Details' }).click();

    // Check details dialog opens - check the dialog title heading
    await expect(page.getByRole('heading', { name: 'Details Test Warehouse', level: 2 })).toBeVisible();
    await expect(
      page.getByText('Manage warehouse locations and view performance statistics')
    ).toBeVisible();

    // Check tabs are present - use buttons to be specific
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Locations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible();

    // Check warehouse information is displayed - look within the dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(warehouseCode)).toBeVisible();
    await expect(dialog.getByText('789 Details Blvd')).toBeVisible();
    await expect(dialog.getByText('Details City, DC 78901')).toBeVisible();
  });

  test('can create locations within warehouse', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `LOC-${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill('Location Test Warehouse');
    await page.getByLabel('Address Line 1 *').fill('321 Location Lane');
    await page.getByLabel('City *').fill('Location City');
    await page.getByLabel('State/Province *').fill('LC');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('32100');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Wait for the new warehouse to appear in the list
    await page.waitForTimeout(1000);

    // Find the specific warehouse row and open its menu
    const warehouseRow = page.locator('tr').filter({ hasText: warehouseCode });
    await warehouseRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'View Details' }).click();

    // Wait for details dialog to load - check dialog title instead
    await expect(page.getByRole('heading', { name: 'Location Test Warehouse' })).toBeVisible();

    // Switch to locations tab using the button
    await page.getByRole('button', { name: 'Locations' }).click();

    // Click add location
    await page.getByRole('button', { name: /add location/i }).click({ force: true });

    // Check location dialog opens
    await expect(page.getByText('Add New Location')).toBeVisible();

    // Fill location form with unique location code
    const locationCode = `A1-${timestamp}`;
    await page.getByLabel('Location Code *').fill(locationCode);
    await page.getByLabel('Description').fill('Test location');
    await page.getByLabel('Zone').fill('A');
    await page.getByLabel('Aisle').fill('01');
    await page.getByLabel('Shelf').fill('A');
    await page.getByLabel('Bin').fill('001');
    await page.getByLabel('Maximum Capacity').fill('100');

    // Submit location form
    await page.getByRole('button', { name: /create location/i }).click({ force: true });

    // Wait for location dialog to close
    await expect(page.getByText('Add New Location')).not.toBeVisible();

    // Verify location appears in the list
    await expect(page.getByText(locationCode)).toBeVisible();
    await expect(page.getByText('Test location')).toBeVisible();
    await expect(page.getByText('01 - A - 001')).toBeVisible();
  });

  test('can edit warehouse information', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `EDT-${timestamp}`;
    const originalName = `Original Warehouse ${timestamp}`;
    const updatedName = `Updated Warehouse ${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill(originalName);
    await page.getByLabel('Address Line 1 *').fill('Original Address');
    await page.getByLabel('City *').fill('Original City');
    await page.getByLabel('State/Province *').fill('OC');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('11111');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Wait for the new warehouse to appear in the list
    await page.waitForTimeout(1000);

    // Find the specific warehouse row and click its menu
    const warehouseRow = page.locator('tr').filter({ hasText: warehouseCode });
    await warehouseRow.getByRole('button', { name: 'Open menu' }).click();

    // Click edit from the dropdown menu
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Check edit dialog opens with pre-filled data
    await expect(page.getByText('Edit Warehouse')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Warehouse Name *' })).toHaveValue(originalName);

    // Update the name
    await page.getByLabel('Warehouse Name *').fill(updatedName);
    await page.getByLabel('City *').fill('Updated City');

    // Submit changes - scroll to button first for mobile viewports
    const updateButton = page.getByRole('button', { name: /update warehouse/i });
    await updateButton.scrollIntoViewIfNeeded();
    await updateButton.click({ force: true });

    // Wait for dialog to close
    await expect(page.getByText('Edit Warehouse')).not.toBeVisible();

    // Wait for list to refresh
    await page.waitForTimeout(1000);

    // Verify changes are reflected in the list - find the specific row
    const updatedRow = page.locator('tr').filter({ hasText: warehouseCode });
    await expect(updatedRow.getByText(updatedName)).toBeVisible();
    await expect(updatedRow.getByText('Updated City, OC')).toBeVisible();
  });

  test.skip('can delete empty warehouse', async ({ page }) => {
    // Skip this test as delete functionality is not implemented
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now();
    const warehouseCode = `DELETE-${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill('Warehouse To Delete');
    await page.getByLabel('Address Line 1 *').fill('Delete Me Street');
    await page.getByLabel('City *').fill('Delete City');
    await page.getByLabel('State/Province *').fill('DL');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('99999');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Find the specific warehouse row and click its menu
    const warehouseRow = page.locator('tr', { hasText: warehouseCode });
    await warehouseRow.getByRole('button', { name: 'Open menu' }).click();

    // Note: Delete functionality is not implemented in the UI
    // This test is skipped until the feature is added
  });

  test('displays correct statistics', async ({ page }) => {
    // Get initial warehouse count - look for the number after "Total Warehouses"
    const statsCard = page.locator('text=Total Warehouses').locator('..');
    const initialCountText = await statsCard.locator('p').nth(1).textContent();
    const initialCount = parseInt(initialCountText || '0');

    // Create a warehouse
    await page.getByRole('button', { name: /add warehouse/i }).click({ force: true });
    const timestamp = Date.now().toString().slice(-6); // Use last 6 digits
    const warehouseCode = `STS-${timestamp}`;
    await page.getByLabel('Warehouse Code *').fill(warehouseCode);
    await page.getByLabel('Warehouse Name *').fill('Stats Warehouse');
    await page.getByLabel('Address Line 1 *').fill('Stats Street');
    await page.getByLabel('City *').fill('Stats City');
    await page.getByLabel('State/Province *').fill('ST');
    await page.getByLabel('Country *').clear();
    await page.getByLabel('Country *').fill('USA');
    await page.getByLabel('Postal Code *').fill('55555');
    
    // Submit form - scroll to button first for mobile viewports
    const submitButton = page.getByRole('button', { name: /create warehouse/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for success toast
    await expect(page.getByText('Warehouse created successfully')).toBeVisible();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();
    
    // Wait for the new warehouse to appear in the list to ensure data is refreshed
    await expect(page.locator('tr').filter({ hasText: warehouseCode })).toBeVisible({ timeout: 10000 });

    // Now check the updated stats - wait for the count to update
    await expect(async () => {
      const updatedStatsCard = page.locator('text=Total Warehouses').locator('..');
      const updatedCountText = await updatedStatsCard.locator('p').nth(1).textContent();
      const updatedCount = parseInt(updatedCountText || '0');
      expect(updatedCount).toBe(initialCount + 1);
    }).toPass({ timeout: 5000 });
  });
});
