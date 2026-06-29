# Frontend Testing Guide

This guide documents the testing conventions, patterns, and best practices for the CommitLabs frontend. It covers running tests, mocking common dependencies (fetch, Freighter wallet API, timers), and using React Testing Library.

## 📋 Quick Reference

- **Test Framework**: Vitest
- **Component Testing**: React Testing Library + happy-dom
- **Coverage Requirement**: 95% (statements, branches, functions, lines)
- **Test Environment**: happy-dom (lightweight DOM alternative)

## 🚀 Running Tests

### Run all tests once
```bash
pnpm test
```

### Run tests in watch mode
Watch mode re-runs tests automatically when files change. Ideal for development.
```bash
pnpm test:watch
```

### Generate coverage report
```bash
pnpm test:coverage
```

Coverage reports are generated in HTML format and opened in your browser. The project enforces a **95% threshold** across:
- Statements
- Branches
- Functions
- Lines

**Covered files** are configured in `vitest.config.ts` and currently include the `src/lib/backend/` directory.

## 📁 Test Organization

Tests are organized by type and location:

```
tests/
├── api/                    # API route tests
│   ├── helpers.ts          # Shared test utilities
│   ├── health.test.ts
│   └── [...other routes]
├── components/             # Component tests
├── lib/                    # Library/utility tests
├── setup/                  # Test setup and configuration
│   ├── vitest.setup.ts     # Global setup
│   └── vitest.d.ts         # Type definitions
└── *.test.tsx             # Smoke/integration tests
```

### Naming Conventions

- **Test files**: `<name>.test.ts` or `<name>.test.tsx` (suffix, not `__tests__` folder)
- **Test suites**: Use `describe()` blocks
- **Test cases**: Use `it()` blocks with clear, descriptive names
- **Component props interfaces**: `React.ComponentProps<typeof ComponentName>`

### File Placement

For **component tests**, place them alongside the component or in a `tests/components/` directory:

```
src/components/
├── MyComponent.tsx
└── MyComponent.test.tsx     ← Same folder is acceptable
```

For **API route tests**, place them in `tests/api/`:

```
tests/api/
└── some-route.test.ts
```

For **library/utility tests**, place them in `tests/lib/`:

```
tests/lib/
└── some-utility.test.ts
```

## 🧪 Core Patterns

### 1. Component Testing with React Testing Library

Use **accessibility-first queries** when testing components:

```typescript
// ✅ GOOD: Query by role (most accessible)
const button = screen.getByRole('button', { name: /submit/i });

// ✅ GOOD: Query by label (forms)
const input = screen.getByLabelText('Email address');

// ✅ GOOD: Query by placeholder (when label not available)
const searchInput = screen.getByPlaceholderText('Search...');

// ❌ AVOID: Query by test ID (last resort only)
const element = screen.getByTestId('my-element');

// ❌ AVOID: Query by tag or class
const element = screen.getByTag('div');
```

**Always import from `@testing-library/react`**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

#### Example: Component Test

```typescript
// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyButton from '@/components/MyButton';

describe('MyButton', () => {
  it('renders with label and handles click', () => {
    const onClickHandler = vi.fn();

    render(
      <MyButton onClick={onClickHandler} label="Click me" />
    );

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClickHandler).toHaveBeenCalledOnce();
  });

  it('disables the button when loading', () => {
    render(<MyButton label="Submit" isLoading />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

### 2. Mocking Fetch

Use `vi.stubGlobal()` to mock the global `fetch` function:

```typescript
import { describe, it, beforeEach, afterEach, vi } from 'vitest';

describe('API Integration', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches and displays data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    // ... your test code
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/endpoint',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('handles fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // ... expect error handling
  });
});
```

**Helper for mock responses**:

```typescript
function createMockResponse<T>(data: T, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response);
}
```

### 3. Mocking Freighter Wallet API

Mock the `@stellar/freighter-api` module to test wallet interactions:

```typescript
import { describe, it, beforeEach, vi } from 'vitest';

// Mock the Freighter API
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
}));

import { isConnected, getPublicKey, signTransaction } from '@stellar/freighter-api';

