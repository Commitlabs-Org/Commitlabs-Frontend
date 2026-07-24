# Commitment Status Context

## Overview
This feature introduces a shared context for commitment status data on the commitment detail page, providing a single source of truth for live status updates. The context polls the commitment status API at a configurable interval and pauses polling when the tab is hidden to conserve resources.

## Key Components

### `CommitmentStatusProvider`
A context provider that wraps the commitment detail page and manages polling, state, and visibility handling.

**Props:**
- `commitmentId`: Unique identifier of the commitment
- `pollIntervalMs`: Polling frequency in milliseconds (default: 5000)
- `children`: React children to render within the provider

### `useCommitmentStatus`
A custom hook to consume the commitment status context from any descendant component. It returns:
- `status`: The `CommitmentStatus` object (or `null` if not yet loaded)
- `isLoading`: Loading state indicator
- `error`: Error string (or `null`)
- `refreshStatus`: Function to manually trigger a status refresh

### `CommitmentStatus` Interface
Matches the API response schema from `/api/commitments/[id]/status`:
```typescript
interface CommitmentStatus {
  commitmentId: string;
  status: string;
  daysRemaining: number;
  complianceScore: number;
  currentValue: string;
  violationCount: number;
  expiresAt: string | null;
}
```

## Usage

### Adding to a Page
Wrap the commitment detail page with `CommitmentStatusProvider`:
```tsx
import { CommitmentStatusProvider } from '@/context/CommitmentStatusContext';

function CommitmentDetailPage({ params: { id } }: { params: { id: string } }) {
  return (
    <CommitmentStatusProvider commitmentId={id}>
      {/* page content */}
    </CommitmentStatusProvider>
  );
}
```

### Consuming Status in Components
Use the `useCommitmentStatus` hook in child components:
```tsx
import { useCommitmentStatus } from '@/context/CommitmentStatusContext';

function StatusBadge() {
  const { status, isLoading } = useCommitmentStatus();
  if (isLoading || !status) return <span>Loading...</span>;
  return <span>{status.status}</span>;
}
```

## Features
- **Single Polling Source**: Avoids duplicate API calls across components
- **Visibility Handling**: Pauses polling when the page is hidden; resumes when visible
- **Error Handling**: Gracefully handles API failures and exposes error state
- **Manual Refresh**: Provides a `refreshStatus` function to manually refetch status
- **Configurable Polling**: Allows setting custom polling intervals

## Files Modified/Added
- `src/context/CommitmentStatusContext.tsx`: New context provider and hook
- `src/context/__tests__/CommitmentStatusContext.test.tsx`: Tests for the context
- `src/app/commitments/[id]/page.tsx`: Wrapped page and updated components to use the context
- `docs/COMMITMENT_STATUS_CONTEXT.md`: This documentation
