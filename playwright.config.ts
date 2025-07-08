/**
 * Root Playwright Configuration
 * 
 * This configuration delegates E2E testing to the dedicated @ventry/e2e package.
 * The actual test configuration is in apps/e2e/playwright.config.ts
 * 
 * This allows E2E tests to run with proper workspace dependency resolution
 * while maintaining the existing root-level commands for convenience.
 */

// Re-export the E2E app configuration
export { default } from './apps/e2e/playwright.config.ts';