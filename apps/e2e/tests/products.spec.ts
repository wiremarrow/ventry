import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { createTestItem, deleteTestItems } from './helpers/test-data';

test.describe('Products Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await deleteTestItems();
  });

  test('should display products page correctly', async ({ page }) => {
    // Check page title and main elements
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Product' })).toBeVisible();

    // Check filters section
    await expect(page.getByPlaceholder('Search by SKU, name, or barcode...')).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'All Categories' })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: 'All Status' })).toBeVisible();

    // Check table headers
    const headerRow = page.locator('table').locator('rowgroup').first().locator('row').first();
    await expect(headerRow.getByRole('cell', { name: 'Product' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'SKU' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'Category' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'Unit of Measure' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'Price' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'Reorder Point' })).toBeVisible();
    await expect(headerRow.getByRole('cell', { name: 'Status' })).toBeVisible();
  });

  test('should show empty state when no products exist', async ({ page }) => {
    // Clear search results by searching for non-existent product
    await page
      .getByPlaceholder('Search by SKU, name, or barcode...')
      .fill('NONEXISTENT-PRODUCT-12345');
    await page.waitForTimeout(500); // Wait for debounce

    // Now we should see empty state
    await expect(page.getByText('No products found')).toBeVisible();
    await expect(page.getByText('Try adjusting your filters')).toBeVisible();
  });

  test('should create a new product', async ({ page }) => {
    // Click Add Product button
    await page.getByRole('button', { name: 'Add Product' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add New Product' })).toBeVisible();

    // Fill in basic information
    await page.getByLabel('SKU *').fill('E2E-PROD-001');
    await page.getByLabel('Product Name *').fill('E2E Test Product');
    await page.getByLabel('Description').fill('This is an E2E test product');

    // Select category (assuming at least one exists)
    await page.getByRole('combobox', { name: /category/i }).click();
    await page.getByRole('option').first().click();

    // Select unit of measure
    await page.getByRole('combobox', { name: /unit/i }).click();
    await page.getByRole('option').first().click();

    // Fill pricing information
    await page.getByLabel('Default Cost').fill('50.00');
    await page.getByLabel('Default Price').fill('100.00');

    // Fill inventory management
    await page.getByLabel('Reorder Point').fill('10');
    await page.getByLabel('Reorder Quantity').fill('20');

    // Submit form
    await page.getByRole('button', { name: 'Create Product' }).click();

    // Verify success
    await expect(page.getByText('Product created successfully')).toBeVisible();

    // Verify product appears in list
    await expect(page.getByText('E2E Test Product', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E-PROD-001')).toBeVisible();
    await expect(page.getByText('$100.00')).toBeVisible();
  });

  test('should edit an existing product', async ({ page }) => {
    // Create a test product first
    await createTestItem({
      sku: 'E2E-EDIT-001',
      name: 'Product to Edit',
    });

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new product
    await page.waitForTimeout(1000);

    // Search for the specific product to ensure it's visible
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('E2E-EDIT-001');
    await page.waitForTimeout(500); // Wait for debounce

    // Wait for the product to appear with a more specific locator
    await expect(page.locator('tr').filter({ hasText: 'E2E-EDIT-001' })).toBeVisible();

    // Find the product and open actions menu
    const productRow = page.locator('tr', { hasText: 'E2E-EDIT-001' });
    await productRow.getByRole('button', { name: 'Open menu' }).click();

    // Click Edit
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Wait for edit dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();

    // Verify current values are populated
    await expect(page.getByLabel('SKU *')).toHaveValue('E2E-EDIT-001');
    await expect(page.getByLabel('Product Name *')).toHaveValue('Product to Edit');

    // Update values
    await page.getByLabel('Product Name *').clear();
    await page.getByLabel('Product Name *').fill('Updated Product Name');
    await page.getByLabel('Default Price').fill('150.00');

    // Submit
    await page.getByRole('button', { name: 'Update Product' }).click();

    // Verify success
    await expect(page.getByText('Product updated successfully')).toBeVisible();

    // Verify updated values in list
    await expect(page.getByText('Updated Product Name')).toBeVisible();
    await expect(page.getByText('$150.00')).toBeVisible();
  });

  test('should duplicate a product', async ({ page }) => {
    // Create a test product first
    await createTestItem({
      sku: 'E2E-DUP-001',
      name: 'Product to Duplicate',
    });

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new product
    await page.waitForTimeout(1000);

    // Search for the specific product to ensure it's visible
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('E2E-DUP-001');
    await page.waitForTimeout(500); // Wait for debounce

    // Wait for the product to appear with a more specific locator
    await expect(page.locator('tr').filter({ hasText: 'E2E-DUP-001' })).toBeVisible();

    // Find the product and open actions menu
    const productRow = page.locator('tr', { hasText: 'E2E-DUP-001' });
    await productRow.getByRole('button', { name: 'Open menu' }).click();

    // Click Duplicate
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();

    // Wait for success message
    await expect(page.getByText('Product duplicated successfully')).toBeVisible();

    // Clear search to see both products
    await page.getByPlaceholder('Search by SKU, name, or barcode...').clear();
    await page.waitForTimeout(500);

    // Search for the product name to see both duplicates
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('Product to Duplicate');
    await page.waitForTimeout(500);

    // Verify duplicate appears in list
    await expect(page.locator('tr', { hasText: 'Product to Duplicate' })).toHaveCount(2);
  });

  test('should archive a product', async ({ page }) => {
    // Create a test product first
    await createTestItem({
      sku: 'E2E-ARCH-001',
      name: 'Product to Archive',
    });

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new product
    await page.waitForTimeout(1000);

    // Search for the specific product to ensure it's visible
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('E2E-ARCH-001');
    await page.waitForTimeout(500); // Wait for debounce

    // Wait for the product to appear with a more specific locator
    await expect(page.locator('tr').filter({ hasText: 'E2E-ARCH-001' })).toBeVisible();

    // Find the product and open actions menu
    const productRow = page.locator('tr', { hasText: 'E2E-ARCH-001' });
    await productRow.getByRole('button', { name: 'Open menu' }).click();

    // Click Archive
    await page.getByRole('menuitem', { name: 'Archive' }).click();

    // Wait for success message
    await expect(page.getByText('Product archived successfully')).toBeVisible();

    // Product should still be visible but marked as inactive
    await expect(page.getByText('INACTIVE')).toBeVisible();
  });

  test('should filter products by search term', async ({ page }) => {
    // Create test products
    await createTestItem({
      sku: 'SEARCH-001',
      name: 'Apple Product',
    });
    await createTestItem({
      sku: 'SEARCH-002',
      name: 'Banana Product',
    });

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new products
    await page.waitForTimeout(1000);

    // First, search for SEARCH- to ensure our test products are visible
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('SEARCH-');
    await page.waitForTimeout(500); // Debounce delay

    // Verify both products exist
    await expect(page.getByText('Apple Product')).toBeVisible();
    await expect(page.getByText('Banana Product')).toBeVisible();

    // Now test the search functionality - clear and search for "apple"
    await page.getByPlaceholder('Search by SKU, name, or barcode...').clear();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('apple');
    await page.waitForTimeout(500); // Debounce delay

    // Should only show Apple Product
    await expect(page.getByText('Apple Product')).toBeVisible();
    await expect(page.getByText('Banana Product')).not.toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search by SKU, name, or barcode...').clear();
    await page.waitForTimeout(500);

    // Search for SEARCH- again to see both
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('SEARCH-');
    await page.waitForTimeout(500);

    // Both should be visible
    await expect(page.getByText('Apple Product')).toBeVisible();
    await expect(page.getByText('Banana Product')).toBeVisible();
  });

  test('should filter products by status', async ({ page }) => {
    // Create test products
    await createTestItem({
      sku: 'STATUS-001',
      name: 'Active Product',
      isActive: true,
    });
    await createTestItem({
      sku: 'STATUS-002',
      name: 'Inactive Product',
      isActive: false,
    });

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new products
    await page.waitForTimeout(1000);

    // Search for STATUS products to ensure they're visible
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('STATUS');
    await page.waitForTimeout(500); // Wait for debounce

    // Filter by Active status
    await page.getByRole('combobox').filter({ hasText: 'All Status' }).click();
    await page.getByRole('option', { name: 'Active', exact: true }).click();

    // Should only show active product
    await expect(page.getByText('Active Product')).toBeVisible();
    await expect(page.getByText('Inactive Product')).not.toBeVisible();

    // Filter by Inactive status
    await page.getByRole('combobox').filter({ hasText: 'Active' }).click();
    await page.getByRole('option', { name: 'Inactive', exact: true }).click();

    // Should only show inactive product
    await expect(page.getByText('Active Product')).not.toBeVisible();
    await expect(page.getByText('Inactive Product')).toBeVisible();
  });

  test('should handle pagination', async ({ page }) => {
    // Create 25 test products to trigger pagination
    const promises = [];
    for (let i = 1; i <= 25; i++) {
      promises.push(
        createTestItem({
          sku: `PAGE-${i.toString().padStart(3, '0')}`,
          name: `Product ${i}`,
        })
      );
    }
    await Promise.all(promises);

    // Navigate to products page and wait for it to load
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Give the database time to propagate the new products
    await page.waitForTimeout(1000);

    // Search for PAGE products to test pagination with just our test products
    await page.getByPlaceholder('Search by SKU, name, or barcode...').fill('PAGE-');
    await page.waitForTimeout(500); // Wait for debounce

    // Should show pagination controls for our 25 test products
    await expect(page.getByText(/Showing 1 to 20 of 25 products/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

    // Go to next page
    await page.getByRole('button', { name: 'Next' }).click();

    // Should show remaining products
    await expect(page.getByText(/Showing 21 to 25 of 25 products/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  test('should validate required fields in create form', async ({ page }) => {
    // Click Add Product button
    await page.getByRole('button', { name: 'Add Product' }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create Product' }).click();

    // Should show validation errors
    await expect(page.getByText('SKU is required')).toBeVisible();
    await expect(page.getByText('Name is required')).toBeVisible();
    // Category and Unit show just "Required" as validation message
    await expect(page.getByText('Required').first()).toBeVisible(); // Category
    await expect(page.getByText('Required').nth(1)).toBeVisible(); // Unit of measure
  });

  test('should handle SKU uniqueness validation', async ({ page }) => {
    // Create a product with specific SKU
    await createTestItem({
      sku: 'UNIQUE-001',
      name: 'Existing Product',
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Try to create another product with same SKU
    await page.getByRole('button', { name: 'Add Product' }).click();

    await page.getByLabel('SKU *').fill('UNIQUE-001');
    await page.getByLabel('Product Name *').fill('Duplicate SKU Product');

    // Select category and unit
    await page.getByRole('combobox', { name: /category/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /unit/i }).click();
    await page.getByRole('option').first().click();

    // Submit
    await page.getByRole('button', { name: 'Create Product' }).click();

    // Should show error
    await expect(page.getByText('An item with this SKU already exists')).toBeVisible();
  });
});
