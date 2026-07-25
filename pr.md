# [FIX] Replace hardcoded `waitForTimeout(600)` with condition-based waits in E2E wizard test

**Close #1411** _(add issue number here)_

---

## Summary of the Issue

The E2E test `e2e/create-wizard.spec.ts` contained three hardcoded `await page.waitForTimeout(600)` calls (originally at lines 76, 85, and 135) that waited for the amount-field's debounced validation to resolve before asserting on validation results. Fixed sleeps are a classic source of flaky CI runs — if the debounce window changes, or CI runners are under load and 600ms isn't enough, the test flakes without any change to the feature under test. Conversely, if the debounce is later shortened, the test wastes time unnecessarily.

## Root Cause

The test relied on wall-clock time (`waitForTimeout(600)`) rather than waiting for a specific **state change** (element visibility, enabled state, attribute, or network response) to confirm the debounced validation had resolved. Playwright's `expect()` already has built-in auto-retrying with configurable timeouts, making `waitForTimeout` entirely unnecessary for condition-based assertions.

## Solution Implemented

**Replaced all three `waitForTimeout(600)` calls** with Playwright's built-in condition-based waiting mechanisms:

| Original (hardcoded)                                       | Replacement                                                                                    | Mechanism                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `page.waitForTimeout(600)` after filling invalid amount    | `await expect(page.locator("#amount-error")).toBeVisible()`                                    | Playwright polls until the error element is visible (up to default 5s timeout) |
| `page.waitForTimeout(600)` after filling valid amount      | `await expect(page.locator("#amount-error")).not.toBeVisible()`                                | Playwright polls until the error element is detached/hidden                    |
| `page.waitForTimeout(600)` before checking Continue button | `await expect(page.locator('button:has-text("Continue")')).toBeEnabled()` or `.toBeDisabled()` | Playwright polls until the button reaches the expected enabled/disabled state  |

Additionally:

- The test now verifies `aria-invalid` attribute state on the input element as an extra signal of validation completion
- `waitForResponse` is **not** needed since the validation is synchronous/computed — the DOM is reactive and Playwright's `expect` retries suffice
- The coverage was expanded to cover **three scenarios** (zero/invalid, valid, exceeds-balance) across three separate test cases

## Key Changes Made

### Files Changed

| File                        | Change                                                                                                                                                                             | Status       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `e2e/create-wizard.spec.ts` | Rewrote entire test file — replaced all `waitForTimeout` with condition-based waits; added 3 test cases covering full wizard flow, immediate validation, and button disabled state | **New**      |
| `e2e/playwright.config.ts`  | Added Playwright configuration with Chromium project, HTML reporter, and dev server setup                                                                                          | **New**      |
| `package.json`              | Added `"test:e2e": "playwright test"` script and `@playwright/test` devDependency                                                                                                  | **Modified** |
| `tsconfig.json`             | Added `"e2e"` to `exclude` array so Playwright test files don't conflict with Next.js TypeScript config                                                                            | **Modified** |
| `package-lock.json`         | Updated with resolved dependency tree including `@playwright/test`                                                                                                                 | **Modified** |
| `.gitignore`                | Added `playwright-report/` directory to prevent generated reports from being tracked                                                                                               | **Modified** |

### Structural Improvements

- **Zero hardcoded timeouts** — every wait is a condition-based assertion using Playwright's auto-retrying `expect()` API
- **Three focused test cases** instead of a single monolithic test:
  1. Full wizard flow (end-to-end)
  2. Immediate validation error for zero/negative amounts
  3. Continue button disabled/enabled state transitions
- **Accessibility-aware** — uses ARIA attributes (`aria-invalid`, `aria-checked`) for state verification
- **Deterministic** — each step waits for the next step's heading to render before proceeding

## Any Trade-offs or Considerations

1. **Assumes synchronous validation**: The amount validation is computed synchronously (via `useMemo`/derived state), so `waitForResponse` is not needed. If validation moves to an async API call in the future, these assertions should be converted to `page.waitForResponse()` or `waitForRequest()` patterns.

2. **Test coverage vs. speed**: The new tests run faster in the happy path (no artificial waits) but may take slightly longer on failure (Playwright waits up to the full timeout before failing). This is the **correct trade-off** — better to catch flakiness deterministically with a clear error message than to have tests pass silently with flaky timing.

3. **Playwright config**: The dev server is configured to reuse an existing server locally (faster) but spin up a fresh one in CI (isolated). This matches best practices.

4. **`package-lock.json`**: The lockfile has been regenerated to include `@playwright/test` and its transitive dependencies. This ensures reproducible CI installs.

## Testing Steps

### 1. Install Playwright browsers

```bash
npx playwright install chromium
```

### 2. Start the dev server (if not already running)

```bash
npm run dev
```

### 3. Run the E2E tests

```bash
npm run test:e2e
```

### 4. Verify no `waitForTimeout` calls remain

```bash
grep -n "waitForTimeout" e2e/create-wizard.spec.ts
# Expected: no output (no matches)
```

### 5. (Optional) Run with Playwright UI mode for visual debugging

```bash
npx playwright test --ui
```

### Expected Results

- All 3 tests pass without any hardcoded sleep
- Tests complete faster than the original 600ms-per-wait version
- Tests are resilient to debounce timing changes
- Running under load (e.g., `--workers 1` with throttled CPU) does not cause false failures

---

Please kindly review this task. If there are any corrections, improvements, adjustments, or merge conflicts that you notice regarding my implementation, I'd really appreciate your feedback. I'd also love to hear your overall review of my work on this branch. Thank you!
