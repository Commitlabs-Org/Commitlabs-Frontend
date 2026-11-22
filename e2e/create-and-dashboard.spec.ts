import { expect, test } from '@playwright/test';

test.describe('Create wizard and dashboard persistence', () => {
  test('creates a commitment in demo mode and persists it on dashboard after reload', async ({
    page,
  }) => {
    await page.goto('/create');

    // Step 1: Choose commitment type
    await expect(page.getByRole('heading', { name: 'Create a commitment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Choose a commitment type' })).toBeVisible();
    await page.getByRole('radio', { name: /Balanced/i }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Configure parameters
    await expect(page.getByRole('heading', { name: 'Configure' })).toBeVisible();
    await page.getByLabel('Asset').selectOption('USDC');
    await page.getByLabel('Amount').fill('2500');
    await page.getByLabel('Lock duration (days)').fill('60');
    await page.getByRole('button', { name: 'Review' }).click();

    // Step 3: Review and confirm
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await expect(page.getByText('2,500 USDC')).toBeVisible();
    await expect(page.getByText('60 days')).toBeVisible();
    await expect(page.getByText(/Demo mode:/)).toBeVisible();

    const submitButton = page.getByRole('button', { name: 'Create commitment' });
    await expect(submitButton).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 4: Success
    await expect(page.getByRole('heading', { name: 'Commitment created' })).toBeVisible();
    await expect(page.getByText(/2,500 USDC for 60 days/)).toBeVisible();

    // Navigate to dashboard and verify commitment is listed
    await page.getByRole('link', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const cards = page.locator('article.commit');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('2,500 USDC');

    // Reload and verify localStorage persistence
    await page.reload();
    await expect(page.locator('article.commit')).toHaveCount(1);
    await expect(page.locator('article.commit').first()).toContainText('2,500 USDC');
  });
});
