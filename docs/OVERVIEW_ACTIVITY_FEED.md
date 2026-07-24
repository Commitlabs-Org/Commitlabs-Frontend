# Overview Activity Feed

## Purpose
The Recent Activity Feed widget displays chronological events from all of a user's commitments on the commitments overview page.

## Features
- Fetches events from `/api/commitments/[id]/history` for each commitment
- Renders events with:
  - Event-specific icons
  - Relative timestamps (accessible with `datetime` attribute)
  - Deep links to individual commitment pages
- Caps feed at a configurable number of items (default: 5)
- Shows "View All Activity" link when there are more items
- Skeleton loading state
- Empty state when no activity exists

## Event Types Handled
| Kind | Icon | Color |
|------|------|-------|
| created | Plus circle | Blue |
| attestation | Check circle | Green |
| early_exit | Minus circle | Orange |
| settlement | Check circle | Purple |

## Usage
```tsx
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';

// In your component
<RecentActivityFeed commitments={commitmentsArray} maxItems={5} />
```

## Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| commitments | Commitment[] | required | Array of user commitments |
| maxItems | number | 5 | Maximum number of events to display before showing "View All" |
