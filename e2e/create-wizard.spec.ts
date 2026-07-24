import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Commitment Creation Wizard.
 *
 * Critical rule: NO hardcoded `waitForTimeout` calls.
 * All waits are condition-based using Playwright's built-in auto-retrying
 * assertions (`expect().toBeVisible()`, `.toBeEnabled()`, `.toHaveAttribute()`,
 * etc.) or `waitForResponse` for network-dependent conditions.
 */

test.describe("Create Wizard — Amount Validation (Condition-Based Waits)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/create");
    // Wait for the wizard to render (step 1 — Select Type)
    await expect(
      page.locator('h1:has-text("Create Commitment")'),
    ).toBeVisible();
  });

  test("full wizard flow completes successfully with condition-based waits", async ({
    page,
  }) => {
    // ──────────────────────────────────────────────
    // Step 1: Select Commitment Type
    // ──────────────────────────────────────────────
    // Select the "Safe Commitment" card (role="radio")
    await page.click('div[role="radio"]:has-text("Safe Commitment")');
    await expect(
      page.locator(
        'div[role="radio"][aria-checked="true"]:has-text("Safe Commitment")',
      ),
    ).toBeVisible();

    // Click Continue — condition: wait for step 2 to render
    await page.click('button:has-text("Continue")');
    // Wait for step 2 heading to appear (proof step transition happened)
    await expect(
      page.locator('h2:has-text("Configure Parameters")'),
    ).toBeVisible();

    // ──────────────────────────────────────────────
    // Step 2: Configure Parameters — Amount Validation
    // ──────────────────────────────────────────────

    // --- Scenario A: Enter an invalid amount (0) and verify error appears ---
    const amountInput = page.locator("#amount");
    await amountInput.fill("0");
    // Condition: wait for the validation error to appear reactively
    // (Playwright's expect retries until the element exists or timeout)
    await expect(page.locator("#amount-error")).toBeVisible();
    // Also verify aria-invalid is set
    await expect(amountInput).toHaveAttribute("aria-invalid", "true");
    // Continue button should be disabled when amount is invalid
    await expect(page.locator('button:has-text("Continue")')).toBeDisabled();

    // --- Scenario B: Enter a valid amount and verify error disappears ---
    await amountInput.fill("500");
    // Condition: wait for the error to disappear (Playwright retries until element is gone)
    await expect(page.locator("#amount-error")).not.toBeVisible();
    // aria-invalid should be cleared (set to false or removed)
    await expect(amountInput).not.toHaveAttribute("aria-invalid", "true");

    // --- Scenario C: Enter amount exceeding balance and verify error reappears ---
    // availableBalance is 10000, so entering 99999 should exceed it
    await amountInput.fill("99999");
    // Condition: wait for the exceeds-balance validation error
    await expect(page.locator("#amount-error")).toBeVisible();
    await expect(page.locator("#amount-error")).toHaveText(
      /exceeds available balance/i,
    );
    await expect(amountInput).toHaveAttribute("aria-invalid", "true");

    // --- Scenario D: Fix the amount so form becomes valid ---
    await amountInput.fill("2500");
    // Condition: wait for the error to clear
    await expect(page.locator("#amount-error")).not.toBeVisible();
    // Condition: wait for Continue button to become enabled
    await expect(page.locator('button:has-text("Continue")')).toBeEnabled();

    // ──────────────────────────────────────────────
    // Step 2 → Step 3: Navigate to Review
    // ──────────────────────────────────────────────
    await page.click('button:has-text("Continue")');
    // Condition: wait for the Review step heading
    await expect(page.locator('h2:has-text("Review & Confirm")')).toBeVisible();

    // ──────────────────────────────────────────────
    // Step 3: Review & Submit
    // ──────────────────────────────────────────────
    // Accept terms and acknowledge risks by clicking the checkbox rows
    const termsCheckbox = page.locator(
      'label:has-text("I agree to the terms")',
    );
    const risksCheckbox = page.locator(
      'label:has-text("I acknowledge the risks")',
    );

    await termsCheckbox.click();
    // Condition: wait for the terms checkbox visual confirmation to appear
    await expect(page.locator('[id="terms"]').first()).toBeVisible();

    await risksCheckbox.click();
    await expect(page.locator('[id="risks"]').first()).toBeVisible();

    // Submit — button should now be enabled
    const submitButton = page.locator('button:has-text("Create Commitment")');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Condition: wait for the success modal to appear (not a timeout)
    await expect(page.locator('[role="dialog"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("#modal-title")).toHaveText(
      /Commitment Created/i,
    );
  });

  test("shows validation error for zero amount immediately (no fixed sleep)", async ({
    page,
  }) => {
    // Navigate through step 1 first
    await page.click('div[role="radio"]:has-text("Balanced Commitment")');
    await page.click('button:has-text("Continue")');
    await expect(
      page.locator('h2:has-text("Configure Parameters")'),
    ).toBeVisible();

    // Type a negative number / zero — validation is reactive via useMemo
    const amountInput = page.locator("#amount");
    await amountInput.fill("-5");
    // Wait for the validation error — no waitForTimeout, expect retries automatically
    await expect(page.locator("#amount-error")).toBeVisible();
    await expect(page.locator("#amount-error")).toHaveText(
      /Amount must be greater than 0/i,
    );

    // Clear and type valid
    await amountInput.fill("100");
    await expect(page.locator("#amount-error")).not.toBeVisible();
    await expect(page.locator('button:has-text("Continue")')).toBeEnabled();
  });

  test("Continue button remains disabled when amount is invalid", async ({
    page,
  }) => {
    // Step 1 → Step 2
    await page.click('div[role="radio"]:has-text("Aggressive Commitment")');
    await page.click('button:has-text("Continue")');
    await expect(
      page.locator('h2:has-text("Configure Parameters")'),
    ).toBeVisible();

    // Enter invalid amount
    await page.locator("#amount").fill("0");
    // Condition: Continue button must be disabled
    await expect(page.locator('button:has-text("Continue")')).toBeDisabled();

    // Enter valid amount
    await page.locator("#amount").fill("1500");
    // Condition: Continue button must become enabled (no timeout)
    await expect(page.locator('button:has-text("Continue")')).toBeEnabled();

    // Re-enter invalid amount (exceeds availableBalance=10000)
    await page.locator("#amount").fill("99999");
    // Condition: Continue button must become disabled again
    await expect(page.locator('button:has-text("Continue")')).toBeDisabled();
  });
});
