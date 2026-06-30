# Notifications Center

## Overview

The Notifications Center provides users with a durable, filterable inbox for all protocol events including violation alerts, expiry warnings, and marketplace events. This feature allows users to review their complete notification history, mark items as read/unread, and navigate to related commitments or listings.

## Features

### Core Functionality

- **Durable Inbox**: Full history of user notifications fetched from `/api/notifications`
- **Category Filtering**: Filter notifications by type (All, Expiry, Violations, Health, Marketplace)
- **Read/Unread State**: Local tracking of read state with persistence via user preferences API
- **Deep Links**: Each notification links to the relevant commitment or listing
- **Responsive Design**: Works across desktop and mobile devices

### Notification Types

| Type | Description | Severity |
|------|-------------|----------|
| `expiry` | Commitment nearing expiry warning | warning |
| `violation` | Commitment violation or attestation failure | critical |
| `health_check` | Health check warnings from attestations | warning |
| `marketplace` | Marketplace events (listings sold, purchased, etc.) | info |

### UI States

- **Loading**: Skeleton loading state while fetching notifications
- **Empty**: Friendly message when no notifications exist
- **Error**: Error layout with message when fetch fails
- **Success**: Full notification list with filtering and actions

## Architecture

### File Structure

```
src/
├── app/
│   └── notifications/
│       ├── layout.tsx          # Page layout with metadata
│       └── page.tsx             # Main page component with data fetching
├── components/
│   └── notifications/
│       ├── NotificationList.tsx # Main list component with filtering
│       └── NotificationList.test.tsx # RTL tests
└── lib/
    └── types/
        └── domain.ts            # Notification type definitions
```

### Data Flow

1. **Page Component** (`page.tsx`):
   - Fetches notifications from `/api/notifications?ownerAddress={address}`
   - Manages local read state
   - Persists read state to `/api/user/preferences`
   - Passes data to `NotificationList`

2. **NotificationList Component**:
   - Renders notification cards with category filtering
   - Handles mark read/unread actions
   - Navigates to related entities on click
   - Shows loading, error, and empty states

3. **API Integration**:
   - `GET /api/notifications`: Fetch user notifications with pagination
   - `PUT /api/user/preferences`: Persist last-seen timestamp

### Type Definitions

```typescript
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export type NotificationType = 'expiry' | 'violation' | 'health_check' | 'marketplace';

export interface Notification {
  id: string;
  ownerAddress: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  relatedCommitmentId?: string;
  relatedListingId?: string;
}
```

## Usage

### Accessing the Notifications Center

Users can access the notifications center at `/notifications`. The page requires authentication via wallet connection.

### Filtering Notifications

Click on category tabs to filter notifications:
- **All**: Shows all notifications
- **Expiry**: Only expiry warnings
- **Violations**: Only violation alerts
- **Health**: Only health check warnings
- **Marketplace**: Only marketplace events

Each tab shows a count badge with the number of notifications in that category.

### Marking Read/Unread

- **Mark as Read**: Click "Mark read" button on unread notifications
- **Mark as Unread**: Click "Mark unread" button on read notifications
- Read state is persisted to user preferences API

### Navigating to Related Entities

Click on any notification card to navigate to:
- Commitment details page (`/commitments/{id}`) for commitment-related notifications
- Marketplace with listing filter (`/marketplace?listing={id}`) for marketplace notifications

## Testing

### Test Coverage

The `NotificationList` component has comprehensive RTL tests covering:

- Rendering notifications correctly
- Empty state display
- Loading skeleton state
- Error state display
- Category filtering
- Category count badges
- Mark read/unread actions
- Unread indicator display
- Severity color coding
- "All caught up" message
- Keyboard navigation
- Timestamp display
- View details hints

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Test File

`src/components/notifications/NotificationList.test.tsx`

## API Integration

### Fetching Notifications

```typescript
const params = new URLSearchParams({
  ownerAddress: address,
  page: '1',
  pageSize: '50',
});

const response = await fetch(`/api/notifications?${params.toString()}`);
const data = await response.json();
const notifications = data.data?.items || data.items || [];
```

### Persisting Read State

```typescript
const updatedPrefs = {
  ...currentPrefs,
  lastSeenNotification: new Date().toISOString(),
};

await fetch('/api/user/preferences', {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(updatedPrefs),
});
```

## Accessibility

- **Keyboard Navigation**: Notification cards are keyboard accessible with Enter/Space keys
- **ARIA Labels**: Proper ARIA labels on interactive elements
- **Focus Management**: Visible focus states for keyboard users
- **Screen Reader Support**: Semantic HTML and descriptive labels

## Styling

The notifications center uses the existing design system:
- Dark theme with `[#0a0a0a]` background
- Cyan accent color `[#0FF0FC]` for active states and unread indicators
- Severity-based color coding (red for critical, yellow for warning, blue for info)
- Consistent spacing and rounded corners matching other pages

## Future Enhancements

Potential improvements for future iterations:

- **Real-time Updates**: WebSocket integration for live notification updates
- **Bulk Actions**: Mark all as read, delete all notifications
- **Notification Settings**: Per-category notification preferences
- **Search**: Full-text search across notifications
- **Export**: Export notification history as CSV
- **Push Notifications**: Browser push notifications for critical alerts

## Troubleshooting

### Notifications Not Loading

- Verify wallet is connected and authenticated
- Check browser console for API errors
- Ensure `/api/notifications` endpoint is accessible
- Verify ownerAddress is being passed correctly

### Read State Not Persisting

- Check that session token is valid
- Verify `/api/user/preferences` endpoint is accessible
- Check browser console for PUT request errors
- Ensure user preferences API is properly configured

### Category Filtering Not Working

- Verify notification types match expected values
- Check that type field is present on all notifications
- Ensure filter state is being updated correctly

## Related Documentation

- [API Reference](./backend-api-reference.md)
- [User Preferences](../src/lib/backend/preferences.ts)
- [Notification Service](../src/lib/backend/services/notifications.ts)
- [Testing Guide](./DEVELOPER_GUIDE.md#testing)
