# App Shell Sidebar Navigation

## Overview

The App Shell Sidebar provides a persistent, collapsible navigation interface for authenticated routes in the CommitLabs application. It replaces the marketing-focused top navigation bar with a dedicated app navigation surface, improving usability and providing clear visual distinction between the landing page and the authenticated application.

## Features

### Core Functionality

- **Persistent Navigation**: Always visible on authenticated routes (`/marketplace`, `/create`, `/commitments`, `/settings`)
- **Active Route Highlighting**: Automatically highlights the current page using Next.js `usePathname`
- **Global Search**: Inline debounced search input (`SidebarSearch`) queries `/api/commitments/search` — see [SIDEBAR_SEARCH.md](./SIDEBAR_SEARCH.md)
- **Collapsible State**: Desktop users can collapse the sidebar to icon-only mode
- **Session Persistence**: Collapsed/expanded state persists across page navigations using `sessionStorage`
- **Responsive Design**: Automatically converts to a mobile drawer on smaller screens
- **Focus Trap**: Mobile drawer implements proper focus trapping for accessibility
- **Smooth Animations**: Powered by Framer Motion for fluid transitions

### Navigation Items

The sidebar includes the following navigation links:

1. **Home** (`/`) - Return to landing page
2. **Marketplace** (`/marketplace`) - Browse commitment listings
3. **Create** (`/create`) - Create new commitments
4. **Commitments** (`/commitments`) - View your commitments
5. **Settings** (`/settings`) - Manage preferences

## Architecture

### Component Structure

```
src/components/shell/
├── AppSidebar.tsx          # Main sidebar component
├── AppShellLayout.tsx      # Layout wrapper component
├── AppSidebar.test.tsx     # Test suite
└── index.ts                # Barrel exports
```

### Integration Pattern

The sidebar is integrated through the `AppShellLayout` wrapper component, which can be applied to individual page components:

```tsx
import { AppShellLayout } from '@/components/shell/AppShellLayout'

export default function MyPage() {
  return (
    <AppShellLayout>
      {/* Your page content */}
    </AppShellLayout>
  )
}
```

## Component API

### AppSidebar Props

```typescript
interface AppSidebarProps {
  className?: string  // Optional additional CSS classes
}
```

### AppShellLayout Props

```typescript
interface AppShellLayoutProps {
  children: React.ReactNode  // Page content to render
}
```

## Usage Examples

### Basic Integration

```tsx
// src/app/marketplace/page.tsx
'use client'

import { AppShellLayout } from '@/components/shell/AppShellLayout'
import { MarketplaceContent } from '@/components/MarketplaceContent'

export default function MarketplacePage() {
  return (
    <AppShellLayout>
      <div className="min-h-screen bg-[#0a0a0a]">
        <MarketplaceContent />
      </div>
    </AppShellLayout>
  )
}
```

### Custom Styling

```tsx
import { AppSidebar } from '@/components/shell/AppSidebar'

export function CustomLayout() {
  return (
    <div className="flex">
      <AppSidebar className="custom-sidebar-styles" />
      <main className="flex-1">
        {/* Content */}
      </main>
    </div>
  )
}
```

## Styling & Theming

### Color Scheme

The sidebar follows the CommitLabs design system:

- **Background**: `#0a0a0a` (Dark background)
- **Border**: `rgba(255, 255, 255, 0.1)` (Subtle white border)
- **Active Link**: `#0FF0FC` (Cyan accent)
- **Inactive Links**: `rgba(255, 255, 255, 0.7)` (Light gray)
- **Hover States**: `rgba(255, 255, 255, 0.05)` (Subtle highlight)

### Responsive Breakpoints

- **Desktop**: Sidebar is always visible, can be collapsed
- **Mobile** (`max-width: 768px`): Sidebar becomes a drawer, triggered by hamburger menu

### Width Values

- **Expanded**: `240px`
- **Collapsed**: `80px`
- **Mobile**: Full width drawer

## Accessibility

### Keyboard Navigation

- **Skip to main content**: First tab stop moves focus directly to the main region
- **Tab**: Navigate through navigation items
- **Escape**: Close mobile drawer
- **Enter/Space**: Activate navigation links

### ARIA Attributes

