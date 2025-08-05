import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Customers Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to customers with retry for Mobile Safari navigation interruptions
    await test.step('Navigate to customers', async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('/customers', { waitUntil: 'networkidle' });
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

  test('should display customers page correctly', async ({ page }) => {
    // Check page title and main elements
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();
    await expect(page.getByText('Manage your customer relationships and contact information')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Customer' })).toBeVisible();

    // Check stats cards
    await expect(page.getByText('Total Customers')).toBeVisible();
    await expect(page.getByText('Active Customers')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Avg Order Value')).toBeVisible();

    // Check search bar
    await expect(page.getByPlaceholder('Search by name, email, or company...')).toBeVisible();

    // Check table headers
    await expect(page.locator('th').filter({ hasText: 'Customer' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Contact' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Location' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Orders' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Total Spent' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Actions' })).toBeVisible();
  });

  test('should show empty state when no customers exist', async ({ page }) => {
    // Search for non-existent customer
    await page.getByPlaceholder('Search by name, email, or company...').fill('NONEXISTENT-CUSTOMER-12345');
    await page.waitForTimeout(500); // Wait for debounce

    // Should show empty state
    await expect(page.getByText('No customers found')).toBeVisible();
  });

  test('should create a new customer', async ({ page }) => {
    // Click Add Customer button
    await page.getByRole('button', { name: 'Add Customer' }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Customer' })).toBeVisible();

    // Generate unique customer code
    const customerCode = `CUST-${Date.now()}`;

    // Fill in customer type
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();

    // Fill in basic information
    await page.getByLabel('First Name *').fill('John');
    await page.getByLabel('Last Name *').fill('Doe');
    await page.getByLabel('Customer Code *').fill(customerCode);
    await page.getByLabel('Email').fill('john.doe@example.com');
    await page.getByLabel('Phone').fill('+1 234 567 8900');

    // Submit form
    const submitButton = page.getByRole('button', { name: 'Create Customer' });
    await submitButton.click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify success
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Verify customer appears in list
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText(customerCode)).toBeVisible();
    await expect(page.getByText('john.doe@example.com')).toBeVisible();
  });

  test('should create a business customer', async ({ page }) => {
    // Click Add Customer button
    await page.getByRole('button', { name: 'Add Customer' }).click();

    // Generate unique customer code
    const customerCode = `BUSI-${Date.now()}`;

    // Select Business type
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Business' }).click();

    // Fill in business information
    await page.getByLabel('Company Name *').fill('Acme Corporation');
    await page.getByLabel('Customer Code *').fill(customerCode);
    await page.getByLabel('Tax ID').fill('12-3456789');
    await page.getByLabel('Email').fill('contact@acme.com');
    await page.getByLabel('Phone').fill('+1 234 567 8900');

    // Submit form
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Verify success
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Verify customer appears in list
    await expect(page.getByText('Acme Corporation')).toBeVisible();
    await expect(page.getByText(customerCode)).toBeVisible();
  });

  test('should edit an existing customer', async ({ page }) => {
    // First create a customer to edit
    const customerCode = `EDIT-${Date.now()}`;
    
    // Create customer via UI
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Edit');
    await page.getByLabel('Last Name *').fill('Test');
    await page.getByLabel('Customer Code *').fill(customerCode);
    await page.getByLabel('Email').fill('edit@test.com');
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page.getByText('Customer created successfully')).toBeVisible();
    await page.waitForTimeout(1000);

    // Search for the customer
    await page.getByPlaceholder('Search by name, email, or company...').fill(customerCode);
    await page.waitForTimeout(500);

    // Find and click edit button
    const customerRow = page.locator('tr').filter({ hasText: customerCode });
    await customerRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Wait for edit dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible();

    // Update values
    await page.getByLabel('First Name *').clear();
    await page.getByLabel('First Name *').fill('Updated');
    await page.getByLabel('Phone').fill('+1 999 888 7777');

    // Submit
    await page.getByRole('button', { name: 'Update Customer' }).click();

    // Verify success
    await expect(page.getByText('Customer updated successfully')).toBeVisible();

    // Verify updated values in list
    await expect(page.getByText('Updated Test')).toBeVisible();
    await expect(page.getByText('+1 999 888 7777')).toBeVisible();
  });

  test('should filter customers by search term', async ({ page }) => {
    // Create test customers with unique codes
    const timestamp = Date.now();
    const customer1Code = `APPLE-${timestamp}`;
    const customer2Code = `BANANA-${timestamp}`;

    // Create first customer
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Apple');
    await page.getByLabel('Last Name *').fill('Customer');
    await page.getByLabel('Customer Code *').fill(customer1Code);
    await page.getByLabel('Email').fill('apple@customer.com');
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Create second customer
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Banana');
    await page.getByLabel('Last Name *').fill('Customer');
    await page.getByLabel('Customer Code *').fill(customer2Code);
    await page.getByLabel('Email').fill('banana@customer.com');
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Search for first customer
    await page.getByPlaceholder('Search by name, email, or company...').fill('Apple');
    await page.waitForTimeout(500);

    // Should only show Apple Customer
    await expect(page.getByText('Apple Customer')).toBeVisible();
    await expect(page.getByText('Banana Customer')).not.toBeVisible();

    // Clear search
    await page.getByPlaceholder('Search by name, email, or company...').clear();
    await page.waitForTimeout(500);

    // Search by email
    await page.getByPlaceholder('Search by name, email, or company...').fill('banana@customer.com');
    await page.waitForTimeout(500);

    // Should only show Banana Customer
    await expect(page.getByText('Apple Customer')).not.toBeVisible();
    await expect(page.getByText('Banana Customer')).toBeVisible();
  });

  test('should validate required fields in create form', async ({ page }) => {
    // Click Add Customer button
    await page.getByRole('button', { name: 'Add Customer' }).click();

    // Select individual type
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Should show validation errors
    await expect(page.getByText('First name is required')).toBeVisible();
    await expect(page.getByText('Last name is required')).toBeVisible();
    await expect(page.getByText('Customer code is required')).toBeVisible();
  });

  test('should validate business required fields', async ({ page }) => {
    // Click Add Customer button
    await page.getByRole('button', { name: 'Add Customer' }).click();

    // Select business type
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Business' }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Should show validation errors
    await expect(page.getByText('Company name is required')).toBeVisible();
    await expect(page.getByText('Customer code is required')).toBeVisible();
  });

  test('should handle code uniqueness validation', async ({ page }) => {
    // Create a customer with specific code
    const uniqueCode = `UNIQUE-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('First');
    await page.getByLabel('Last Name *').fill('Customer');
    await page.getByLabel('Customer Code *').fill(uniqueCode);
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Try to create another customer with same code
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Second');
    await page.getByLabel('Last Name *').fill('Customer');
    await page.getByLabel('Customer Code *').fill(uniqueCode);
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Should show error
    await expect(page.getByText(/already exists|duplicate/i)).toBeVisible();
  });

  test('should delete a customer', async ({ page }) => {
    // Create a customer to delete
    const customerCode = `DEL-${Date.now()}`;
    
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Delete');
    await page.getByLabel('Last Name *').fill('Me');
    await page.getByLabel('Customer Code *').fill(customerCode);
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page.getByText('Customer created successfully')).toBeVisible();

    // Search for the customer
    await page.getByPlaceholder('Search by name, email, or company...').fill(customerCode);
    await page.waitForTimeout(500);

    // Find and click delete
    const customerRow = page.locator('tr').filter({ hasText: customerCode });
    await customerRow.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Verify success
    await expect(page.getByText('Customer deleted successfully')).toBeVisible();

    // Verify customer is removed
    await expect(page.getByText(customerCode)).not.toBeVisible();
  });

  test('should display customer statistics correctly', async ({ page }) => {
    // Check stats cards have numeric values
    const totalCustomers = page.getByText('Total Customers').locator('..').locator('p.text-2xl');
    const activeCustomers = page.getByText('Active Customers').locator('..').locator('p.text-2xl');
    const totalRevenue = page.getByText('Total Revenue').locator('..').locator('p.text-2xl');
    const avgOrderValue = page.getByText('Avg Order Value').locator('..').locator('p.text-2xl');

    // All stats should have numeric values
    await expect(totalCustomers).toHaveText(/\d+/);
    await expect(activeCustomers).toHaveText(/\d+/);
    await expect(totalRevenue).toHaveText(/\$[\d,]+(\.\d{2})?/);
    await expect(avgOrderValue).toHaveText(/\$[\d,]+(\.\d{2})?/);
  });

  test('should validate email format', async ({ page }) => {
    // Click Add Customer button
    await page.getByRole('button', { name: 'Add Customer' }).click();

    // Fill required fields
    await page.getByLabel('Customer Type').click();
    await page.getByRole('option', { name: 'Individual' }).click();
    await page.getByLabel('First Name *').fill('Email');
    await page.getByLabel('Last Name *').fill('Test');
    await page.getByLabel('Customer Code *').fill(`EMAIL-${Date.now()}`);

    // Enter invalid email
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Should show validation error
    await expect(page.getByText('Invalid email address')).toBeVisible();

    // Fix email
    await page.getByLabel('Email').clear();
    await page.getByLabel('Email').fill('valid@email.com');
    await page.getByRole('button', { name: 'Create Customer' }).click();

    // Should succeed
    await expect(page.getByText('Customer created successfully')).toBeVisible();
  });

  test('should navigate to customer details', async ({ page }) => {
    // Check if there are any customers
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0 && !(await page.getByText('No customers found').isVisible({ timeout: 1000 }).catch(() => false))) {
      // Click view details on first customer
      await rows.first().getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('menuitem', { name: 'View Details' }).click();

      // Should navigate to customer details page
      await expect(page.url()).toMatch(/\/customers\/[a-zA-Z0-9]+$/);
    }
  });
});