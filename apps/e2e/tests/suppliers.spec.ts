import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Suppliers Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to suppliers with retry for Mobile Safari navigation interruptions
    await test.step('Navigate to suppliers', async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('/suppliers', { waitUntil: 'networkidle' });
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

  test('should display suppliers page correctly', async ({ page }) => {
    // Check page title and main elements
    await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
    await expect(page.getByText('Manage your suppliers and track performance')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Supplier' })).toBeVisible();

    // Check stats cards
    await expect(page.getByText('Total Suppliers')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Avg Lead Time')).toBeVisible();
    await expect(page.getByText('This Month')).toBeVisible();

    // Check search bar
    await expect(page.getByPlaceholder('Search suppliers by name, contact...')).toBeVisible();

    // Check table headers
    await expect(page.locator('th').filter({ hasText: 'Supplier' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Contact' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Lead Time' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Payment Terms' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Status' })).toBeVisible();
  });

  test('should show empty state when no suppliers exist', async ({ page }) => {
    // Search for non-existent supplier
    await page.getByPlaceholder('Search suppliers by name, contact...').fill('NONEXISTENT-SUPPLIER-12345');
    await page.waitForTimeout(500); // Wait for debounce

    // Should show empty state
    await expect(page.getByText('No suppliers found')).toBeVisible();
  });

  test('should create a new supplier', async ({ page }) => {
    // Click Add Supplier button
    await page.getByRole('button', { name: 'Add Supplier' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add New Supplier' })).toBeVisible();

    // Generate unique supplier code
    const supplierCode = `SUP-${Date.now()}`;

    // Fill in basic information
    await page.getByLabel('Company Name *').fill('E2E Test Supplier');
    await page.getByLabel('Company Code *').fill(supplierCode);
    await page.getByLabel('Tax ID').fill('12-3456789');

    // Fill contact information
    await page.getByLabel('Contact Name').fill('John Doe');
    await page.getByLabel('Contact Email').fill('john@e2esupplier.com');
    await page.getByLabel('Contact Phone').fill('+1 234 567 8900');

    // Fill address
    await page.getByLabel('Street Address').fill('123 Test Street');
    await page.getByLabel('City').fill('Test City');
    await page.getByLabel('State/Province').fill('TS');
    await page.getByLabel('Postal Code').fill('12345');
    await page.getByLabel('Country').fill('Test Country');

    // Fill business terms
    await page.getByLabel('Lead Time (days)').fill('7');
    await page.getByLabel('Payment Terms').fill('Net 30');
    await page.getByLabel('Credit Limit').fill('50000');

    // Submit form with scroll and force click
    const submitButton = page.getByRole('button', { name: 'Create Supplier' });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ force: true });

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify success
    await expect(page.getByText('Supplier created successfully')).toBeVisible();

    // Verify supplier appears in list
    await expect(page.getByText('E2E Test Supplier')).toBeVisible();
    await expect(page.getByText(supplierCode)).toBeVisible();
    await expect(page.getByText('john@e2esupplier.com')).toBeVisible();
  });

  test('should edit an existing supplier', async ({ page }) => {
    // First create a supplier to edit
    const supplierCode = `EDIT-${Date.now()}`;
    
    // Create supplier via UI
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('Supplier to Edit');
    await page.getByLabel('Company Code *').fill(supplierCode);
    await page.getByLabel('Contact Email').fill('edit@supplier.com');
    await page.getByRole('button', { name: 'Create Supplier' }).click();
    await expect(page.getByText('Supplier created successfully')).toBeVisible();
    await page.waitForTimeout(1000);

    // Search for the supplier
    await page.getByPlaceholder('Search suppliers by name, contact...').fill(supplierCode);
    await page.waitForTimeout(500);

    // Find and click edit button
    const supplierRow = page.locator('tr').filter({ hasText: supplierCode });
    await supplierRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Wait for edit dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Supplier' })).toBeVisible();

    // Update values
    await page.getByLabel('Company Name *').clear();
    await page.getByLabel('Company Name *').fill('Updated Supplier Name');
    await page.getByLabel('Lead Time (days)').fill('14');
    await page.getByLabel('Credit Limit').fill('100000');

    // Submit
    await page.getByRole('button', { name: 'Update Supplier' }).click();

    // Verify success
    await expect(page.getByText('Supplier updated successfully')).toBeVisible();

    // Verify updated values in list
    await expect(page.getByText('Updated Supplier Name')).toBeVisible();
    await expect(page.getByText('14 days')).toBeVisible();
  });

  test('should filter suppliers by search term', async ({ page }) => {
    // Create test suppliers with unique codes
    const timestamp = Date.now();
    const supplier1Code = `APPLE-${timestamp}`;
    const supplier2Code = `BANANA-${timestamp}`;

    // Create first supplier
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('Apple Supplier Inc');
    await page.getByLabel('Company Code *').fill(supplier1Code);
    await page.getByLabel('Contact Email').fill('contact@apple.com');
    await page.getByRole('button', { name: 'Create Supplier' }).click();
    await expect(page.getByText('Supplier created successfully')).toBeVisible();

    // Create second supplier
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('Banana Trading Co');
    await page.getByLabel('Company Code *').fill(supplier2Code);
    await page.getByLabel('Contact Email').fill('contact@banana.com');
    await page.getByRole('button', { name: 'Create Supplier' }).click();
    await expect(page.getByText('Supplier created successfully')).toBeVisible();

    // Search for first supplier
    await page.getByPlaceholder('Search suppliers by name, contact...').fill('Apple');
    await page.waitForTimeout(500);

    // Should only show Apple Supplier
    await expect(page.getByText('Apple Supplier Inc')).toBeVisible();
    await expect(page.getByText('Banana Trading Co')).not.toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search suppliers by name, contact...').clear();
    await page.waitForTimeout(500);

    // Search by code pattern
    await page.getByPlaceholder('Search suppliers by name, contact...').fill(`${timestamp}`);
    await page.waitForTimeout(500);

    // Both should be visible
    await expect(page.getByText('Apple Supplier Inc')).toBeVisible();
    await expect(page.getByText('Banana Trading Co')).toBeVisible();
  });

  test('should toggle supplier status', async ({ page }) => {
    // Create a supplier
    const supplierCode = `STATUS-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('Status Test Supplier');
    await page.getByLabel('Company Code *').fill(supplierCode);
    await page.getByRole('button', { name: 'Create Supplier' }).click();
    await expect(page.getByText('Supplier created successfully')).toBeVisible();

    // Search for the supplier
    await page.getByPlaceholder('Search suppliers by name, contact...').fill(supplierCode);
    await page.waitForTimeout(500);

    // Check initial status is Active
    const supplierRow = page.locator('tr').filter({ hasText: supplierCode });
    await expect(supplierRow.getByText('Active')).toBeVisible();

    // Toggle status
    await supplierRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Deactivate' }).click();

    // Confirm deactivation
    await page.getByRole('button', { name: 'Deactivate' }).click();

    // Verify status changed
    await expect(page.getByText('Supplier deactivated successfully')).toBeVisible();
    await expect(supplierRow.getByText('Inactive')).toBeVisible();
  });

  test('should validate required fields in create form', async ({ page }) => {
    // Click Add Supplier button
    await page.getByRole('button', { name: 'Add Supplier' }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should show validation errors
    await expect(page.getByText('Company name is required')).toBeVisible();
    await expect(page.getByText('Company code is required')).toBeVisible();
  });

  test('should handle code uniqueness validation', async ({ page }) => {
    // Create a supplier with specific code
    const uniqueCode = `UNIQUE-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('First Supplier');
    await page.getByLabel('Company Code *').fill(uniqueCode);
    await page.getByRole('button', { name: 'Create Supplier' }).click();
    await expect(page.getByText('Supplier created successfully')).toBeVisible();

    // Try to create another supplier with same code
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.getByLabel('Company Name *').fill('Second Supplier');
    await page.getByLabel('Company Code *').fill(uniqueCode);
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should show error
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible();
  });

  test('should display supplier statistics correctly', async ({ page }) => {
    // Check stats cards have numeric values
    const totalSuppliers = page.getByText('Total Suppliers').locator('..').locator('p.text-2xl');
    const activeSuppliers = page.getByText('Active').locator('..').locator('p.text-2xl');
    const avgLeadTime = page.getByText('Avg Lead Time').locator('..').locator('p.text-2xl');
    const thisMonth = page.getByText('This Month').locator('..').locator('p.text-2xl');

    // All stats should have numeric values
    await expect(totalSuppliers).toHaveText(/\d+/);
    await expect(activeSuppliers).toHaveText(/\d+/);
    await expect(avgLeadTime).toHaveText(/\d+(\.\d+)? days/);
    await expect(thisMonth).toHaveText(/\$[\d,]+/);
  });

  test('should validate email format', async ({ page }) => {
    // Click Add Supplier button
    await page.getByRole('button', { name: 'Add Supplier' }).click();

    // Fill required fields
    await page.getByLabel('Company Name *').fill('Email Test Supplier');
    await page.getByLabel('Company Code *').fill(`EMAIL-${Date.now()}`);

    // Enter invalid email
    await page.getByLabel('Contact Email').fill('invalid-email');
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should show validation error
    await expect(page.getByText('Invalid email address')).toBeVisible();

    // Fix email
    await page.getByLabel('Contact Email').clear();
    await page.getByLabel('Contact Email').fill('valid@email.com');
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should succeed
    await expect(page.getByText('Supplier created successfully')).toBeVisible();
  });

  test('should handle numeric field validation', async ({ page }) => {
    // Click Add Supplier button
    await page.getByRole('button', { name: 'Add Supplier' }).click();

    // Fill required fields
    await page.getByLabel('Company Name *').fill('Numeric Test Supplier');
    await page.getByLabel('Company Code *').fill(`NUM-${Date.now()}`);

    // Try negative lead time
    await page.getByLabel('Lead Time (days)').fill('-5');
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should show validation error
    await expect(page.getByText(/must be positive|greater than 0/i)).toBeVisible();

    // Try negative credit limit
    await page.getByLabel('Lead Time (days)').clear();
    await page.getByLabel('Lead Time (days)').fill('7');
    await page.getByLabel('Credit Limit').fill('-1000');
    await page.getByRole('button', { name: 'Create Supplier' }).click();

    // Should show validation error
    await expect(page.getByText(/must be positive|greater than or equal to 0/i)).toBeVisible();
  });

  test('should handle pagination', async ({ page }) => {
    // Check if pagination exists
    const paginationSection = page.locator('div').filter({ hasText: /Page \d+ of \d+/ });
    
    if (await paginationSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check pagination info
      const pageInfo = await paginationSection.textContent();
      expect(pageInfo).toMatch(/Page \d+ of \d+/);

      // Check if Next button exists and is enabled
      const nextButton = page.getByRole('button', { name: 'Next' });
      const prevButton = page.getByRole('button', { name: 'Previous' });

      // Previous should be disabled on first page
      await expect(prevButton).toBeDisabled();

      // If there are multiple pages, test navigation
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Should be on page 2
        await expect(paginationSection).toContainText('Page 2');
        
        // Previous should now be enabled
        await expect(prevButton).toBeEnabled();

        // Go back to first page
        await prevButton.click();
        await page.waitForTimeout(500);
        await expect(paginationSection).toContainText('Page 1');
      }
    }
  });
});