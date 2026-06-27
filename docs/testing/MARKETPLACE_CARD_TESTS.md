# MarketplaceCard Test Coverage

`src/components/__tests__/MarketplaceCard.test.tsx` — 47 tests covering type variants, score clamping, data fields, trust badges, sale states, modal interaction, and ARIA semantics.

---

## Component under test

`src/components/MarketplaceCard.tsx` — the primary listing card rendered in the marketplace grid. Exported as a memoised `MarketplaceCard` (via `React.memo`).

### Key props

| Prop | Type | Notes |
|------|------|-------|
| `id` | `string` | Used in ID label, aria-labels, and default trade href |
| `type` | `"Safe" \| "Balanced" \| "Aggressive"` | Controls border, badge, and score colours |
| `score` | `number` | Clamped to `[0, 100]` and rounded before display |
| `amount` | `string` | Displayed verbatim |
| `duration` | `string` | Displayed verbatim |
| `yield` | `string` | Displayed verbatim |
| `maxLoss` | `string` | Displayed verbatim |
| `owner` | `string` | Truncated to `XXXXXX...YYYY` when longer than 12 chars |
| `price` | `string` | Shown in the price block (forSale only) |
| `forSale` | `boolean` | Switches between "for sale" and "not for sale" layouts |
| `tradeHref?` | `string` | Overrides the default `/marketplace/trade?id=…` href |
| `trustLevel?` | `TrustLevel` | Defaults to `"unverified"` |

---

## Mocks

| Module | Mock strategy |
|--------|---------------|
| `next/link` | Renders a plain `<a href="...">` — preserves `href` and `aria-label` for assertion |
| `@/components/modals/CommitmentDetailsModal` | Renders `<div role="dialog" data-commitment-id="…">` when `isOpen=true`, nothing otherwise — isolates MarketplaceCard from Dialog/portal internals |

---

## Test groups

### Type variants (15 tests)

Parametrised over `Safe`, `Balanced`, and `Aggressive` using `it.each`:

- Badge label text is present (`"Safe"`, `"Balanced"`, `"Aggressive"`)
- `<article>` border class matches the type (`border-[#00C95066]` / `border-[#2B7FFF66]` / `border-[#FF690066]`)
- Badge background class matches the type (`bg-[#0f2a1d]` / `bg-[#122238]` / `bg-[#2b1c10]`)
- Score colour class matches the type (`text-[#00C950]/95` / `text-[#51A2FF]/95` / `text-[#FF8904]/95`)
- An SVG type icon is rendered inside the `aria-hidden` icon container

### Compliance score (5 tests)

Tests the `clampScore` utility embedded in the component:

| Input | Expected display |
|-------|-----------------|
| `NaN` | `0%` |
| `-10` | `0%` |
| `150` | `100%` |
| `84.6` | `85%` (rounds) |
| `100` / `0` | exact boundary values |

### Data fields (7 tests)

- `amount`, `duration`, `yield`, `maxLoss` displayed verbatim
- Long owner address is truncated: `GABCDEF123456GHIJKLMNO789` → `GABCDE...O789`
- Short owner (≤ 12 chars) displayed unchanged
- Exactly 12-char address displayed unchanged (boundary)
- ID formatted as `#CMT-NNN` with zero-padding: `"7"` → `#CMT-007`, `"1234"` → `#CMT-1234`

### Trust badge (4 tests)

Delegates to `TrustBadge` (covered separately in `TRUST_BADGE_TESTS.md`). Assertions here are minimal:

- Omitting `trustLevel` defaults to `"unverified"` → `role="status"` name `Self-Reported`
- `"verified"` → `Verified Seller`
- `"reputable"` → `Top Reputation`
- `"unverified"` → `Self-Reported`

### forSale=true (8 tests)

- Price text and `"Price"` label rendered
- View button present with `aria-label="View {id}"`
- Trade link present with `aria-label="Trade {id}"`
- Default trade href: `/marketplace/trade?id=${encodeURIComponent(id)}`
- Custom `tradeHref` prop overrides the default
- `"Not for sale"` is absent
- Clicking View button opens `CommitmentDetailsModal` for the correct `commitmentId`
- Clicking the modal's `onClose` handler removes the modal from the DOM

### forSale=false (5 tests)

- `"Not for sale"` indicator present
- Indicator has `aria-disabled="true"`
- View button present
- Trade link absent
- Price block (price text + `"Price"` label) absent

### Accessible semantics (7 tests)

- `<article aria-label="Commitment {id}">` — unique label per card
- View button `aria-label="View {id}"`
- Trade link `aria-label="Trade {id}"`
- Icon container is `aria-hidden="true"`
- Price block has `aria-label="Price"`
- Stats use `<dl>`/`<dt>`/`<dd>` structure
- Field labels (`Amount`, `Duration`, `Yield`, `Max Loss`, `Owner`) are visible text, not aria-only

### Edge cases (3 tests)

- Whitespace-only owner address does not crash (trims to empty, length ≤ 12, renders as-is)
- Component renders without optional props (`trustLevel`, `tradeHref`)
- Special characters in `id` are percent-encoded in the default trade href

---

## Running the tests

```bash
NODE_OPTIONS="--experimental-require-module" pnpm test src/components/__tests__/MarketplaceCard.test.tsx
```
