# StarField — Motion & Cost Decisions

`src/components/landing-page/ui/StarField.tsx`

## What it does

Renders 50 decorative 1 px white dots as a static star-field background on the
landing page (desktop only, hidden below `md` breakpoint).

---

## Accessibility

### `aria-hidden="true"`

The field is purely decorative. Exposing 50 anonymous `<div>` elements to the
accessibility tree would add noise and confuse screen-reader users. Setting
`aria-hidden="true"` on the root removes the entire subtree from the tree.

### `pointer-events-none`

Without this, the overlay could silently absorb click/touch events that should
reach interactive content underneath. The Tailwind class maps to
`pointer-events: none` in CSS, which is zero-cost at runtime.

---

## Motion guard

### Why CSS instead of JS

The Tailwind `motion-safe:` variant compiles to:

```css
@media (prefers-reduced-motion: no-preference) {
  .motion-safe\:animate-pulse { animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
}
```

This means:
- **No JavaScript media-query check** at render time — the browser handles it.
- **SSR-safe**: no `window.matchMedia` call, no hydration mismatch.
- **Zero extra bytes** shipped to users with reduced-motion preference (the
  animation simply never activates).

### What "reduced-motion" users see

Static, fully opaque stars at their authored `opacity` values. No movement, no
flicker, no cognitive load from animation.

### What default-motion users see

A gentle `animate-pulse` (CSS `opacity` keyframe, no layout properties) that
creates a soft twinkle. Because only `opacity` is animated:
- No layout or paint recalculation per frame.
- Runs entirely on the compositor thread.

---

## Render cost

| Concern | Decision |
|---|---|
| Per-frame JS | None — pure CSS animation |
| Layout thrash | None — `opacity` only, compositor-friendly |
| DOM count | 50 static `<div>` elements; painted once, then composited |
| Reflow triggers | None at runtime |
| Star positions | Pre-computed percentage values; no dynamic calculation |

---

## Testing

`src/components/landing-page/__tests__/StarField.test.tsx` covers:

- `aria-hidden="true"` is present on the container
- `pointer-events-none` class is present
- `motion-safe:animate-pulse` class is applied to every star
- Exactly 50 star elements are rendered
- Inline `left`/`top` styles are percentage-based
- Rendering does not access `window.matchMedia` (SSR-safe)
- Component renders without error when `window.matchMedia` is absent
