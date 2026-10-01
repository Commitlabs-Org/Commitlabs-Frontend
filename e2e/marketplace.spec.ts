import { test, expect } from '@playwright/test';

test.describe('marketplace', () => {
  test('page loads and shows marketplace heading', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByTestId('marketplace-heading')).toBeVisible();
  });

  test('marketplace listings are rendered', async ({ page }) => {
    await page.goto('/marketplace');
    const listings = page.getByTestId('marketplace-listing');
    await expect(listings.first()).toBeVisible();
    await expect(await listings.count()).toBeGreaterThan(0);
  });

  test('search input is visible and accepts text', async ({ page }) => {
    await page.goto('/marketplace');
    const searchInput = page.getByTestId('marketplace-search');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('sneaker');
    await expect(searchInput).toHaveValue('sneakers');
  });

  test('filter sidebar is visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/marketplace');
    await expect(page.getByTestId('marketplace-filter-sidebar')).toBeVisible();
  });

  test('category filters are rendered', async ({ page }) => {
    await page.goto('/marketplace');
    const categories = page.getByTestId('marketplace-category-filter');
    await expect(categories.first()).toBeVisible();
    await expect(await categories.count()).toBeGreaterThan(0);
  });

  test('trade links are present on for-sale listings', async ({ page }) => {
    await page.goto('/marketplace');
    const tradeLinks = page.getByTestId('marketplace-trade-link');
    await expect(tradeLinks.first()).toBeVisible();
    await expect(await tradeLinks.count()).toBeGreaterThan(0);
  });

  test('clicking a listing opens its detail page', async ({ page }) => {
    await page.goto('/marketplace');
    const firstListing = page.getByTestId('marketplace-listing').first();
    await expect(firstListing).toBeVisible();
    await firstListing.click();
    await expect(page.getByTestId('marketplace-listing-detail')).toBeVisible();
  });
});
