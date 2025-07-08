import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration for Ventry
 * 
 * This config runs tests from the dedicated @ventry/e2e package
 * with proper workspace dependency resolution and test isolation.
 */
export default defineConfig({
  testDir: './tests',
  /* Only run .spec.ts files in the tests directory */
  testMatch: ['**/*.spec.ts'],
  /* Ignore node_modules and build artifacts */
  testIgnore: ['**/node_modules/**', '**/dist/**'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests to prevent race conditions */
  workers: 1,
  /* Global setup and teardown */
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:6061',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Video only on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm --filter @ventry/backend dev',
      url: 'http://localhost:6060/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PORT: '6060',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ventry:ventry_dev_password@localhost:5487/ventry_dev',
        JWT_SECRET: 'test-secret-key',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:6061',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:6060/trpc',
      },
    },
  ],
});