# Error Pages Documentation

This project includes comprehensive, user-friendly error pages for various error scenarios. All error pages follow the same design system with responsive layouts and clear call-to-action buttons.

## Available Error Pages

### 1. **404 Not Found Page** (`/not-found`)
- **File**: `src/app/not-found.tsx`
- **Styling**: `src/app/not-found.module.css`
- **Purpose**: Displayed when users navigate to a non-existent page
- **Features**:
  - Large "404" display
  - Search bar for site navigation
  - "Go Home" button
  - "Go Back" button to return to previous page
  - SVG error icon

**How it's triggered**:
- Next.js automatically shows this page for non-existent routes
- No additional configuration needed

---

### 2. **500 Server Error Page** (`/error`)
- **File**: `src/app/error.tsx`
- **Styling**: `src/app/error.module.css`
- **Purpose**: Displayed when server-side errors occur
- **Features**:
  - Large "500" display
  - Error message and details display
  - Error ID/digest for support
  - "Try Again" button (resets the component)
  - "Go Home" button
  - "Report Issue" link

**How it's triggered**:
- Next.js automatically catches errors and displays this page
- Wrap components with error boundaries as needed

---

### 3. **Network Error Page** (`/network-error`)
- **File**: `src/app/network-error/page.tsx`
- **Styling**: `src/app/network-error/page.module.css`
- **Purpose**: Manual route for network connectivity issues
- **Features**:
  - Connection error message
  - Network troubleshooting checklist:
    - Check internet connection
    - Disable VPN/proxy
    - Restart router
    - Check other websites
    - Clear cache and cookies
  - Live connection status indicator with animated dot
  - "Retry" button (checks connectivity)
  - "Go Home" button

**How to use it**:
```tsx
// Navigate users here when network errors occur
import { useRouter } from 'next/navigation'

const router = useRouter()

try {
  await fetchData()
} catch (error) {
  router.push('/network-error')
}
```

---

### 4. **Transaction Error Page** (`/transaction-error`)
- **File**: `src/app/transaction-error/page.tsx`
- **Styling**: `src/app/transaction-error/page.module.css`
- **Purpose**: Display blockchain/transaction-specific errors
- **Features**:
  - Custom error messages (via URL params)
  - Transaction hash display with copy button
  - Error code display
  - Troubleshooting tips:
    - Insufficient balance
    - Network congestion
    - Invalid parameters
    - Wallet/signature issues
    - Contract execution failures
  - "Try Again" button
  - "Go Home" button
  - "View on Explorer" link (links to Stellar Expert)
  - "Contact Support" link

**How to use it**:
```tsx
// Navigate with transaction details
router.push(
  `/transaction-error?message=Transaction failed&hash=abc123def456&code=INSUFFICIENT_BALANCE`
)

// URL Parameters:
// - message: Error message to display
// - hash: Transaction hash (optional)
// - code: Error code (optional)
```

---

## Shared Components

### ErrorLayout (`src/components/ErrorLayout.tsx`)
Wrapper component that provides consistent page structure and styling for all error pages.

```tsx
import ErrorLayout from '@/components/ErrorLayout'

export default function MyErrorPage() {
  return (
    <ErrorLayout>
      {/* Your error content */}
    </ErrorLayout>
  )
}
```

### ErrorButton (`src/components/ErrorButton.tsx`)
Reusable button component for error pages with multiple variants.

```tsx
import ErrorButton from '@/components/ErrorButton'

// As a link
<ErrorButton href="/">Go Home</ErrorButton>

// As a secondary button
<ErrorButton href="/back" variant="secondary">Back</ErrorButton>

// As a button with click handler
<ErrorButton onClick={handleClick}>Try Again</ErrorButton>

// As an external link
<ErrorButton href="https://example.com" isExternal>
  External Link
</ErrorButton>

// Disabled state
<ErrorButton disabled>Disabled Button</ErrorButton>
```

---

## Design System

### Colors
- **Background**: Purple gradient (`#667eea` to `#764ba2`)
- **Text**: White
- **Primary Button**: White with purple text
- **Secondary Button**: Transparent white with border

### Typography
- **Error Code**: 6rem, 900 weight (4rem on mobile)
- **Title**: 2.5rem, 700 weight (2rem on mobile)
- **Description**: 1.1rem, 0.85 opacity (1rem on mobile)

### Spacing
- Container max-width: 600px
- Padding: 2rem (1.5rem on mobile)
- Gap between elements: 1-2rem

### Responsive Design
- Full-width padding on mobile
- Stacked buttons on screens < 640px
- Touch-friendly tap targets (min 44px)
- Adjusted font sizes for mobile readability

---

## Animations

All error pages include smooth entrance animations:
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Status indicators (like network connection) have pulsing animations for visual feedback.

---

## Using Error Pages in Your Application

### 1. Redirect to Network Error
```tsx
import { useRouter } from 'next/navigation'

export default function MyComponent() {
  const router = useRouter()

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed to fetch')
    } catch (error) {
      router.push('/network-error')
    }
  }

  return <button onClick={fetchData}>Load Data</button>
}
```

### 2. Redirect to Transaction Error
```tsx
const handleTransaction = async () => {
  try {
    const result = await submitTransaction(data)
  } catch (error) {
    const message = error.message || 'Transaction failed'
    const hash = error.txHash || ''
    const code = error.code || ''
    
    router.push(
      `/transaction-error?message=${encodeURIComponent(message)}&hash=${hash}&code=${code}`
    )
  }
}
```

### 3. Auto-catch Errors in Layout
The `error.tsx` file at the app level automatically catches and displays errors from any route.

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design works on mobile, tablet, and desktop
- CSS features used: Flexbox, Grid, CSS animations, gradients

---

## Customization

### Change Colors
Edit `src/app/globals.css`:
```css
body {
  background: linear-gradient(135deg, YOUR_COLOR_1 0%, YOUR_COLOR_2 100%);
}
```

### Change Error Messages
Edit the `title` and `description` text in each error page component.

### Add More Error Types
Create a new page directory (e.g., `/rate-limit-error/page.tsx`) and follow the same pattern as the existing error pages.

---

## Testing Error Pages Locally

```bash
# Build and start the production server
npm run build
npm start

# Then navigate to:
# - http://localhost:3000/404 (non-existent page)
# - http://localhost:3000/network-error
# - http://localhost:3000/transaction-error?message=Test&hash=abc123
```

---

## File Structure

```
src/
├── app/
│   ├── error.tsx                          # 500 error page
│   ├── error.module.css
│   ├── not-found.tsx                      # 404 error page
│   ├── not-found.module.css
│   ├── network-error/
│   │   ├── page.tsx
│   │   └── page.module.css
│   └── transaction-error/
│       ├── page.tsx
│       └── page.module.css
└── components/
    ├── ErrorLayout.tsx                    # Shared layout component
    ├── ErrorLayout.module.css
    ├── ErrorButton.tsx                    # Shared button component
    └── ErrorButton.module.css
```

---

## Notes

- All error pages are client-side compatible (using `'use client'`)
- Error pages are fully responsive and mobile-friendly
- SVG icons are inline for better performance
- Animation uses CSS for smooth 60fps performance
- All buttons have proper hover and active states
