# Accessibility: Landmarks and Headings

This document outlines the standard accessible layout structure used across the CommitLabs Frontend. Maintaining this structure is critical for screen reader compatibility, keyboard navigation, and SEO.

## Landmarks Structure

Every page template and layout MUST use semantic HTML5 landmarks to define the page's structure.

- **`<header>`**: Used for the primary top-level application shell and navigation banner.
- **`<nav>`**: Used for navigation links within the header (`id="primary-navigation"`) and footer.
- **`<main id="main-content">`**: The primary wrapper for the unique content of the route. 
  - **Requirement:** Every single page must have exactly one `<main id="main-content">` tag.
  - **Why:** The application layout includes a `<a href="#main-content" className="skip-link">` that allows keyboard users and screen readers to bypass repetitive navigation links. If the target `id="main-content"` is missing, the skip link breaks.
- **`<footer>`**: Used for the bottom site footer.

### Example Layout

```tsx
import { AppShellLayout } from '@/components/shell/AppShellLayout'

export default function MyPage() {
  return (
    <AppShellLayout>
      <main id="main-content" className="...">
        {/* Page specific content goes here */}
      </main>
    </AppShellLayout>
  )
}
```

## Heading Hierarchy

We enforce a strict, logically nested heading hierarchy on all pages. 

- **Single `<h1>` Rule**: Every page must have **exactly one** `<h1>` tag that describes the primary topic or purpose of the page.
- **Logical Nesting**: Headings must not skip levels (e.g., do not jump from an `<h1>` to an `<h3>`). Use `<h2>` for major sections, `<h3>` for subsections, and so forth.
- **Wizard/Multi-Step Components**: If a page uses multiple sub-components that are mutually exclusive (only one is rendered at a time, like a multi-step form), it is acceptable for each sub-component to have an `<h1>`, as long as only one is mounted in the DOM at any given time.

### Why it Matters

Screen reader users often use keyboard shortcuts to list all headings on a page to understand its structure and quickly jump between sections. Multiple `<h1>`s or skipped heading levels break this mental model.
