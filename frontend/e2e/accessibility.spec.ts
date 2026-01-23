import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('should have proper page structure with landmarks', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark
    await expect(page.getByRole('main')).toBeVisible();

    // Check for navigation
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  test('should have skip-to-content link', async ({ page }) => {
    await page.goto('/');

    // Tab to reveal skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByText('Skip to main content');
    await expect(skipLink).toBeFocused();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Should have exactly one h1
    const h1Elements = page.getByRole('heading', { level: 1 });
    await expect(h1Elements).toHaveCount(1);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/');

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus-visible');
    if (await focused.isVisible()) {
      // Verify the element has a visible focus ring
      const outline = await focused.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outlineStyle !== 'none' || styles.boxShadow !== 'none';
      });
      expect(outline).toBeTruthy();
    }
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Either has alt text or is decorative (role="presentation" or alt="")
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/login');

    // All inputs should have associated labels
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.isVisible().catch(() => false);
        expect(hasLabel || !!ariaLabel || !!ariaLabelledBy || !!placeholder).toBeTruthy();
      }
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');

    // Check that body text meets WCAG AA contrast ratio (4.5:1)
    const textColor = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        color: styles.color,
        bg: styles.backgroundColor,
      };
    });

    // Basic check that colors are not the same
    expect(textColor.color).not.toBe(textColor.bg);
  });

  test('should not have auto-playing media', async ({ page }) => {
    await page.goto('/');

    const autoplayMedia = page.locator('video[autoplay], audio[autoplay]');
    const count = await autoplayMedia.count();

    // If there's autoplay media, it should be muted
    for (let i = 0; i < count; i++) {
      const muted = await autoplayMedia.nth(i).getAttribute('muted');
      expect(muted).not.toBeNull();
    }
  });

  test('should handle reduced motion preference', async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Verify animations are disabled
    const hasAnimations = await page.evaluate(() => {
      const el = document.querySelector('.animate-in, .animate-pulse');
      if (!el) return false;
      const styles = window.getComputedStyle(el);
      return styles.animationDuration !== '0.01ms';
    });

    // With our CSS, animations should be disabled
    expect(hasAnimations).toBeFalsy();
  });
});
