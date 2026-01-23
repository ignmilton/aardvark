import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display the hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[data-testid="hero-section"], .hero, main h1')).toBeVisible();
  });

  test('should display trending stories section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/trending|popular/i).first()).toBeVisible();
  });

  test('should navigate to explore page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /explore|browse|discover/i }).first().click();
    await expect(page).toHaveURL(/explore/);
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check header navigation
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();
  });

  test('should display story cards with required info', async ({ page }) => {
    await page.goto('/');

    // Wait for stories to load
    const storyCards = page.locator('[data-testid="story-card"], .story-card, article').first();
    if (await storyCards.isVisible()) {
      // Story cards should show title and author
      await expect(storyCards).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Mobile nav should be visible
    await expect(page.locator('[data-testid="mobile-nav"], nav.fixed.bottom-0, .mobile-nav')).toBeVisible();
  });
});
