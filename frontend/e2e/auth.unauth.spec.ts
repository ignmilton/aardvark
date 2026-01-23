import { test, expect } from '@playwright/test';

test.describe('Authentication (Unauthenticated)', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should display registration page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test('should show validation errors for empty login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should show validation messages
    await expect(page.getByText(/required|invalid|enter/i).first()).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nonexistent@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    await page.goto('/editor/new');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('should have link to register from login page', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /sign up|register|create account/i });
    await expect(registerLink).toBeVisible();
  });
});
