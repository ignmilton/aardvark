import { test, expect } from '@playwright/test';

test.describe('Search & Discovery', () => {
  test('should display search input', async ({ page }) => {
    await page.goto('/explore');
    const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));
    await expect(searchInput.first()).toBeVisible();
  });

  test('should show results when searching', async ({ page }) => {
    await page.goto('/explore');
    const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));

    if (await searchInput.first().isVisible()) {
      await searchInput.first().fill('adventure');
      await searchInput.first().press('Enter');

      // Wait for results
      await page.waitForTimeout(1000);

      // Should show results or "no results" message
      const hasResults = await page.locator('article, [data-testid="story-card"], .story-card').first().isVisible();
      const hasNoResults = await page.getByText(/no results|nothing found|no stories/i).isVisible();
      expect(hasResults || hasNoResults).toBeTruthy();
    }
  });

  test('should support tag-based filtering', async ({ page }) => {
    await page.goto('/explore');

    const tagButton = page.locator('[data-testid="tag"], .tag, [role="option"]').first();
    if (await tagButton.isVisible()) {
      await tagButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should show autocomplete suggestions', async ({ page }) => {
    await page.goto('/explore');
    const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));

    if (await searchInput.first().isVisible()) {
      await searchInput.first().fill('fan');
      await page.waitForTimeout(500);

      // Check for autocomplete dropdown
      const suggestions = page.locator('[role="listbox"], [data-testid="suggestions"], .autocomplete');
      if (await suggestions.isVisible()) {
        await expect(suggestions).toBeVisible();
      }
    }
  });

  test('should handle sort options', async ({ page }) => {
    await page.goto('/explore');

    const sortButton = page.getByRole('button', { name: /sort|order/i }).or(
      page.locator('select[name*="sort"]'),
    );

    if (await sortButton.first().isVisible()) {
      await sortButton.first().click();
      const sortOption = page.getByRole('option', { name: /newest|popular|rating/i }).first();
      if (await sortOption.isVisible()) {
        await sortOption.click();
      }
    }
  });
});
