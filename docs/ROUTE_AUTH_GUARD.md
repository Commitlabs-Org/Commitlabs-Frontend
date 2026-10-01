# Route Authentication Guard

## Overview

The wallet authentication guard ensures that users must have a connected wallet to access protected routes.

## Implementation

### Components

#### RequireWallet

The `RequireWallet` component handles wallet connection status:

```tsx
import { RequireWallet } from '@/components/auth/RequireWallet';

function MyPage() {
  return (
    <RequireWallet redirectTo="/">
      <div>Protected content</div>
    </RequireWallet>
  );
}
import { ProtectedRouteLayout } from '@/components/auth/ProtectedRouteLayout';

export default function Layout({ children }) {
  return <ProtectedRouteLayout>{children}</ProtectedRouteLayout>;
}
import { ProtectedRouteLayout } from '@/components/auth/ProtectedRouteLayout';

export default function Layout({ children }) {
  return <ProtectedRouteLayout redirectTo="/">{children}</ProtectedRouteLayout>;
}
```