describe('Wallet Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects and retrieves public key', async () => {
    const mockAddress = `G${'A'.repeat(55)}`;

    vi.mocked(isConnected).mockResolvedValue(true);
    vi.mocked(getPublicKey).mockResolvedValue(mockAddress);

    // ... your test code
    expect(getPublicKey).toHaveBeenCalled();
  });

  it('signs a transaction', async () => {
    const mockSignedXDR = 'AAAAAgAA...';
    vi.mocked(signTransaction).mockResolvedValue(mockSignedXDR);

    // ... your test code
    expect(signTransaction).toHaveBeenCalledWith(
      expect.stringContaining('Transaction'),
      expect.any(Object)
    );
  });

  it('handles wallet not installed', async () => {
    vi.mocked(isConnected).mockRejectedValue(
      new Error('Freighter is not installed')
    );

    // ... expect graceful error handling
  });
});
```

### 4. Mocking Module Imports

Use `vi.mock()` to mock entire modules or services:

```typescript
import { vi } from 'vitest';

// Mock at module level (top of file, runs before imports)
vi.mock('@/lib/backend/contracts', () => ({
  getCommitmentFromChain: vi.fn(),
  createCommitmentOnChain: vi.fn(),
}));

// Now you can import and use mocked versions
import {
  getCommitmentFromChain,
  createCommitmentOnChain,
} from '@/lib/backend/contracts';

describe('Commitment Service', () => {
  it('retrieves commitment', async () => {
    const mockCommitment = { id: 'c-1', status: 'ACTIVE' };
    vi.mocked(getCommitmentFromChain).mockResolvedValue(mockCommitment as any);

    // ... test code
    expect(getCommitmentFromChain).toHaveBeenCalledWith('c-1');
  });
});
```

**Partial mocking** (keep some real implementations):

```typescript
vi.mock('@/lib/backend/validation', async (importActual) => {
  const actual = await importActual<
    typeof import('@/lib/backend/validation')
  >();

  return {
    ...actual,
    validateEmail: vi.fn((email) => email.includes('@')),
  };
});
```

### 5. Fake Timers

Use fake timers to test time-dependent code without waiting:

```typescript
import { describe, it, beforeEach, afterEach, vi } from 'vitest';

describe('Polling Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls at regular intervals', async () => {
    const poll = vi.fn();

    // Simulate polling every 1 second
    const interval = setInterval(poll, 1000);

    // Fast-forward time
    vi.advanceTimersByTime(3000);

    expect(poll).toHaveBeenCalledTimes(3);

    clearInterval(interval);
  });

  it('handles timeout correctly', async () => {
    const callback = vi.fn();

    setTimeout(callback, 5000);

    // Fast-forward 5 seconds
    vi.advanceTimersByTime(5000);

    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs all pending timers', async () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    setTimeout(fn1, 1000);
    setTimeout(fn2, 2000);

    // Run all timers at once
    vi.runAllTimers();

    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });
});
```

### 6. Testing API Routes

Use helpers to create mock requests and test route handlers:

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';
import { createMockRequest, parseResponse } from '../helpers';

describe('GET /api/health', () => {
  it('returns a healthy status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health');
    const response = await GET(request, { params: {} });
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      success: true,
      data: { status: 'healthy' },
    });
  });
});
```

**Helper functions** (from `tests/api/helpers.ts`):

```typescript
// Create a mock NextRequest
const request = createMockRequest(url, {
  method: 'POST',
  body: { key: 'value' },
  headers: { 'x-custom': 'header' },
});

// Create route context for dynamic routes
const context = createMockRouteContext({ id: '123' });

// Parse response for assertions
const result = await parseResponse(response);
// result.status, result.data, result.headers
```

## 🔧 Test Utilities

### Custom Matchers

The project includes custom matchers in `tests/setup/vitest.setup.ts`:

```typescript
// Check if string starts with
expect('hello world').toStartWith('hello');

// Check if string ends with
expect('hello world').toEndWith('world');
```

### Testing Library Matchers

Common matchers from `@testing-library/jest-dom`:

```typescript
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toBeDisabled();
expect(element).toHaveAttribute('href', '/path');
expect(element).toHaveClass('active');
expect(element).toHaveTextContent('Expected text');
```

## 🎯 Common Testing Scenarios

### Testing with Context Providers

```typescript
import { render } from '@testing-library/react';
import { WalletProvider } from '@/contexts/WalletContext';

function renderWithProviders(component: React.ReactElement) {
  return render(
    <WalletProvider>
      {component}
    </WalletProvider>
  );
}

describe('ComponentUsingWallet', () => {
  it('displays wallet status', () => {
    renderWithProviders(<ComponentUsingWallet />);
    // test code
  });
});
```

