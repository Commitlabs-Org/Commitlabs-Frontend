# Skeleton Loading Patterns for Lists and Charts

## Overview

This document defines the skeleton loading patterns implemented to reduce perceived latency in the Commitlabs frontend. Skeleton loading provides a visual placeholder that mimics the layout of content while it loads, improving user experience by showing progress and reducing layout shift.

## Components Created

### 1. Base Skeleton Component (`src/components/Skeleton.tsx`)

The foundation component with the following features:

- **Reduced Motion Support**: Automatically detects `prefers-reduced-motion` media query and disables animations for users with motion sensitivity
- **Shimmer Effect**: Subtle gradient animation that indicates loading (disabled when reduced motion is preferred)
- **Accessibility**: Includes `aria-label="Loading content"` and `role="status"` for screen readers
- **Customizable**: Supports width, height, border radius, and shimmer toggling

### 2. Commitment List Skeleton (`src/components/MyCommitmentsGridSkeleton.tsx`)

Skeleton for the commitments list page showing:
- Stats section skeleton (4 cards)
- Filters section skeleton
- Commitment cards grid (6 cards by default)

### 3. Marketplace Skeleton (`src/components/MarketplaceGridSkeleton.tsx`)

Skeleton for the marketplace page showing:
- Results count skeleton
- Marketplace cards grid (6 cards by default)

### 4. Health Charts Skeleton (`src/components/HealthMetricsSkeleton.tsx`)

Skeleton for health metrics charts showing:
- Chart tabs skeleton
- Chart area with grid lines and axes
- Additional metrics cards

## Integration Points

### Commitments Page (`src/app/commitments/page.tsx`)
- Added loading state (`isLoading`)
- Shows `MyCommitmentsGridSkeleton` while loading
- Loading simulates 1-second delay (configurable)

### Marketplace Page (`src/app/marketplace/page.tsx`)
- Added loading state (`isLoading`)
- Shows `MarketplaceGridSkeleton` while loading
- Loading simulates 1.5-second delay (configurable)

## Accessibility Considerations

### 1. Reduced Motion Support
- All skeleton animations respect `prefers-reduced-motion` media query
- When reduced motion is preferred, static gradients replace shimmer animations
- Implemented via `window.matchMedia('(prefers-reduced-motion: reduce)')`

### 2. Screen Reader Support
- Each skeleton has `aria-label="Loading content"` and `role="status"`
- Parent components include descriptive aria-labels:
  - `aria-label="Loading commitments"`
  - `aria-label="Loading marketplace listings"`
  - `aria-label="Loading health metrics"`

### 3. Color Contrast
- Skeleton colors (`#1a1a1a`, `#222`, `#252525`) provide sufficient contrast against dark background (`#0a0a0a`)
- Shimmer effect uses low opacity (`rgba(255,255,255,0.05)`) to avoid visual discomfort

## Animation Details

### Shimmer Animation
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
  }
}
```

### Timing Guidelines
- **Commitments List**: 1-second simulated loading
- **Marketplace**: 1.5-second simulated loading  
- **Health Charts**: Can be integrated similarly when async data loading is implemented

## Usage Guidelines

### When to Use Skeleton Loading
1. **Initial page load** - When fetching data from API
2. **Filter/sort operations** - When results are being refetched
3. **Tab switching** - When loading new chart data

### When Not to Use Skeleton Loading
1. **Instantaneous operations** (< 200ms)
2. **Partial updates** - Use optimistic updates instead
3. **Form submissions** - Use button loading states

## Implementation Example

```tsx
// 1. Add loading state
const [isLoading, setIsLoading] = useState(true);

// 2. Set loading false when data loads
useEffect(() => {
  fetchData().then(() => setIsLoading(false));
}, []);

// 3. Conditionally render skeleton
return (
  <div>
    {isLoading ? (
      <MyCommitmentsGridSkeleton />
    ) : (
      <MyCommitmentsGrid commitments={data} />
    )}
  </div>
);
```

## Future Improvements

1. **Progressive Loading**: Load stats first, then cards
2. **Pagination Skeletons**: Skeleton for pagination controls
3. **Chart-specific Skeletons**: More detailed chart skeletons for different chart types
4. **Performance Monitoring**: Track loading times to optimize skeleton duration

## Testing

### Manual Testing Checklist
- [ ] Skeleton appears during loading
- [ ] Content replaces skeleton when loaded
- [ ] Reduced motion preference disables animations
- [ ] Screen readers announce loading state
- [ ] No layout shift when skeleton transitions to content

### Automated Testing
Consider adding tests for:
- Skeleton component rendering
- Reduced motion detection
- Accessibility attributes
- Integration with loading states

## Commit Message

```
docs: define skeleton loading UX patterns for lists and charts to improve perceived performance

- Created base Skeleton component with reduced motion support
- Implemented skeletons for commitments list, marketplace, and health charts
- Integrated skeleton loading into commitments and marketplace pages
- Added accessibility features and documentation
- Follows UI/UX guidelines for loading states