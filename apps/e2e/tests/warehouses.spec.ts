import { test, expect } from '@playwright/test';
import { authenticateUser } from './helpers/auth';

test.describe('Warehouses Page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/warehouses');
  });

  test('displays warehouses page with correct layout', async ({ page }) => {
    // Check page title and description
    await expect(page.locator('h1')).toContainText('Warehouses');
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
    await page.getByRole('button', { name: /add warehouse/i }).click();

    // Check dialog opens
    await expect(page.getByText('Add New Warehouse')).toBeVisible();

    // Fill out form
    await page.getByLabel('Warehouse Code *').fill('E2E-WH-001');
    await page.getByLabel('Warehouse Name *').fill('E2E Test Warehouse');
    await page.getByLabel('Address Line 1 *').fill('123 Test Street');
    await page.getByLabel('City *').fill('Test City');
    await page.getByLabel('State/Province *').fill('TC');
    await page.getByLabel('Postal Code *').fill('12345');
    await page.getByLabel('Phone').fill('+1-555-0123');
    await page.getByLabel('Notes').fill('Created via E2E test');

    // Submit form
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for success and dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Verify warehouse appears in list
    await expect(page.getByText('E2E-WH-001')).toBeVisible();
    await expect(page.getByText('E2E Test Warehouse')).toBeVisible();
    await expect(page.getByText('Test City, TC')).toBeVisible();
  });

  test('validates required fields in create dialog', async ({ page }) => {
    // Click add warehouse button
    await page.getByRole('button', { name: /add warehouse/i }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Check validation errors appear
    await expect(page.getByText('Code is required')).toBeVisible();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Address is required')).toBeVisible();
    await expect(page.getByText('City is required')).toBeVisible();
    await expect(page.getByText('State is required')).toBeVisible();
    await expect(page.getByText('Postal code is required')).toBeVisible();
  });

  test('can search warehouses', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('SEARCH-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Searchable Warehouse');
    await page.getByLabel('Address Line 1 *').fill('456 Search Ave');
    await page.getByLabel('City *').fill('Search City');
    await page.getByLabel('State/Province *').fill('SC');
    await page.getByLabel('Postal Code *').fill('54321');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Search for the warehouse
    await page.getByPlaceholder('Search warehouses...').fill('searchable');

    // Verify filtered results
    await expect(page.getByText('Searchable Warehouse')).toBeVisible();
    
    // Search for something that doesn't exist
    await page.getByPlaceholder('Search warehouses...').fill('nonexistent');
    await expect(page.getByText('No warehouses found')).toBeVisible();
    await expect(page.getByText('Try adjusting your search')).toBeVisible();
  });

  test('can view warehouse details', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('DETAILS-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Details Test Warehouse');
    await page.getByLabel('Address Line 1 *').fill('789 Details Blvd');
    await page.getByLabel('City *').fill('Details City');
    await page.getByLabel('State/Province *').fill('DC');
    await page.getByLabel('Postal Code *').fill('78901');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Click on the dropdown menu for the warehouse
    await page.locator('button[aria-label="Open menu"]').first().click();

    // Click view details
    await page.getByText('View Details').click();

    // Check details dialog opens
    await expect(page.getByText('Details Test Warehouse')).toBeVisible();
    await expect(page.getByText('Manage warehouse locations and view performance statistics')).toBeVisible();

    // Check tabs are present
    await expect(page.getByText('Overview')).toBeVisible();
    await expect(page.getByText('Locations')).toBeVisible();
    await expect(page.getByText('Analytics')).toBeVisible();

    // Check warehouse information is displayed
    await expect(page.getByText('DETAILS-WH-001')).toBeVisible();
    await expect(page.getByText('789 Details Blvd')).toBeVisible();
    await expect(page.getByText('Details City, DC 78901')).toBeVisible();
  });

  test('can create locations within warehouse', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('LOC-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Location Test Warehouse');
    await page.getByLabel('Address Line 1 *').fill('321 Location Lane');
    await page.getByLabel('City *').fill('Location City');
    await page.getByLabel('State/Province *').fill('LC');
    await page.getByLabel('Postal Code *').fill('32100');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Open warehouse details
    await page.locator('button[aria-label="Open menu"]').first().click();
    await page.getByText('View Details').click();

    // Switch to locations tab
    await page.getByText('Locations').click();

    // Click add location
    await page.getByRole('button', { name: /add location/i }).click();

    // Check location dialog opens
    await expect(page.getByText('Add New Location')).toBeVisible();

    // Fill location form
    await page.getByLabel('Location Code *').fill('A1-01-001');
    await page.getByLabel('Description').fill('Test location');
    await page.getByLabel('Zone').fill('A');
    await page.getByLabel('Aisle').fill('01');
    await page.getByLabel('Shelf').fill('A');
    await page.getByLabel('Bin').fill('001');
    await page.getByLabel('Maximum Capacity').fill('100');

    // Submit location form
    await page.getByRole('button', { name: /create location/i }).click();

    // Wait for location dialog to close
    await expect(page.getByText('Add New Location')).not.toBeVisible();

    // Verify location appears in the list
    await expect(page.getByText('A1-01-001')).toBeVisible();
    await expect(page.getByText('Test location')).toBeVisible();
    await expect(page.getByText('01 - A - 001')).toBeVisible();
  });

  test('can edit warehouse information', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('EDIT-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Original Warehouse Name');
    await page.getByLabel('Address Line 1 *').fill('Original Address');
    await page.getByLabel('City *').fill('Original City');
    await page.getByLabel('State/Province *').fill('OC');
    await page.getByLabel('Postal Code *').fill('11111');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Click on the dropdown menu for the warehouse
    await page.locator('button[aria-label="Open menu"]').first().click();

    // Click edit
    await page.getByText('Edit').click();

    // Check edit dialog opens with pre-filled data
    await expect(page.getByText('Edit Warehouse')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Warehouse Name *' })).toHaveValue('Original Warehouse Name');

    // Update the name
    await page.getByLabel('Warehouse Name *').fill('Updated Warehouse Name');
    await page.getByLabel('City *').fill('Updated City');

    // Submit changes
    await page.getByRole('button', { name: /update warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Edit Warehouse')).not.toBeVisible();

    // Verify changes are reflected in the list
    await expect(page.getByText('Updated Warehouse Name')).toBeVisible();
    await expect(page.getByText('Updated City, OC')).toBeVisible();
  });

  test('can delete empty warehouse', async ({ page }) => {
    // Create a test warehouse first
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('DELETE-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Warehouse To Delete');
    await page.getByLabel('Address Line 1 *').fill('Delete Me Street');
    await page.getByLabel('City *').fill('Delete City');
    await page.getByLabel('State/Province *').fill('DL');
    await page.getByLabel('Postal Code *').fill('99999');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();

    // Click on the dropdown menu for the warehouse
    await page.locator('button[aria-label="Open menu"]').first().click();

    // Click delete
    await page.getByText('Delete').click();

    // Verify warehouse is removed from list
    await expect(page.getByText('Warehouse To Delete')).not.toBeVisible();
    await expect(page.getByText('DELETE-WH-001')).not.toBeVisible();
  });

  test('displays correct statistics', async ({ page }) => {
    // Initial state should show 0 for all stats
    await expect(page.getByText('Total Warehouses').locator('..').getByText('0')).toBeVisible();
    await expect(page.getByText('Total Locations').locator('..').getByText('0')).toBeVisible();

    // Create a warehouse
    await page.getByRole('button', { name: /add warehouse/i }).click();
    await page.getByLabel('Warehouse Code *').fill('STATS-WH-001');
    await page.getByLabel('Warehouse Name *').fill('Stats Warehouse');
    await page.getByLabel('Address Line 1 *').fill('Stats Street');
    await page.getByLabel('City *').fill('Stats City');
    await page.getByLabel('State/Province *').fill('ST');
    await page.getByLabel('Postal Code *').fill('55555');
    await page.getByRole('button', { name: /create warehouse/i }).click();

    // Wait for dialog to close and page to update
    await expect(page.getByText('Add New Warehouse')).not.toBeVisible();
    await page.waitForTimeout(1000); // Allow time for stats to update

    // Verify stats updated
    await expect(page.getByText('Total Warehouses').locator('..').getByText('1')).toBeVisible();
  });
});