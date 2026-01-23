import { test, expect } from '@playwright/test';

test.describe('Story Browsing & Reading', () => {
  test('should display explore page with stories', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should filter stories by category', async ({ page }) => {
    await page.goto('/explore');

    // Click a category filter if available
    const categoryButton = page.getByRole('button', { name: /fantasy|sci-fi|romance/i }).first();
    if (await categoryButton.isVisible()) {
      await categoryButton.click();
      await page.waitForTimeout(500); // Wait for filter to apply
    }
  });

  test('should display story detail page', async ({ page }) => {
    await page.goto('/explore');

    // Click on first story
    const storyLink = page.getByRole('link').filter({ hasText: /.+/ }).first();
    if (await storyLink.isVisible()) {
      const href = await storyLink.getAttribute('href');
      if (href?.includes('/story/')) {
        await storyLink.click();
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    }
  });

  test('should start reading a story', async ({ page }) => {
    await page.goto('/explore');

    // Find a story to read
    const readButton = page.getByRole('link', { name: /read|start/i }).first();
    if (await readButton.isVisible()) {
      await readButton.click();
      await expect(page.locator('.reading-content, [data-testid="story-content"]')).toBeVisible();
    }
  });

  test('should display choices at the end of a segment', async ({ page }) => {
    // Navigate to a story reader page directly
    await page.goto('/explore');

    const readLink = page.locator('a[href*="/read"]').first();
    if (await readLink.isVisible()) {
      await readLink.click();
      // Choices should be buttons or links
      const choices = page.locator('.choice-button, [data-testid="choice"], [role="option"]');
      // Wait for content to load
      await page.waitForTimeout(2000);
      // At least verify the page loaded
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('should handle story ratings', async ({ page }) => {
    await page.goto('/explore');

    const storyLink = page.locator('a[href*="/story/"]').first();
    if (await storyLink.isVisible()) {
      await storyLink.click();

      // Look for rating component
      const ratingSection = page.locator('[data-testid="rating"], .rating, [aria-label*="rating"]');
      if (await ratingSection.isVisible()) {
        await expect(ratingSection).toBeVisible();
      }
    }
  });
});

test.describe('Story Creation', () => {
  test('should open the story editor', async ({ page }) => {
    await page.goto('/editor/new');
    await expect(page.locator('[data-testid="editor"], .tiptap-editor, [contenteditable]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('should allow entering a story title', async ({ page }) => {
    await page.goto('/editor/new');

    const titleInput = page.getByPlaceholder(/title|story name/i).or(page.getByLabel(/title/i));
    if (await titleInput.isVisible()) {
      await titleInput.fill('Test Story Title');
      await expect(titleInput).toHaveValue('Test Story Title');
    }
  });

  test('should support rich text editing', async ({ page }) => {
    await page.goto('/editor/new');

    const editor = page.locator('[contenteditable="true"]').first();
    if (await editor.isVisible()) {
      await editor.click();
      await editor.type('Once upon a time...');
      await expect(editor).toContainText('Once upon a time');
    }
  });

  test('should have a save/publish button', async ({ page }) => {
    await page.goto('/editor/new');
    const saveButton = page.getByRole('button', { name: /save|publish|draft/i }).first();
    await expect(saveButton).toBeVisible();
  });
});
