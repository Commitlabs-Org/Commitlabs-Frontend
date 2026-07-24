# Automated Accessibility (A11y) Testing Guide

Accessibility is a core priority of the Commitlabs project. To prevent regressions in critical user interface elements (such as modals, dialogs, marketplace cards, and badge statuses), we use axe-based automated accessibility checks powered by `vitest-axe` and Vitest.

---

## Architecture & Integration

Automated accessibility tests are executed in the Vitest runner.

1. **Test Matchers**: The project registers the axe matcher in [vitest.setup.ts](file:///Users/winnergbolagade/Desktop/drips/Commitlabs-Frontend/tests/setup/vitest.setup.ts):
   ```typescript
   import * as axeMatchers from 'vitest-axe/matchers';
   import 'vitest-axe/extend-expect';
   import { expect } from 'vitest';

   expect.extend(axeMatchers);
   ```
2. **TypeScript Support**: Importing `vitest-axe/extend-expect` augments the global namespace typings so that `.toHaveNoViolations()` is recognized on the expect matcher.
3. **Environment**: We use both `jsdom` (default) and `happy-dom` (configured per-test file) environments. Accessibility matchers function correctly in both environments.

---

## Writing Accessibility Tests

Accessibility tests assert that a rendered component or layout complies with WCAG standards and produces zero violations.

### 1. Basic Component Test Case

To check a standard inline component, render it, query the wrapper `container`, and assert against the axe analyzer:

```typescript
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { TrustBadge } from "@/components/TrustBadge";

describe("TrustBadge Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<TrustBadge level="verified" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### 2. Testing React Portals & Overlay Components (e.g., Dialogs, Modals)

If a component uses a React portal (e.g., `createPortal` targeting `document.body`), its content is rendered outside the standard testing `container` wrapper. 

In this case, query `document.body` instead of `container`:

```typescript
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Dialog } from "@/components/ui/Dialog";

describe("Dialog Accessibility", () => {
  it("should have no accessibility violations when open", async () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} labelledById="title" describedById="desc">
        <h2 id="title">Modal Header</h2>
        <p id="desc">Modal Description Text</p>
      </Dialog>
    );
    // Since Dialog uses a Portal, check the entire document body
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Best Practices

To pass the axe audit, components must adhere to correct semantic structure and keyboard navigation requirements:

- **Accessible Names**: All interactive components (buttons, links) must have visible text or an `aria-label`/`aria-labelledby` attribute.
- **Form Association**: Input fields must be explicitly associated with labels using `id` and `htmlFor` (or wrapped by `<label>`).
- **Contrast Ratios**: Keep foreground text readable against background styling.
- **Images and SVGs**: Always supply `alt="..."` for images. Wrap background decorative icons or SVGs in `aria-hidden="true"`.
- **Portal Labels**: When opening dialogs or modals, always assign `aria-labelledby` and `aria-describedby` pointing to header and desc elements respectively.

---

## Running Accessibility Tests

Run tests containing axe checks as part of the standard test command:

```bash
# Run all tests
npx vitest run

# Run specific component tests
npx vitest run TrustBadge
npx vitest run Dialog
```
