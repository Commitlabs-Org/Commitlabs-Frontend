# Frontend Testing Guide

CommitLabs frontend tests use Vitest, React Testing Library, happy-dom, and V8 coverage. Use this guide when adding component, hook, utility, or route tests.

## Commands

The project scripts are package-manager neutral. Use `pnpm` in the standard contributor flow, or the equivalent `npm` command when working from `package-lock.json`.

```bash
pnpm test
pnpm test:watch
pnpm test:coverage

npm test
npm run test:watch
npm run test:coverage
```

Run a focused file while developing:

```bash
pnpm vitest run src/components/Example.test.tsx
npx vitest run src/components/Example.test.tsx
```

Coverage thresholds live in `vitest.config.ts`. Keep new tests focused on user-visible behavior, API contracts, and edge cases rather than snapshots.

## Placement And Naming

- Put component tests next to the component or in the nearest `__tests__` folder.
- Put shared utility tests under `src/lib/__tests__`, `src/utils/__tests__`, or the nearest existing test folder.
- Use `.test.ts` for non-JSX tests and `.test.tsx` for tests that render React.
- Add `// @vitest-environment happy-dom` at the top of DOM or React Testing Library tests.
- Prefer role, label, and text queries over test IDs. Use test IDs only for mocked internals or when the user-facing surface has no stable accessible name.

## React Testing Library Pattern

Test behavior the user can observe:

```tsx
// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function SaveButton({ onSave }: { onSave: () => void }) {
  return <button onClick={onSave}>Save changes</button>
}

it('calls the save action', () => {
  const onSave = vi.fn()

  render(<SaveButton onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(onSave).toHaveBeenCalledTimes(1)
})
```

## Mocking Fetch

Use a scoped mock and restore it after each test:

```ts
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

it('reads API data', async () => {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as typeof fetch

  const response = await fetch('/api/health')
  await expect(response.json()).resolves.toEqual({ status: 'ok' })
})
```

## Mocking Freighter

Mock `@stellar/freighter-api` at module scope before importing the code under test:

```ts
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(async () => ({ isConnected: true })),
  getAddress: vi.fn(async () => ({ address: 'GCOMMITLABS...' })),
}))
```

Then assert wallet-dependent behavior through the public helper or component output, not by reaching into private state.

## Fake Timers

Freeze time when relative labels, expiration windows, or nonce timestamps matter:

```ts
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})
```

## Route And Backend Tests

- Prefer direct handler calls with mock `Request` objects for App Router routes.
- Mock network, storage, wallet, and chain dependencies.
- Assert status, headers, and response body shape.
- Keep request IDs, CORS, rate-limit, and error-contract tests close to the route or backend helper.

## Example Suite

`src/lib/__tests__/testingGuideExamples.test.tsx` runs examples for fetch mocks, Freighter mocks, fake timers, and RTL user-facing queries. Update that file when this guide changes a pattern that should stay executable.
