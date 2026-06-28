# Test Fixtures and Mock Data

This document indexes the shared test helpers, mock data, and naming
conventions used across the CommitLabs frontend test suite.

## Fixture Locations

| Location | Use for | Notes |
|----------|---------|-------|
| `tests/api/helpers.ts` | API route request/response helpers | Reuse `createMockRequest`, `createMockRouteContext`, and `parseResponse` before creating route-specific request builders. |
| `tests/setup/vitest.setup.ts` | Global Vitest setup | Registers `@testing-library/jest-dom/vitest` plus shared string matchers. Keep this file limited to environment-wide behavior. |
| `tests/setup/vitest.d.ts` | Matcher type declarations | Add TypeScript declarations here when adding global matchers in `vitest.setup.ts`. |
| `src/lib/backend/mocks/contracts.ts` | Backend commitment mock data and service fixtures | Use for commitment service tests or mock-mode page flows that need commitment records. |
| `src/lib/backend/mocks/marketplace.ts` | Backend marketplace listing fixtures | Use for marketplace API/service tests that need listing-shaped data. |
| `src/**/__tests__/*` | Component or library fixtures scoped to one source area | Keep fixtures near the test when reuse outside that folder is unlikely. |
| `tests/components/*` and `tests/api/*` | Broader integration-style fixtures | Prefer these when a fixture is shared across multiple files in the same test area. |

## Naming Convention

- Use `makeThing` for factory functions that return a fresh object, for example
  `makeCommitment`, `makeListing`, or `makeRequestBody`.
- Use `THING_A`, `THING_B`, or `DEFAULT_THING` for immutable constants that are
  safe to share across assertions.
- Use `mockThing` for Vitest mocks, spies, and stub functions, for example
  `mockFetchProtocolConstants`.
- Use explicit scenario names for edge-case fixtures, such as
  `expiredListing`, `unauthorizedRequest`, or `malformedPayload`.
- Keep ids stable and human-readable (`001`, `listing-1`, `commitment-1`) unless
  the code under test specifically requires randomized input.

## Reuse Guidelines

1. Start with local fixtures inside the test file when the data only serves one
   behavior.
2. Move a factory into a nearby `__tests__` helper only after at least two files
   in that feature area need it.
3. Use `tests/api/helpers.ts` for Next.js request and response plumbing instead
   of rebuilding `NextRequest` objects in each API test.
4. Add global setup only when every test can safely receive the behavior. Avoid
   putting route-specific mocks, timers, or browser API shims in
   `vitest.setup.ts`.
5. Prefer typed factories over `as any` casts. If a partial object is useful,
   accept `Partial<Type>` overrides and merge them into a complete default.

```ts
function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    type: 'Safe',
    score: 95,
    amount: '$50,000',
    duration: '25 days',
    yield: '5.2%',
    maxLoss: '2%',
    owner: 'GOWNER1234567890',
    price: '$52,000',
    forSale: true,
    ...overrides,
  };
}
```

## When to Add a Shared Fixture

Add or promote a shared fixture when:

- two or more tests repeat the same object shape or setup sequence;
- the fixture describes a stable domain concept, such as an active commitment,
  expired listing, authenticated request, or invalid API payload;
- duplicated setup makes edge cases harder to review;
- the factory can stay deterministic and side-effect free.

Keep the fixture local when:

- it only supports one test case;
- the setup includes test-specific spies or assertions;
- sharing it would hide the behavior being tested;
- the fixture would need broad optional fields just to satisfy unrelated tests.

## API Route Pattern

API route tests should prefer the shared helpers:

```ts
const request = createMockRequest('http://localhost/api/commitments', {
  method: 'POST',
  body: { type: 'Safe', amount: '1000' },
});

const response = await POST(request);
const parsed = await parseResponse(response);

expect(parsed.status).toBe(200);
```

This keeps request construction, JSON parsing, and header assertions consistent
across route tests.

## Maintenance Checklist

- Link new shared fixture files from this document.
- Keep factory return types explicit.
- Reset mutable global state in `beforeEach` or `afterEach`.
- Avoid storing secrets, private keys, real wallet addresses, or live service
  responses in fixtures.
- Prefer deterministic dates, ids, and random values so snapshots and coverage
  reports stay stable.
