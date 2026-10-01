import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the settlement flow.
 *
 * Mirrors the `page.route(...)` mocking style used by `create-wizard.spec.ts`:
 * the underlying API routes are intercepted so the journey is fully hermetic.
 * The settlement preview (`SettlementEligibilityChecklist`) is rendered on the
 * commitment detail page and is the entry point operators use before settling.
 */
const COMMITMENT_ID = '1';
const ELIGIBILITY_URL = `**/api/commitments/*/settlement/eligibility`;

test.describe('Settlement flow E2E', () => {
  test('happy path: eligible commitment shows the settlement preview and triggers settle', async ({
    page,
  }) => {
    await page.route(ELIGIBILITY_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eligible: true,
          reason: 'Commitment has matured',
          estimatedSettlement: '48,500 XLM',
        }),
      });
    });

    await page.goto(`/commitments/${COMMITMENT_ID}`);

    const preview = page.getByRole('region', { name: 'Settlement eligibility' });
    await expect(preview).toBeVisible();
    await expect(preview.getByText('Eligible for settlement')).toBeVisible();
    await expect(preview.getByText('Commitment has matured')).toBeVisible();
    await expect(preview.getByText('Estimated settlement: 48,500 XLM')).toBeVisible();

    const settleButton = preview.getByRole('button', { name: 'Settle commitment' });
    await expect(settleButton).toBeEnabled();
    await settleButton.click();
  });

  test('edge case: not-yet-eligible commitment disables the settle action', async ({ page }) => {
    await page.route(ELIGIBILITY_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eligible: false,
          reason: 'Commitment has not matured yet',
        }),
      });
    });

    await page.goto(`/commitments/${COMMITMENT_ID}`);

    const preview = page.getByRole('region', { name: 'Settlement eligibility' });
    await expect(preview).toBeVisible();
    await expect(preview.getByText('Not yet eligible')).toBeVisible();
    await expect(preview.getByText('Commitment has not matured yet')).toBeVisible();
    await expect(preview.getByRole('button', { name: 'Settle commitment' })).toBeDisabled();
  });
});