### Testing Async Operations

```typescript
import { render, screen, waitFor } from '@testing-library/react';

it('loads data asynchronously', async () => {
  render(<DataLoader />);

  // Wait for async operation to complete
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

### Testing Form Submissions

```typescript
import userEvent from '@testing-library/user-event';

it('submits form with validation', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<Form onSubmit={onSubmit} />);

  const input = screen.getByLabelText('Email');
  await user.type(input, 'test@example.com');

  const button = screen.getByRole('button', { name: /submit/i });
  await user.click(button);

  expect(onSubmit).toHaveBeenCalledWith({
    email: 'test@example.com',
  });
});
```

## 📝 Templates

### Component Test Template

```typescript
// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyComponent from '@/components/MyComponent';

interface MockProps extends Partial<React.ComponentProps<typeof MyComponent>> {}

function renderComponent(props: MockProps = {}) {
  const defaultProps: React.ComponentProps<typeof MyComponent> = {
    // Set required props
  };

  return render(<MyComponent {...defaultProps} {...props} />);
}

describe('MyComponent', () => {
  it('renders with default props', () => {
    renderComponent();

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles user interaction', () => {
    const onAction = vi.fn();

    renderComponent({ onAction });

    fireEvent.click(screen.getByRole('button'));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('displays error state', () => {
    renderComponent({ error: 'Something went wrong' });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
```

### Route Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/my-route/route';
import { createMockRequest, parseResponse } from '../helpers';

vi.mock('@/lib/backend/service', () => ({
  getService: vi.fn(),
}));

import { getService } from '@/lib/backend/service';

describe('POST /api/my-route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 on success', async () => {
    vi.mocked(getService).mockResolvedValue({ data: 'test' } as any);

    const request = createMockRequest('http://localhost:3000/api/my-route', {
      method: 'POST',
      body: { key: 'value' },
    });

    const response = await POST(request, { params: {} });
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ success: true });
  });

  it('returns 400 on invalid input', async () => {
    const request = createMockRequest('http://localhost:3000/api/my-route', {
      method: 'POST',
      body: {}, // Missing required fields
    });

    const response = await POST(request, { params: {} });
    const result = await parseResponse(response);

    expect(result.status).toBe(400);
  });

  it('returns 405 for unsupported method', async () => {
    const request = createMockRequest('http://localhost:3000/api/my-route', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(405);
  });
});
```

## ✅ Best Practices

### DO:

- ✅ Write tests with **user behavior in mind** (what does the user see and do?)
- ✅ Use **accessibility queries** (getByRole, getByLabelText)
- ✅ Keep tests **focused and isolated** (one behavior per test)
- ✅ Mock **external dependencies** (fetch, wallet API, services)
- ✅ Use **descriptive test names** that explain what's being tested
- ✅ Clean up mocks in `afterEach()` blocks
- ✅ Test **both success and error cases**
- ✅ Use **fake timers** to avoid slow tests

### DON'T:

- ❌ Test **implementation details** (test behavior, not how it works)
- ❌ Use `getByTestId` as first choice (only when necessary)
- ❌ Leave **mock setup in tests** (use beforeEach/afterEach)
- ❌ Create **overly complex test scenarios** (break them into smaller tests)
- ❌ Test **libraries you didn't write** (assume they work)
- ❌ Forget to **await async operations**
- ❌ Use `setTimeout` instead of fake timers

## 🐛 Debugging Tips

### Run a single test
```bash
pnpm test -- hero-section.test.tsx
```

### Run tests matching a pattern
```bash
pnpm test -- --grep "renders"
```

### Run with UI dashboard
```bash
pnpm test:ui
```

### Enable verbose output
```bash
pnpm test -- --reporter=verbose
```

### Debug in VS Code
Add this to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test", "--inspect-brk", "--watch"],
  "console": "integratedTerminal"
}
```

## 📚 External Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [@testing-library/jest-dom Matchers](https://github.com/testing-library/jest-dom)

## 🔗 Related Documentation

- [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) — Coding standards and contribution workflow
- [README.md](../README.md) — Project overview and setup
- [docs/FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — Component structure and data flow
