# Error Boundary

## Overview

The `ErrorBoundary` component provides a reusable way to catch JavaScript errors in component trees, log them, and display a friendly fallback UI with recovery actions. It prevents component-level failures from crashing the entire route.

## Features

- **Error Containment**: Catches errors in child components and prevents them from crashing the entire application
- **Error Logging**: Logs errors to console (client-side) following the existing logger pattern
- **Friendly Fallback UI**: Uses `ErrorLayout` for consistent error presentation
- **Recovery Actions**: 
  - "Try Again" button to reset the error state and re-render the component
  - "Report Issue" button linking to Discord for support
- **Accessibility**: Automatically focuses the "Try Again" button when an error occurs
- **Programmatic Reset**: Supports `resetKeys` prop for programmatic error state resets
- **Custom Fallback**: Optional custom fallback UI for specialized error handling
- **HOC Support**: Includes `withErrorBoundary` higher-order component for easier wrapping

## Usage

### Basic Usage

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary>
      <RiskProneComponent />
    </ErrorBoundary>
  );
}
```

### With Custom Error Handler

```tsx
function MyComponent() {
  const handleError = (error: Error, errorInfo: ErrorInfo) => {
    // Custom error handling (e.g., send to analytics)
    console.error('Custom error handler:', error, errorInfo);
  };

  return (
    <ErrorBoundary onError={handleError}>
      <RiskProneComponent />
    </ErrorBoundary>
  );
}
```

### With Custom Fallback

```tsx
function MyComponent() {
  const customFallback = (
    <div className="custom-error">
      <h2>Custom Error Message</h2>
      <button onClick={() => window.location.reload()}>Refresh Page</button>
    </div>
  );

  return (
    <ErrorBoundary fallback={customFallback}>
      <RiskProneComponent />
    </ErrorBoundary>
  );
}
```

### With Reset Keys

```tsx
function MyComponent({ userId }: { userId: string }) {
  return (
    <ErrorBoundary resetKeys={[userId]}>
      <UserProfile userId={userId} />
    </ErrorBoundary>
  );
}
```

### Using the HOC

```tsx
import { withErrorBoundary } from '@/components/ErrorBoundary';

const SafeComponent = withErrorBoundary(RiskProneComponent, {
  onError: (error, errorInfo) => {
    // Custom error handling
  },
});

function MyComponent() {
  return <SafeComponent />;
}
```

## Current Implementations

The ErrorBoundary is currently wrapping the following risk-prone components:

1. **CommitmentHealthMetrics** - Health metrics charts in commitment detail page
   - Location: `src/app/commitments/[id]/page.tsx`
   - Risk: Dynamic chart rendering with data visualization

2. **MarketplaceGrid** - Marketplace listings grid
   - Location: `src/app/marketplace/page.tsx`
   - Risk: Card rendering with dynamic data

3. **MarketplaceListView** - Marketplace list view
   - Location: `src/app/marketplace/page.tsx`
   - Risk: List rendering with dynamic data

## API Reference

### ErrorBoundary Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | Yes | - | Child components to be wrapped |
| `fallback` | `ReactNode` | No | - | Custom fallback UI to display on error |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | No | - | Callback called when an error is caught |
| `resetKeys` | `Array<string \| number>` | No | - | Keys that trigger error reset when changed |

### withErrorBoundary

```tsx
withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P>
```

Wraps a component with ErrorBoundary for easier usage.

## Error Logging

The ErrorBoundary logs errors to the console following the existing client-side logger pattern:

```typescript
console.error('[ErrorBoundary] Caught an error:', error);
console.error('[ErrorBoundary] Error info:', errorInfo);
```

This integrates with the existing logging infrastructure in `src/lib/backend/logger.ts` for consistency.

## Accessibility

- The "Try Again" button is automatically focused when an error occurs
- The fallback UI uses semantic HTML and ARIA attributes
- The "Report Issue" link opens in a new tab with proper security attributes

## Testing

The ErrorBoundary has comprehensive test coverage in `src/components/__tests__/ErrorBoundary.test.tsx`:

- Normal rendering without errors
- Error catching and fallback UI display
- Reset functionality
- Custom error handler callbacks
- Custom fallback UI
- Reset keys functionality
- Update-time error catching
- Discord link verification
- Focus management
- Multiple independent boundaries
- Nested boundaries
- HOC functionality

Run tests with:

```bash
pnpm test -- ErrorBoundary.test.tsx
```

## Best Practices

1. **Wrap Risk-Prone Components**: Use ErrorBoundary around components that:
   - Render complex data visualizations (charts, graphs)
   - Handle dynamic data from APIs
   - Have complex state management
   - Render user-generated content

2. **Granular Boundaries**: Use multiple, focused ErrorBoundaries rather than one large boundary. This allows the rest of the application to continue working when one component fails.

3. **Custom Handlers**: Provide custom `onError` handlers for components that need specialized error tracking or reporting.

4. **Reset Keys**: Use `resetKeys` for components that should reset when specific data changes (e.g., user ID, route parameters).

5. **Testing**: Test error scenarios in your components to ensure ErrorBoundary catches them appropriately.

## Limitations

- ErrorBoundaries only catch errors in the component tree below them
- They do not catch errors in:
  - Event handlers (use try/catch in handlers)
  - Asynchronous code (use try/catch in async functions)
  - Server-side rendering (use Next.js error.tsx for route-level errors)
  - Errors thrown in the ErrorBoundary component itself

## Related Components

- `ErrorLayout` - Shared layout for error pages
- `ErrorButton` - Reusable button component for error recovery actions
- Route-level `error.tsx` - For route-level error handling

## Discord Support

The "Report Issue" button links to the CommitLabs Discord server for community support:
https://discord.gg/WV7tdYkJk
