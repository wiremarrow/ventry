import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Categories Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    
    // Navigate to categories with retry for Mobile Safari navigation interruptions
    await test.step('Navigate to categories', async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('/categories');
          await page.waitForLoadState('domcontentloaded');
          // Verify we're on the categories page
          await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible({ timeout: 5000 });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          // Wait a bit before retrying
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test('should display categories page with proper layout', async ({ page }) => {
    // Check page title contains Ventry
    await expect(page).toHaveTitle(/Ventry/);
    
    // Check main heading
    await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
    
    // Check page description
    await expect(page.getByText('Organize your inventory with hierarchical categories')).toBeVisible();
    
    // Check action buttons
    await expect(page.getByRole('button', { name: /Add Category/i })).toBeVisible();
    
    // Check statistics cards
    await expect(page.getByText('Total Categories')).toBeVisible();
    await expect(page.getByText('Root Categories')).toBeVisible();
    await expect(page.getByText('Total Items')).toBeVisible();
    await expect(page.getByText('Most Used')).toBeVisible();
    
    // Check category hierarchy section
    await expect(page.getByRole('heading', { name: 'Category Hierarchy' })).toBeVisible();
  });

  test('should display seeded categories', async ({ page }) => {
    // Check that seeded categories are displayed in the hierarchy tree
    // Look specifically in the tree area, not the stats cards
    const categoryTree = page.locator('[role="heading"]:has-text("Category Hierarchy")').locator('..');
    
    await expect(categoryTree.getByText('Electronics')).toBeVisible();
    await expect(categoryTree.getByText('Office Supplies')).toBeVisible();
    await expect(categoryTree.getByText('Furniture')).toBeVisible();
    
    // Verify item counts are displayed as badges
    await expect(page.getByText(/\d+ items/)).toBeVisible();
  });

  test('should create a new category', async ({ page }) => {
    const uniqueName = `Test Category ${Date.now()}`;
    
    // Click add category button
    await page.getByRole('button', { name: /Add Category/i }).click();
    
    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Category' })).toBeVisible();
    
    // Fill in category form
    await page.getByLabel('Name *').fill(uniqueName);
    await page.getByLabel('Description').fill('This is a test category');
    
    // Select parent category
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Electronics' }).click();
    
    // Submit form
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Check success message
    await expect(page.getByText('Category created successfully')).toBeVisible();
    
    // Verify new category appears in hierarchy tree
    const categoryTree = page.locator('[role="heading"]:has-text("Category Hierarchy")').locator('..');
    await expect(categoryTree.getByText(uniqueName)).toBeVisible();
  });

  test('should edit an existing category', async ({ page }) => {
    // Create a category to edit
    const uniqueName = `Category to Edit ${Date.now()}`;
    await page.getByRole('button', { name: /Add Category/i }).click();
    await page.getByLabel('Name *').fill(uniqueName);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Category created successfully')).toBeVisible();
    
    // Wait for category to appear in tree
    await page.waitForTimeout(500);
    
    // Find and click edit button - hover over the category row to show actions
    const categoryRow = page.locator('div.group').filter({ hasText: uniqueName });
    await categoryRow.hover();
    await categoryRow.getByRole('button').click(); // Opens actions menu
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    
    // Wait for edit dialog
    await expect(page.getByRole('heading', { name: 'Edit Category' })).toBeVisible();
    
    // Update category details
    await page.getByLabel('Name *').clear();
    await page.getByLabel('Name *').fill(`${uniqueName} Updated`);
    await page.getByLabel('Description').clear();
    await page.getByLabel('Description').fill('Updated description');
    
    // Submit form
    await page.getByRole('button', { name: 'Update' }).click();
    
    // Check success message
    await expect(page.getByText('Category updated successfully')).toBeVisible();
    
    // Verify updated category in list
    await expect(page.getByText(`${uniqueName} Updated`)).toBeVisible();
  });

  test('should delete a category without children', async ({ page }) => {
    // Create a category to delete
    const uniqueName = `Category to Delete ${Date.now()}`;
    await page.getByRole('button', { name: /Add Category/i }).click();
    await page.getByLabel('Name *').fill(uniqueName);
    await page.getByLabel('Description').fill('This category will be deleted');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Category created successfully')).toBeVisible();
    
    // Wait for category to appear in tree
    await page.waitForTimeout(500);
    
    // Handle browser confirm dialog before triggering it
    page.on('dialog', dialog => dialog.accept());
    
    // Find and click delete button - hover over the category row to show actions
    const categoryRow = page.locator('div.group').filter({ hasText: uniqueName });
    await categoryRow.hover();
    await categoryRow.getByRole('button').click(); // Opens actions menu
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    
    // Check success message
    await expect(page.getByText('Category deleted successfully')).toBeVisible();
    
    // Verify category is removed
    await expect(page.getByText(uniqueName)).not.toBeVisible();
  });

  test('should display category hierarchy correctly', async ({ page }) => {
    // Check that the category tree structure is displayed
    const categoryTree = page.locator('[role="heading"]:has-text("Category Hierarchy")').locator('..');
    
    // Should have at least one category in the tree
    await expect(categoryTree.locator('.font-medium').first()).toBeVisible();
    
    // Categories should have item count badges
    await expect(categoryTree.getByText(/\d+ items/).first()).toBeVisible();
  });

  test('should search categories', async ({ page }) => {
    // Type in search box
    await page.getByPlaceholder('Search categories...').fill('Electronics');
    
    // Wait for search to apply
    await page.waitForTimeout(500); // Debounce delay
    
    // Check that matching category is visible in the tree
    const categoryTree = page.locator('[role="heading"]:has-text("Category Hierarchy")').locator('..');
    await expect(categoryTree.getByText('Electronics')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Click add category button
    await page.getByRole('button', { name: /Add Category/i }).click();
    
    // Try to submit without filling required fields
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Should show validation error
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page, context }) => {
    // Intercept API calls and force an error
    await context.route('**/api/trpc/categories.create*', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          error: {
            message: 'Failed to create category',
            code: 'INTERNAL_SERVER_ERROR'
          }
        }),
      });
    });
    
    // Try to create a category
    await page.getByRole('button', { name: /Add Category/i }).click();
    await page.getByLabel('Name *').fill('Error Test Category');
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Should show error toast
    await expect(page.getByText(/Failed to create category/i)).toBeVisible();
  });
});