- `aria-label="Main navigation"` on nav element
- `aria-current="page"` on active navigation item
- `aria-expanded` on collapse toggle button
- `aria-label` on mobile menu buttons

### Focus Management

- App shell routes expose a visually-hidden skip link before the sidebar and a
  focusable `#main-content` landmark target
- Focus trap active in mobile drawer
- First focusable element receives focus when drawer opens
- Focus returns to trigger button when drawer closes

### Screen Reader Support

- Semantic HTML elements (`<nav>`, `<ul>`, `<li>`)
- Clear, descriptive labels for all interactive elements
- Title attributes on icons when sidebar is collapsed

## State Management

### Collapsed State

The sidebar collapse state is managed using React state and persisted to `sessionStorage`:

```typescript
const [isCollapsed, setIsCollapsed] = useState(false)

// Load from sessionStorage on mount
useEffect(() => {
  const stored = sessionStorage.getItem('sidebar-collapsed')
  if (stored !== null) {
    setIsCollapsed(stored === 'true')
  }
}, [])

// Save to sessionStorage on change
useEffect(() => {
  sessionStorage.setItem('sidebar-collapsed', String(isCollapsed))
}, [isCollapsed])
```

### Route Detection

Active route is detected using Next.js `usePathname()`:

```typescript
const pathname = usePathname()

const isActive = (item: NavItem): boolean => {
  if (!item.matchPaths) return pathname === item.href
  return item.matchPaths.some(path => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  })
}
```

## Testing

### Test Coverage

The test suite (`AppSidebar.test.tsx`) covers:

- ✅ Component rendering
- ✅ Active route highlighting
- ✅ Collapse/expand functionality
- ✅ Session persistence
- ✅ Mobile drawer behavior
- ✅ Keyboard navigation
- ✅ Accessibility features
- ✅ Edge cases

### Running Tests

```bash
# Run all tests
pnpm test

# Run sidebar tests specifically
pnpm test AppSidebar

# Run with coverage
pnpm test:coverage
```

### Test Requirements

Minimum 95% test coverage on all new/changed lines.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

- **Animations**: Optimized using Framer Motion with hardware acceleration
- **State Updates**: Minimal re-renders using proper React hooks
- **Session Storage**: Lightweight persistence mechanism
- **Bundle Size**: Tree-shakeable exports, minimal dependencies

## Migration Guide

### From Landing Navigation

If you have pages currently using the landing `Navigation` component:

**Before:**
```tsx
import { Navigation } from '@/components/landing-page/Navigation'

export default function MyPage() {
  return (
    <>
      <Navigation />
      {/* Page content */}
    </>
  )
}
```

**After:**
```tsx
import { AppShellLayout } from '@/components/shell/AppShellLayout'

export default function MyPage() {
  return (
    <AppShellLayout>
      {/* Page content */}
    </AppShellLayout>
  )
}
```

### Styling Adjustments

You may need to adjust your page's top padding since the sidebar doesn't occupy vertical space:

```tsx
// Before: accounting for top navigation
<main className="pt-24 md:pt-32">

// After: reduced padding with sidebar
<main className="pt-8 md:pt-12">
```

## Future Enhancements

Potential improvements for future iterations:

- [ ] User profile section in sidebar
- [ ] Notification badge indicators
- [ ] Configurable navigation items via settings
- [ ] Nested navigation for sub-routes
- [ ] Sidebar position (left/right) preference
- [ ] Quick actions menu
- [ ] Search integration

## Troubleshooting

### Sidebar Not Appearing

**Issue**: Sidebar doesn't render on authenticated routes.

**Solution**: Ensure `AppShellLayout` wrapper is applied to the page component.

### Collapse State Not Persisting

**Issue**: Collapsed state resets on page navigation.

**Solution**: Verify `sessionStorage` is available and not blocked by browser settings.

### Mobile Drawer Stuck Open

**Issue**: Mobile drawer doesn't close on navigation.

**Solution**: Check that route changes are properly detected via `usePathname()` hook.

### Active Route Not Highlighting

**Issue**: Current page doesn't show active styling.

**Solution**: Verify the `matchPaths` array in the `navItems` configuration includes the current route.

## Support & Contribution

For issues, feature requests, or contributions, please refer to the main project repository and contribution guidelines.

## License

This component is part of the CommitLabs frontend application.
