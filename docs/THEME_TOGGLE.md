# Theme Toggle

## Architecture

```
next-themes (0.4.6)
  └─ ThemeProvider (client wrapper in src/components/theme/ThemeProvider.tsx)
       └─ ThemeToggle (src/components/theme/ThemeToggle.tsx)
            └─ useTheme() hook
```

Three layers:
- **Provider** — `next-themes` `<ThemeProvider>` wrapping the app root. Configured with `attribute="data-theme"`, `defaultTheme="system"`, `disableTransitionOnChange`.
- **Toggle** — `'use client'` button cycling through `light → dark → system`. Reads `theme`/`setTheme` from `useTheme()`.
- **Tokens** — CSS custom properties in `:root` (dark) and `[data-theme="light"]` (overrides). Tailwind v4 `@theme` block maps variables to `bg-surface`, `text-text-primary`, etc.

## Provider Flow

```
layout.tsx (server component)
  └─ <ThemeProvider> (client component, wraps <body>)
       └─ <ToastProvider>
            └─ {children}
```

`layout.tsx` is a server component; `ThemeProvider` is `'use client'`. The wrapper is imported directly in layout — Next.js handles the server/client boundary automatically.

`attribute="data-theme"` means toggling sets `<html data-theme="light|dark|system">`. CSS selectors `[data-theme="light"]` override the token values.

## Persistence Mechanism

- `next-themes` writes the chosen theme to `localStorage` under the key `commitlabs-theme` (`storageKey` prop).
- On page load, `next-themes` reads the stored value and applies it before React hydrates.
- `defaultTheme="system"` is used only when no stored value exists (first visit or cleared storage).
- The toggle never reads/writes `localStorage` directly — it calls `setTheme()` which delegates to `next-themes`.

## No-Flash Strategy

`next-themes` injects an inline `<script>` into `<head>` that runs before first paint. The script:

1. Reads `localStorage` for saved theme.
2. Falls back to `prefers-color-scheme` when saved value is `"system"` or absent.
3. Sets `document.documentElement.setAttribute('data-theme', value)` before React hydrates.

This ensures the correct CSS variables are active on the very first frame. Without this, the dark-mode `:root` values would flash before React hydrates and applies the light theme.

`<html suppressHydrationWarning>` prevents React from warning about the server/client `data-theme` attribute mismatch (the server renders without the attribute; the blocking script adds it before hydration).

## Testing Approach

- `next-themes` is mocked at the module level with `vi.mock('next-themes', ...)`.
- `useTheme` returns controlled `{ theme, setTheme, resolvedTheme }` values per test case.
- Tests verify:
  - Correct `aria-label` for each theme state (light/dark/system).
  - `setTheme` is called with the correct next theme on click.
  - Button is focusable and responds to click/keyboard activation.
  - Defensive fallback branches (`theme ?? 'system'`, `labels[current] ?? 'Toggle theme'`).
- The SSR loading state (`mounted=false`) cannot be tested in happy-dom because `useEffect` fires synchronously — this is acceptable since the guard only matters during server rendering.

## Future Extensions

- **Component color migration**: Replace hardcoded `bg-[#0a0a0a]`, `text-white`, `border-white/10` with Tailwind utilities from the `@theme` block (`bg-surface`, `text-text-primary`, `border-border-default`).
- **Theme in settings page**: Add a radio-group or segmented control in `/settings` calling `setTheme()` from the same `useTheme` hook.
- **System preference listener**: Already handled by `next-themes` via `enableSystem` — no extra work needed.
- **CSS Modules migration**: `.module.css` files with hardcoded hex colors need manual conversion to `var(--*)` references.
- **Reduced-motion consideration**: `disableTransitionOnChange` prevents jarring CSS transitions during theme swaps.
