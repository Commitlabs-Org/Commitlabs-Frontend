# Recently viewed commitments

The My Commitments page shows a local-only rail of recently opened commitments.

## Behavior

- Viewing a commitment records its id in `localStorage` under `commitlabs:recently-viewed-commitments`.
- The list is most-recent-first, deduplicated, and capped at six ids.
- Missing commitments are ignored, so stale local ids do not create broken cards.
- The rail is rendered only when at least one recently viewed commitment is present in the current commitments list.

## Files

- `src/lib/recentlyViewedCommitments.ts` owns storage parsing, normalization, writes, and recording.
- `src/components/RecentlyViewedCommitments.tsx` renders the horizontal rail.
- `src/app/commitments/page.tsx` records list-card detail clicks and renders the rail.
- `src/app/commitments/[id]/page.tsx` records direct detail-page views.

## Accessibility

The rail is a labelled region with keyboard-focusable links and visible focus rings.
