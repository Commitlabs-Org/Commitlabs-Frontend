# Sidebar Search

## Overview

`SidebarSearch` is a persistent global search widget embedded in the `AppSidebar`. It lets authenticated users find commitments directly from the sidebar without opening the Cmd-K palette, using the existing `/api/commitments/search` endpoint.

## Features

- **Debounced input** — reuses `useDebounce` (350 ms delay) to avoid over-fetching.
- **Grouped results** — shows up to 5 matching commitments with ID and asset label; includes a fallback link to search the marketplace.
- **Keyboard navigation** — ArrowUp / ArrowDown to move between results, Enter to navigate, Escape to close.
- **Loading / empty / error states** — spinner while fetching; "No commitments found" when empty; dismissible error banner on failure.
- **Clear button** — single click resets query and results.
- **Accessible combobox** — roles: `combobox`, `searchbox`, `listbox`, `option`; `aria-live` region for screen-reader announcements; `aria-activedescendant` tracks keyboard focus.
- **Collapsed mode** — when the sidebar is collapsed to icon-only width, the search renders as an icon button that can expand the search on click.
- **No Cmd-K conflict** — the search does not intercept global keyboard shortcuts; it is purely a sidebar-local widget.

## Props / API

### `SidebarSearchProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ownerAddress` | `string \| undefined` | `undefined` | Wallet / owner address used to scope the `/api/commitments/search` query. When omitted, the search input is rendered but no fetch is made. |
| `isCollapsed` | `boolean` | `false` | When `true`, renders a compact icon button instead of the full input. |
| `onResultSelect` | `() => void \| undefined` | `undefined` | Callback fired after a result is selected (e.g. to close the mobile sidebar drawer). |

### `CommitmentSearchResult`

The shape returned by the search endpoint and used internally:

```ts
interface CommitmentSearchResult {
  commitmentId: string
  ownerAddress: string
  asset: string
  amount: string
  status: string
  riskType: string
  complianceScore: number
}
```

## Usage Example

```tsx
import { AppSidebar } from '@/components/shell'

// In your authenticated layout, pass the connected wallet address:
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address } = useWallet()

  return (
    <div className="flex">
      <AppSidebar ownerAddress={address} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

The `SidebarSearch` component is also available as a standalone export:

```tsx
import { SidebarSearch } from '@/components/shell'

<SidebarSearch ownerAddress="GXYZ..." onResultSelect={() => closeDrawer()} />
```

## Accessibility

- The search container uses `role="combobox"` with `aria-haspopup="listbox"` and `aria-expanded` reflecting dropdown state.
- The input uses `role="searchbox"`, `aria-autocomplete="list"`, `aria-controls` (pointing to the listbox), and `aria-activedescendant` (updated on keyboard navigation).
- Results use `role="listbox"` / `role="option"` with `aria-selected`.
- A visually hidden `role="status" aria-live="polite"` region announces result counts and loading state to screen readers.
- Error messages use `role="alert"` for immediate announcement.
- Empty-state messages use `role="status" aria-live="polite"`.

## Backend Route

Powered by `src/app/api/commitments/search/route.ts`.

Query parameters used by `SidebarSearch`:

| Param | Value |
|-------|-------|
| `ownerAddress` | Wallet address (required) |
| `asset` | Uppercased query string (used as asset filter) |
| `pageSize` | `5` |

## Related Documentation

- [App Shell Sidebar](./APP_SHELL_SIDEBAR.md)
- [Marketplace Search UI](./MARKETPLACE_SEARCH_UI.md)
