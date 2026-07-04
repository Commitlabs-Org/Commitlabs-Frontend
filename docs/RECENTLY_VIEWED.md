# Recently viewed commitments

The My Commitments page can show a local "Recently viewed commitments" rail. It is a device-local shortcut list for commitments the current browser has opened.

## Contract

- Detail pages call `recordRecentlyViewedCommitment(commitmentId)` after loading a valid commitment.
- IDs are stored in `localStorage` under `commitlabs:recently-viewed-commitments`.
- The list is deduplicated, newest-first, and bounded to six entries.
- The rail receives the current user's commitment list and silently skips IDs that are no longer present.

## Accessibility

- The rail is a labelled `section`.
- Entries are regular links, so tab navigation and standard browser link behavior work without custom key handling.
- Each link has an explicit `aria-label` with the commitment id.

## Usage

```tsx
<RecentlyViewedCommitments commitments={commitmentsList} />
```

Use the full current-user commitment list, not the filtered search result, so recently viewed entries remain available even while the grid is filtered.
