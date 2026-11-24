import { expect, test } from '@playwright/test';

test.describe('Docs anchors', () => {
  test('table of contents anchors scroll to their target sections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/docs');

    const toc = page.getByRole('complementary', { name: 'Table of contents' });
    await expect(toc).toBeVisible();

    for (const [id, label] of [
      ['types', 'Commitment types'],
      ['contracts', 'Contracts'],
      ['faq', 'FAQ'],
    ] as const) {
      await toc.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));

      const heading = page.locator(`h2#${id}`);
      await expect(heading).toBeInViewport();
    }
  });
});
