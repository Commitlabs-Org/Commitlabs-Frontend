# Breadcrumbs

An accessible breadcrumb trail derived from the current route's path
segments, for nested routes like `/commitments/[id]`.

## Usage

```tsx
import { Breadcrumbs } from '@/components/shell/Breadcrumbs';

export default function CommitmentDetailPage() {
  const commitment = getCommitmentById(params.id);
  return (
    <main>
      <Breadcrumbs currentLabel={`${commitment.type} Commitment`} />
      {/* ... */}
    </main>
  );
}
```

## API

```ts
interface BreadcrumbsProps {
  /**
   * Overrides the label for the trailing path segment -- e.g. resolving a
   * commitment id to a friendly label. Falls back to a readable version of
   * the raw segment when omitted.
   */
  currentLabel?: string;
}
```

## Behavior

- Segments are derived from `usePathname()`, split on `/`.
- **Hidden on top-level routes** (0 or 1 path segments -- e.g. `/`,
  `/analytics`, `/create`), where a trail adds no navigational value.
- Each non-final segment renders as a real `<Link>` (keyboard-focusable in
  document order, no custom key handling needed).
- The final segment is not a link -- it's the current page, marked
  `aria-current="page"`, and is intentionally the only place a resolved
  friendly label (`currentLabel`) is used. Intermediate segments always use
  a readable version of the raw route segment (title-cased, `-`/`_` folded
  to spaces).
- **Id resolution fallback:** when `currentLabel` isn't provided and the
  trailing segment looks like an opaque id (no separators, > 12 characters),
  it's shown truncated (`9f2a7c3e…`) rather than the full raw string.
  Shorter or hyphenated segments are title-cased instead (`overview-panel`
  → "Overview Panel").
- Renders as `<nav aria-label="Breadcrumb">` -- distinct from the page's
  `<h1>`, so it never duplicates the page title.

## Testing

See `src/components/shell/Breadcrumbs.test.tsx`: hidden on root and
top-level routes, renders a trail with correct hrefs for nested routes,
marks the last segment `aria-current="page"` and non-linked, friendly-label
override, truncated-id fallback, title-cased fallback for short segments.
