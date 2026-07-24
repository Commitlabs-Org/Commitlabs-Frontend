# Marketplace Typeahead Search

`MarketplaceHeader` (`src/components/MarketplaceHeader/MarketplaceHeader.tsx`) exposes a debounced typeahead search backed by `/api/commitments/search`.

---

## API contract

### `GET /api/commitments/search`

| Query param    | Type   | Required | Description                                  |
| -------------- | ------ | -------- | -------------------------------------------- |
| `asset`        | string | yes      | Search term (URL-encoded by `URLSearchParams`) |
| `ownerAddress` | string | yes      | Stellar public key or `"marketplace"` for the public browse view |

**Success — `200 OK`**

```json
{ "data": [ { "commitmentId": "...", "asset": "XLM", "amount": "1000", "riskType": "Safe", ... } ] }
```

**Error** — any non-2xx status is treated as a non-blocking search error; the current results list is cleared and an inline alert is shown. The marketplace page remains fully functional.

---

## Component props

```ts
interface MarketplaceHeaderProps {
  onSearchChange?: (query: string) => void   // debounced callback
  searchDebounceMs?: number                  // default 300
  searchPlaceholder?: string
  backHref?: string                          // default "/"
  createHref?: string                        // default "/create"
  searchQuery?: string                       // controlled initial value
  ownerAddress?: string                      // forwarded to API; defaults to "marketplace"
  onResultSelect?: (item: CommitmentSearchResult) => void
}
```

---

## Debounce & cancellation

- The search fires **300 ms** after the user stops typing (configurable via `searchDebounceMs`).
- Every new search cancels the previous in-flight request via `AbortController`. `AbortError` rejections are silently swallowed — they never surface as UI errors.
- Clearing the input immediately aborts any pending request, empties results, and closes the dropdown.

```
user types "X"        → debounce timer starts
user types "XL"       → previous timer cleared, new timer starts
user types "XLM"      → previous timer cleared, new timer starts
                          (300 ms silence)
                       → fetch("/api/commitments/search?asset=XLM&ownerAddress=…")
                       → previous AbortController aborted
```

---

## Accessible combobox pattern

The search input follows the [ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

| Attribute / role         | Value / behaviour                                          |
| ------------------------ | ---------------------------------------------------------- |
| `role="combobox"`        | on the `<input>`                                           |
| `aria-autocomplete`      | `"list"`                                                   |
| `aria-expanded`          | `"true"` when dropdown is open, `"false"` otherwise        |
| `aria-controls`          | points to the `<ul role="listbox">` (always in the DOM)    |
| `aria-activedescendant`  | set to the active option's `id` during keyboard navigation |
| `aria-busy`              | `"true"` while a fetch is in flight                        |
| `role="listbox"`         | on the `<ul>` (hidden via HTML `hidden` when closed)       |
| `role="option"`          | on each `<li>` result                                      |
| `aria-selected`          | `"true"` on the keyboard-highlighted option only           |

### Keyboard shortcuts

| Key        | Effect                                              |
| ---------- | --------------------------------------------------- |
| `ArrowDown`| Move highlight to the next option (clamps at last)  |
| `ArrowUp`  | Move highlight to the previous option (clamps at 0) |
| `Enter`    | Select the highlighted option, close dropdown       |
| `Escape`   | Close dropdown without selecting                    |

---

## Loading & error states

- **Loading**: a spinning `Loader2` icon appears inside the search field with `aria-hidden`. The `aria-busy="true"` attribute on the input announces the loading state to screen readers.
- **Search error**: a `role="alert"` banner appears directly below the input. It is non-blocking — the marketplace grid and all other controls remain usable.
- **Empty results**: the listbox renders a single "No results found" option when the API returns an empty `data` array.

---

## Stats bar

On mount, the component fetches `GET /api/marketplace/stats` and renders a summary bar (`aria-live="polite"`) showing:

- **Listings** — `activeListings`
- **Avg Yield** — `averageYield` (%)
- **Median Price** — `medianPrice`

Stats errors are displayed inline in red (`role` is not `alert` — stats are supplementary, not critical).

---

## Tests

`tests/components/MarketplaceHeader/MarketplaceHeader.test.tsx` — 45 tests covering:

- Initial render and ARIA attribute values
- Stats fetch (success + error)
- Debounce: empty/whitespace guard, pre-delay guard, single-fire, `onSearchChange` callback
- Request cancellation via `AbortController`
- Results display: count, content, `aria-expanded`, `aria-busy`, empty state, clear-to-close
- Error handling: non-2xx response, silent abort
- Keyboard navigation: ArrowDown/Up clamping, Enter select, Escape dismiss, `aria-activedescendant`
- Mouse interaction: click select, close, input update
- Blur/focus: close on blur, reopen on focus when results cached
- `ownerAddress` forwarding
- Special character URL-encoding
- Accessibility invariants: `role="banner"`, listbox always in DOM, no spurious `aria-activedescendant`
