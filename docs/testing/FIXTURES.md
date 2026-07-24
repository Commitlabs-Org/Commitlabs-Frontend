# Test Data Fixtures: Index & Conventions

This is the map of the shared test data in this repo — where fixtures live, what
each provides, and the naming conventions to follow when adding more. The goal is
that a contributor writing a test reaches for an existing factory instead of
hand-rolling an object, and that new fixtures stay consistent with the existing
ones.

## Where test data lives

| Location | Kind | Purpose |
| -------- | ---- | ------- |
| [`tests/fixtures/index.ts`](../../tests/fixtures/index.ts) | Typed factories | Shared, override-friendly builders for domain objects, DTOs, and component props. The primary entry point. |
| [`tests/fixtures/__tests__/factories.test.ts`](../../tests/fixtures/__tests__/factories.test.ts) | Tests | Guards the factories themselves (valid defaults, overrides apply). |
| [`tests/api/helpers.ts`](../../tests/api/helpers.ts) | Request/response helpers | Build mock `NextRequest`s and parse responses for API-route tests. |
| [`tests/setup/vitest.setup.ts`](../../tests/setup/vitest.setup.ts) | Global setup | `@testing-library/jest-dom` matchers plus custom `toStartWith` / `toEndWith`. Wired via `setupFiles` in [`vitest.config.ts`](../../vitest.config.ts). |
| [`src/lib/backend/mocks/`](../../src/lib/backend/mocks) | Service mocks | Canned `contracts` and `marketplace` backend responses. |
| [`src/lib/backend/mockDb.ts`](../../src/lib/backend/mockDb.ts) + `.mock-db.json` | Mock datastore | `MockData` shape with `getMockData` / `setMockData` for the in-repo mock DB. |
| [`scripts/seed-backend-mock.ts`](../../scripts/seed-backend-mock.ts) | Seeder | Seeds the mock DB (`npm run seed:mock`) via `seedMockData`. |

## Fixture factories

Defined in `tests/fixtures/index.ts`. Every factory:

- returns a **fully valid** object populated with sensible defaults;
- accepts a `Partial<T>` of **overrides** spread last, so a test sets only the
  fields it cares about; and
- is typed from the real domain/DTO/prop source, so an upstream type change is a
  **compile-time** failure in tests rather than a silent drift.

| Factory | Returns | Source type |
| ------- | ------- | ----------- |
| `makeCommitment` | `Commitment` (domain) | `src/lib/types/domain.ts` |
| `makeCommitmentDto` | `CommitmentDto` (backend DTO) | `src/lib/backend/dto.ts` |
| `makeListing` | `MarketplaceListing` (domain) | `src/lib/types/domain.ts` |
| `makeAttestation` | `Attestation` (domain) | `src/lib/types/domain.ts` |
| `makeAttestationDto` | `AttestationDto` (backend DTO) | `src/lib/backend/dto.ts` |
| `makeMarketplaceCard` | `MarketplaceCardProps` | `src/components/MarketplaceCard.tsx` |
| `makePanelAttestation` | `Attestation` (panel) | `src/components/RecentAttestationsPanel/RecentAttestationsPanel.tsx` |

### Usage

```ts
import { makeCommitment, makeListing } from '../fixtures';

// Default, valid object:
const c = makeCommitment();

// Only override what the test exercises:
const expired = makeCommitment({ status: 'Settled', daysRemaining: 0 });

// Compose:
const listing = makeListing({ commitmentId: expired.id });
```

### API route helpers

```ts
import { createMockRequest, createMockRouteContext, parseResponse } from './helpers';

const req = createMockRequest('http://test/api/commitments', {
  method: 'POST',
  body: { /* … */ },
  headers: { 'x-request-id': 'fixed-id' },
});
const res = await POST(req, createMockRouteContext({ id: 'CMT-001' }));
const { status, data } = await parseResponse(res);
```

## Naming conventions

Follow these so new fixtures match what's already here:

- **Factory functions:** `make<Thing>` (e.g. `makeCommitment`). For the backend
  DTO variant of a domain object, suffix `Dto` (`makeCommitmentDto`). For a
  component-specific variant, suffix the context (`makePanelAttestation`).
- **Request/response helpers:** `createMock<Thing>` (e.g. `createMockRequest`,
  `createMockRouteContext`); response readers read plainly (`parseResponse`).
- **Identifier values:** type-prefixed, zero-padded — `CMT-001` (commitment),
  `LST-001` (listing), `ATT-001` (attestation).
- **Stellar addresses:** start with `G` and are padded to a realistic length,
  e.g. `GOWNER0000…`, `GSELLER0000…`.
- **Timestamps:** ISO‑8601 UTC strings (`2026-01-01T00:00:00.000Z`).
- **Test files:** `*.test.ts` / `*.test.tsx`, matched by `vitest.config.ts`
  (`**/*.{test,spec}.…`). Tests live under `tests/api/`, `tests/components/`,
  and `tests/fixtures/__tests__/`, mirroring the area under test.

## Adding a new fixture

1. Prefer a **factory** in `tests/fixtures/index.ts` over a literal object in a
   single test — if two tests would build the same shape, it belongs here.
2. Import and type it from the real source (`@/lib/types/domain`,
   `@/lib/backend/dto`, or the component's props) so it stays in lockstep.
3. Give it valid defaults and a `Partial<T>` overrides parameter spread last.
4. Use the [naming conventions](#naming-conventions) above.
5. Add a row to the [Fixture factories](#fixture-factories) table and, if it has
   non-trivial behaviour, cover it in `tests/fixtures/__tests__/factories.test.ts`.
