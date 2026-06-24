# Frontend Testing Guide

This guide documents the testing conventions, tooling, and common patterns used in the CommitLabs frontend.

## Table of Contents

- [Tooling](#tooling)
- [Running Tests](#running-tests)
- [Test File Conventions](#test-file-conventions)
- [Common Patterns](#common-patterns)
- [Component Test Template](#component-test-template)
- [Route Test Template](#route-test-template)
- [Coverage](#coverage)

## Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| [Vitest](https://vitest.dev/) | Test runner | `vitest.config.ts` |
| [React Testing Library](https://testing-library.com/) | Component testing | configured in `setupTests.ts` |
| [happy-dom](https://github.com/happy-dom/happy-dom) | Lightweight DOM environment | via `@vitest-environment happy-dom` |
| [v8](https://v8.dev/docs/code-coverage) | Code coverage | `pnpm test:coverage` |

## Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (development)
pnpm test:watch

# Coverage report
pnpm test:coverage

# Run a specific file
pnpm test src/utils/__tests__/explorerLinks.test.ts

# Run matching a pattern
pnpm test -- --reporter=verbose
```

## Test File Conventions

### Placement

Tests live in `__tests__` directories alongside the code they test:

```
src/
  components/
    __tests__/
      CommitmentDetail.test.tsx
    CommitmentDetail.tsx
  utils/
    __tests__/
      explorerLinks.test.ts
    explorerLinks.ts
```

### Naming

- Test files: `<module>.test.ts` (utilities) or `<Component>.test.tsx` (components)
- Test suites: `describe` block named after the module/component
- Test cases: `it` block describing the expected behavior

### Environment

Add the environment directive at the top of test files that need DOM:

```ts
// @vitest-environment happy-dom
```

## Common Patterns

### Mocking `fetch`

```ts
const mockFetch = vi.fn()
global.fetch = mockFetch

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'value' }),
} as Response)
```

### Mocking `@stellar/freighter-api`

```ts
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(true),
  getPublicKey: vi.fn().mockResolvedValue('G' + 'A'.repeat(55)),
  signTransaction: vi.fn().mockResolvedValue('signed-tx'),
}))
```

### Fake Timers

```ts
vi.useFakeTimers()

// Advance time
vi.advanceTimersByTime(1000)

// Restore
vi.useRealTimers()
```

### Accessibility-First Assertions

Prefer accessible queries over CSS selectors:

```ts
// Good: query by role
const button = screen.getByRole('button', { name: /submit/i })

// Good: query by label
const input = screen.getByLabelText('Email address')

// Avoid: query by class
const button = container.querySelector('.btn-primary')
```

## Component Test Template

```tsx
// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComponentName } from '../ComponentName'

describe('ComponentName', () => {
  it('renders with default props', () => {
    render(<ComponentName />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const onClick = vi.fn()
    render(<ComponentName onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('displays error state', () => {
    render(<ComponentName error="Something went wrong" />)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})
```

## Route Test Template

```ts
// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

describe('Route: /marketplace', () => {
  it('renders the marketplace grid', () => {
    // Test implementation
  })

  it('handles empty state', () => {
    // Test implementation
  })
})
```

## Coverage

The project enforces minimum 95% coverage on new/changed lines. Run `pnpm test:coverage` to see the report.

| Metric | Threshold |
|--------|-----------|
| Statements | >= 95% |
| Branches | >= 95% |
| Functions | >= 95% |
| Lines | >= 95% |

---

Cross-linked from [README.md](../../README.md) and [docs/DEVELOPER_GUIDE.md](../../docs/DEVELOPER_GUIDE.md).
