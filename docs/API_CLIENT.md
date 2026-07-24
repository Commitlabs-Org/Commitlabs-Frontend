# Typed frontend API client

## Overview

The frontend now has a shared API client layer for requests that use the standardized success/error envelope returned by the Next.js API routes.

### What it provides

- A single request path for parsing backend envelopes into typed UI data.
- Normalized client-side errors with friendly messages for common cases.
- A hook layer for data-fetching components that exposes `data`, `error`, and `loading` state.
- Abort support for request cancellation and unmount safety.

## Usage

### Low-level client

```ts
import { apiRequest } from '@/lib/client/apiClient';

const data = await apiRequest<MyResponse>('/api/marketplace/stats', { method: 'GET' });
```

### React hook

```ts
import { useApi } from '@/hooks/useApi';

const { data, error, loading } = useApi((signal) =>
  apiRequest('/api/notifications', { method: 'GET', signal }),
);
```

## Error handling

Errors are normalized into `ApiClientError`, which exposes:

- `code`
- `message`
- `status`
- `details`
- `retryAfterSeconds`
- `correlationId`

Known error families such as network failures, timeouts, and not-found responses are converted into friendly messages automatically.

## Migrated call sites

- Marketplace stats loading in the marketplace header.
- Notification test submission in the notification hook.
