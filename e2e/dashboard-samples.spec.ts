import { expect, test } from '@playwright/test';

test.describe('Dashboard sample data', () => {
  test('Load sample commitments adds two flagged demo rows', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('No commitments yet.')).toBeVisible();

    await page.getByRole('button', { name: 'Load sample commitments' }).click();

    const cards = page.locator('article.commit');
    await expect(cards).toHaveCount(2);

    const demoBadges = page.locator('article.commit .badge.demo');
    await expect(demoBadges).toHaveCount(2);
    await expect(demoBadges.nth(0)).toHaveText('demo');
    await expect(demoBadges.nth(1)).toHaveText('demo');
  });
});
