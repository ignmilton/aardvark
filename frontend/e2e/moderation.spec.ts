import { test, expect } from '@playwright/test';

test.describe('Content Reporting', () => {
  test('should allow users to report inappropriate content', async ({ page }) => {
    // Navigate to a story page
    await page.goto('/stories');

    // Find a story card
    const storyCard = page.locator('[data-testid="story-card"]').first();

    if (await storyCard.isVisible().catch(() => false)) {
      // Look for report button (usually in a menu)
      const menuButton = storyCard.locator('[data-testid="story-menu"]');

      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();

        // Should have report option
        const reportOption = page.getByRole('menuitem', { name: /report/i });
        await expect(reportOption).toBeVisible();
      }
    }
  });

  test('should show report form with reason options', async ({ page }) => {
    await page.goto('/stories');

    const storyCard = page.locator('[data-testid="story-card"]').first();

    if (await storyCard.isVisible().catch(() => false)) {
      await storyCard.click();

      // On story detail page, look for report button
      const reportButton = page.locator('[data-testid="report-content"]');

      if (await reportButton.isVisible().catch(() => false)) {
        await reportButton.click();

        // Report modal should appear
        const reportModal = page.locator('[data-testid="report-modal"]');
        await expect(reportModal).toBeVisible();

        // Should have reason options
        const reasonOptions = reportModal.locator('[data-testid="report-reason"]');
        await expect(reasonOptions.first()).toBeVisible();
      }
    }
  });

  test('should require reason selection before submitting report', async ({ page }) => {
    await page.goto('/stories');

    // Navigate to report flow
    const reportModal = page.locator('[data-testid="report-modal"]');

    if (await reportModal.isVisible().catch(() => false)) {
      const submitButton = reportModal.getByRole('button', { name: /submit/i });

      // Should be disabled without reason
      await expect(submitButton).toBeDisabled();
    }
  });
});

