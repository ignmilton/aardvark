import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/user.json';

/**
 * Authentication setup - runs before all tests that require login.
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test@aardvark.com');
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || 'TestPassword123!');

  // Submit login form
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for navigation to complete
  await page.waitForURL('/');

  // Verify login succeeded
  await expect(page.getByRole('button', { name: /profile|account/i })).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: AUTH_FILE });
});
