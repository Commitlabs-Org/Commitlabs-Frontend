import { test, expect } from '@playwright/test';

test.describe('Create Commitment Wizard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept validate and fund API calls to keep them fully mock/hermetic
    await page.route('**/api/commitments/validate', async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      const amount = Number(body.amount);
      if (amount > 10000) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: false,
            errors: [{ field: 'amount', message: 'Amount exceeds available balance' }],
            warnings: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            errors: [],
            warnings: [],
          }),
        });
      }
    });

    await page.route('**/api/commitments/*/fund', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            commitmentId: 'CMT-MOCK123',
            txHash: '0xmocktxhash1234567890abcdef1234567890',
            reference: 'MOCK_REFERENCE',
            fundedAt: new Date().toISOString(),
          },
        }),
      });
    });

    // Go to the create page
    await page.goto('/create');
  });

  test('happy path: complete wizard successfully and navigate to detail page', async ({ page }) => {
    // 1. Step 1: Choose Your Commitment Type
    await expect(page.getByRole('heading', { name: 'Choose Your Commitment Type' })).toBeVisible();
    
    // Select "Balanced Commitment" card
    const balancedCard = page.getByRole('radio', { name: /Balanced Commitment/ });
    await expect(balancedCard).toBeVisible();
    await balancedCard.click();
    
    // Continue button should be enabled
    const step1Continue = page.getByTestId('select-type-continue');
    await expect(step1Continue).toBeEnabled();
    await step1Continue.click();

    // 2. Step 2: Configure Parameters
    await expect(page.getByRole('heading', { name: 'Configure Parameters' })).toBeVisible();

    // Enter out-of-bounds amount to check validation error
    const amountInput = page.locator('#amount');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('15000');
    
    // Wait for debounce and validation error
    await page.waitForTimeout(600);
    await expect(page.getByText('Amount exceeds available balance')).toBeVisible();
    
    // Continue button should be disabled
    const step2Continue = page.getByTestId('configure-continue');
    await expect(step2Continue).toBeDisabled();

    // Re-enter a valid amount
    await amountInput.fill('1000');
    await page.waitForTimeout(600);
    await expect(page.getByText('Amount exceeds available balance')).not.toBeVisible();
    await expect(step2Continue).toBeEnabled();
    
    // Proceed to Step 3
    await step2Continue.click();

    // 3. Step 3: Review
    await expect(page.getByRole('heading', { name: 'Review Parameters' })).toBeVisible();
    
    // Assert review details
    await expect(page.getByText('Balanced Commitment', { exact: true })).toBeVisible();
    await expect(page.getByText('1000 XLM')).toBeVisible();
    
    // Submit the wizard
    const submitBtn = page.getByRole('button', { name: 'Submit Commitment' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Modal validation: CommitmentCreatedModal appears
    // The submit handler has a 2-second timeout, so wait for it
    const successModal = page.locator('role=dialog');
    await expect(successModal).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Commitment Created' })).toBeVisible();
    
    // Click "Fund Now" inside the modal
    const fundNowBtn = page.getByRole('button', { name: 'Fund Now' });
    await expect(fundNowBtn).toBeVisible();
    await fundNowBtn.click();
    
    // Verify Escrow Funded success state inside modal
    await expect(page.getByText('Escrow Funded')).toBeVisible();
    
    // Click "View Commitment" to navigate
    const viewCommitmentBtn = page.getByRole('button', { name: 'View Commitment' });
    await expect(viewCommitmentBtn).toBeVisible();
    await viewCommitmentBtn.click();
    
    // Assert navigation happened
    await expect(page).toHaveURL(/\/commitments\/.+/);
  });

  test('back-navigation preserves state', async ({ page }) => {
    // Select type and continue
    await page.getByRole('radio', { name: /Safe Commitment/ }).click();
    await page.getByTestId('select-type-continue').click();

    // Fill amount and continue
    const amountInput = page.locator('#amount');
    await amountInput.fill('500');
    await page.waitForTimeout(600);
    await page.getByTestId('configure-continue').click();

    // On Step 3 (Review), click Back
    await page.getByRole('button', { name: 'Back' }).click();

    // Assert we are back on Step 2 with the same amount
    await expect(page.getByRole('heading', { name: 'Configure Parameters' })).toBeVisible();
    await expect(page.locator('#amount')).toHaveValue('500');

    // Click Back again
    await page.locator('button:text("Back")').click();

    // Assert we are back on Step 1 with Safe Commitment selected
    await expect(page.getByRole('heading', { name: 'Choose Your Commitment Type' })).toBeVisible();
    const safeRadio = page.getByRole('radio', { name: /Safe Commitment/ });
    await expect(safeRadio).toHaveAttribute('aria-checked', 'true');
  });
});
