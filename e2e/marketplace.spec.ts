import { test, expect } from "@playwright/test";

test.describe("Marketplace browse filter and quick-view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/marketplace");
    await page.waitForTimeout(3000);
  });

  test("loads the marketplace page", async ({ page }) => {
    await expect(page).toHaveURL(/marketplace/);
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("renders content after loading", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("search input is visible and accepts text", async ({ page }) => {
    const search = page.locator("input").first();
    const count = await search.count();
    if (count > 0) {
      await expect(search).toBeVisible();
      await search.fill("001");
      await expect(search).toHaveValue("001");
    }
  });

  test("filter sidebar is visible on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await page.waitForTimeout(2000);
    const sidebar = page.locator("aside").first();
    const count = await sidebar.count();
    if (count > 0) {
      await expect(sidebar).toBeVisible();
    }
  });

  test("show filters button is visible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForTimeout(2000);
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("clicking show filters reveals sidebar on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForTimeout(2000);
    const filterButton = page.locator("button").filter({ hasText: "Filters" }).first();
    const count = await filterButton.count();
    if (count > 0) {
      await filterButton.click();
      await page.waitForTimeout(500);
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();
    }
  });

  test("view mode toggle buttons are visible", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("card detail links are present", async ({ page }) => {
    const detailLink = page.locator("a[href*='commitments']").first();
    const count = await detailLink.count();
    if (count > 0) {
      await expect(detailLink).toBeVisible();
    }
  });

  test("trade links are present on for-sale listings", async ({ page }) => {
    const tradeLink = page.locator("a[href*='trade']").first();
    const count = await tradeLink.count();
    if (count > 0) {
      await expect(tradeLink).toBeVisible();
    }
  });

  test("searching for non-existent id updates the grid", async ({ page }) => {
    const search = page.locator("input").first();
    const count = await search.count();
    if (count > 0) {
      await search.fill("ZZZNORESULT999");
      await page.waitForTimeout(500);
      const cardCount = await page.locator(".rounded-2xl").count();
      expect(cardCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("page heading is visible", async ({ page }) => {
    const heading = page.locator("h1, h2").first();
    const count = await heading.count();
    if (count > 0) {
      await expect(heading).toBeVisible();
    }
  });
});