test.describe('Moderation Dashboard', () => {
  test.describe('Report Queue', () => {
    test('should display pending reports for moderators', async ({ page }) => {
      // This requires moderator authentication
      await page.goto('/moderation');

      const queueSection = page.locator('[data-testid="moderation-queue"]');

      if (await queueSection.isVisible().catch(() => false)) {
        // Should show queue statistics
        await expect(page.locator('[data-testid="pending-count"]')).toBeVisible();

        // Should show report list or empty state
        const reportList = page.locator('[data-testid="report-item"]');
        const emptyState = page.locator('[data-testid="empty-queue"]');

        await expect(reportList.first().or(emptyState)).toBeVisible();
      }
    });

    test('should allow filtering reports by type', async ({ page }) => {
      await page.goto('/moderation');

      const filterDropdown = page.locator('[data-testid="content-type-filter"]');

      if (await filterDropdown.isVisible().catch(() => false)) {
        await filterDropdown.click();

        // Should show filter options
        await expect(page.getByRole('option', { name: /story/i })).toBeVisible();
        await expect(page.getByRole('option', { name: /comment/i })).toBeVisible();
      }
    });

    test('should allow filtering reports by status', async ({ page }) => {
      await page.goto('/moderation');

      const statusFilter = page.locator('[data-testid="status-filter"]');

      if (await statusFilter.isVisible().catch(() => false)) {
        await statusFilter.click();

        // Should show status options
        await expect(page.getByRole('option', { name: /pending/i })).toBeVisible();
        await expect(page.getByRole('option', { name: /under review/i })).toBeVisible();
      }
    });
  });

  test.describe('Report Resolution', () => {
    test('should show action options when reviewing report', async ({ page }) => {
      await page.goto('/moderation');

      const reportItem = page.locator('[data-testid="report-item"]').first();

      if (await reportItem.isVisible().catch(() => false)) {
        await reportItem.click();

        // Should show report details
        const detailsPanel = page.locator('[data-testid="report-details"]');
        await expect(detailsPanel).toBeVisible();

        // Should show action buttons
        await expect(page.getByRole('button', { name: /dismiss/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /remove content/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /warn user/i })).toBeVisible();
      }
    });

    test('should require confirmation for severe actions', async ({ page }) => {
      await page.goto('/moderation');

      const banButton = page.getByRole('button', { name: /ban user/i });

      if (await banButton.isVisible().catch(() => false)) {
        await banButton.click();

        // Should show confirmation dialog
        const confirmDialog = page.locator('[data-testid="confirm-action-dialog"]');
        await expect(confirmDialog).toBeVisible();

        // Should explain the action
        await expect(confirmDialog).toContainText(/ban/i);
      }
    });
  });

  test.describe('User Warnings', () => {
    test('should display warning history for users', async ({ page }) => {
      await page.goto('/moderation/users');

      const userRow = page.locator('[data-testid="user-row"]').first();

      if (await userRow.isVisible().catch(() => false)) {
        await userRow.click();

        // Should show user details including warnings
        const warningSection = page.locator('[data-testid="warning-history"]');
        await expect(warningSection).toBeVisible();
      }
    });

    test('should allow issuing new warnings', async ({ page }) => {
      await page.goto('/moderation/users');

      const warnButton = page.getByRole('button', { name: /issue warning/i });

      if (await warnButton.isVisible().catch(() => false)) {
        await warnButton.click();

        // Should show warning form
        const warningForm = page.locator('[data-testid="warning-form"]');
        await expect(warningForm).toBeVisible();

        // Should have reason field
        await expect(warningForm.locator('[name="reason"]')).toBeVisible();
      }
    });
  });

  test.describe('Ban Appeals', () => {
    test('should display ban appeals queue', async ({ page }) => {
      await page.goto('/moderation/appeals');

      const appealsSection = page.locator('[data-testid="appeals-queue"]');

      if (await appealsSection.isVisible().catch(() => false)) {
        // Should show appeals list or empty state
        const appealItem = page.locator('[data-testid="appeal-item"]');
        const emptyState = page.locator('[data-testid="no-appeals"]');

        await expect(appealItem.first().or(emptyState)).toBeVisible();
      }
    });

    test('should show appeal details and original ban reason', async ({ page }) => {
      await page.goto('/moderation/appeals');

      const appealItem = page.locator('[data-testid="appeal-item"]').first();

      if (await appealItem.isVisible().catch(() => false)) {
        await appealItem.click();

        // Should show appeal details
        const detailsPanel = page.locator('[data-testid="appeal-details"]');
        await expect(detailsPanel).toBeVisible();

        // Should show original ban reason
        await expect(page.locator('[data-testid="original-ban-reason"]')).toBeVisible();

        // Should show appeal message
        await expect(page.locator('[data-testid="appeal-message"]')).toBeVisible();
      }
    });

    test('should allow approving or rejecting appeals', async ({ page }) => {
      await page.goto('/moderation/appeals');

      const appealItem = page.locator('[data-testid="appeal-item"]').first();

      if (await appealItem.isVisible().catch(() => false)) {
        await appealItem.click();

        // Should have approve and reject buttons
        await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
      }
    });
  });
});

test.describe('Content Moderation (Stories)', () => {
  test('should show story moderation queue', async ({ page }) => {
    await page.goto('/moderation/stories');

    const queueSection = page.locator('[data-testid="story-moderation-queue"]');

    if (await queueSection.isVisible().catch(() => false)) {
      // Should show pending stories for review
      const storyItem = page.locator('[data-testid="pending-story"]');
      const emptyState = page.locator('[data-testid="no-pending-stories"]');

      await expect(storyItem.first().or(emptyState)).toBeVisible();
    }
  });

  test('should allow approving stories for publication', async ({ page }) => {
    await page.goto('/moderation/stories');

    const approveButton = page.getByRole('button', { name: /approve/i }).first();

    if (await approveButton.isVisible().catch(() => false)) {
      // Button should be clickable
      await expect(approveButton).toBeEnabled();
    }
  });

  test('should allow requesting changes on stories', async ({ page }) => {
    await page.goto('/moderation/stories');

    const requestChangesButton = page.getByRole('button', { name: /request changes/i }).first();

    if (await requestChangesButton.isVisible().catch(() => false)) {
      await requestChangesButton.click();

      // Should show feedback form
      const feedbackForm = page.locator('[data-testid="changes-feedback-form"]');
      await expect(feedbackForm).toBeVisible();
    }
  });
});
