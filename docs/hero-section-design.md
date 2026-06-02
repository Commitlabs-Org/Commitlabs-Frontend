# Hero Section Design

## Overview
The landing page hero now features a clear CTA hierarchy:
- **Primary CTA**: "Create commitment" – links to `/create`
- **Secondary CTA**: "Explore marketplace" – links to `/marketplace`

Both buttons follow the color palette and typography defined in **Branding.txt**.

## Accessibility
- Sufficient contrast ratios (primary button uses bright accent, secondary uses dark background with accent border).
- Logical focus order: primary CTA first, then secondary, followed by social icons.
- Semantic heading hierarchy retained.

## Responsive Layout
- Buttons stack vertically on screens < 640 px and appear side‑by‑side on larger viewports.
- Uses Tailwind’s flex utilities for automatic wrapping.

## Implementation Details
- Updated `src/components/landing-page/sections/HeroSection.tsx`
- Added `import Link from "next/link"` and replaced the single button with two `Link` components.
- Updated styling to match branding colors.
