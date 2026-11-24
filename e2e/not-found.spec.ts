import { expect, test } from '@playwright/test';

test.describe('404 not-found page', () => {
  test('unknown route renders the not-found page with a home link', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-404');
    expect(response?.status()).toBe(404);

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText('The page you are looking for does not exist.')).toBeVisible();

    await page.getByRole('link', { name: 'Back home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
