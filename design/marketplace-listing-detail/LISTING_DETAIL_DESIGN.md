# Marketplace Listing Detail Page Design

## Overview

This document specifies the UI/UX design for the marketplace listing detail page. It provides a comprehensive view of a single commitment available for purchase, including seller verification signals, commitment metrics, and contextual purchase CTAs.

**Scope**: UI/UX design only. No implementation code included.

**Reference**: This design builds on [SellerTrustGuidelines.md](../../docs/SellerTrustGuidelines.md), [FigmaDesign.md](../../docs/design/FigmaDesign.md), and [success-state-ux.md](../../docs/success-state-ux.md).

---

## 1. Design Principles

1. **Trust Before Action**: Display seller verification and reputation prominently above the fold on desktop and near the top on mobile.
2. **Clear Purchase States**: The CTA must reflect the user's eligibility (can purchase, needs wallet, ineligible) in clear, non-accusatory language.
3. **Safe External Navigation**: Blockchain explorer links and external data use proper iconography and helper text to signal user is leaving the product.
4. **Mobile-First Responsiveness**: All states must be tested on mobile (375px viewport).
5. **Contextual Hierarchy**: Primary commitment data (amount, yield, duration) outranks secondary metrics; seller trust outranks transaction details.

---

## 2. Page Structure

### 2.1 Desktop Layout (1024px+)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header Breadcrumb: Marketplace > Commitment #ABC123             │
├─────────────────────────────────────────┬───────────────────────┤
│                                         │                       │
│  COMMITMENT SUMMARY SECTION (Left)      │  SIDEBAR (Right)      │
│  ├─ Type badge (Safe/Balanced/Agg)      │  ├─ Seller Info       │
│  ├─ Commitment ID                       │  │  ├─ Address        │
│  ├─ Asset Details                       │  │  ├─ Trust Badge    │
│  │                                      │  │  └─ Reputation Scr. │
│  ├─ Key Metrics Grid (4 col)            │  │                    │
│  │  ├─ Amount                           │  ├─ Purchase CTA      │
│  │  ├─ Yield                            │  │  (State-aware btn) │
│  │  ├─ Duration                         │  │                    │
│  │  └─ Max Loss                         │  ├─ Transaction Hist  │
│  │                                      │  │  (if applicable)   │
│  ├─ Compliance & Health (if applicable) │  └─ Share & External │
│  │                                      │     Links            │
│  ├─ Attestation History (if exists)     │                       │
│  │                                      │                       │
│  └─ External Explorer Link (safe)       │                       │
└─────────────────────────────────────────┴───────────────────────┘
```

### 2.2 Mobile Layout (375px - 767px)

```
┌──────────────────────────┐
│ Marketplace > #ABC123    │
├──────────────────────────┤
│                          │
│ HERO SECTION             │
│ ├─ Commitment Type Badge │
│ ├─ Amount (large)        │
│ └─ Yield % (highlight)   │
│                          │
│ SELLER TRUST SECTION     │
│ ├─ Seller Address        │
│ ├─ Trust Badge           │
│ ├─ Reputation Score      │
│ └─ Track Record          │
│                          │
│ KEY METRICS (Stacked)    │
│ ├─ Duration              │
│ ├─ Max Loss              │
│ ├─ Health Score          │
│ └─ Compliance            │
│                          │
│ PURCHASE CTA             │
│ (Full-width, state-aware)│
│                          │
│ Attestation History      │
│ (Collapsed by default)   │
│                          │
│ External Links           │
│ (Safe, icon + label)     │
│                          │
└──────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Commitment Summary Section

#### Type Badge

- **Desktop**: Top-left of commitment summary, before content starts.
- **Mobile**: Inside hero section at the very top.
- **States**:
  - `Safe`: Green/teal pill, with icon
  - `Balanced`: Blue pill, with icon
  - `Aggressive`: Orange/red pill, with icon
- **Copy**: "Safe Commitment", "Balanced Commitment", "Aggressive Commitment"
- **Visual**: Solid background with white text, 10px padding, 20px border-radius

#### Commitment ID

- **Copy**: "Commitment #ABC123" or "Order #ABC123"
- **Typography**: Monospace font, lighter color (secondary)
- **Interaction**: Clicking the ID copies it to clipboard; show success toast.
- **Tooltip on hover**: "Click to copy"

#### Asset Details

- **Layout**: Single row of pill-shaped badges
- **Content**:
  - Asset name (e.g., "Stellar Lumens (XLM)")
  - Network (e.g., "Testnet" / "Mainnet") with network indicator dot
- **Visual**: Light border, no background fill on mobile; subtle background on desktop

#### Key Metrics Grid

**Desktop**: 4-column grid

| Metric       | Label          | Format       | Color Rule      |
| ------------ | -------------- | ------------ | --------------- |
| Amount       | Amount Locked  | $50,000      | White/primary   |
| Annual Yield | Annualized APY | 5.2%         | Green highlight |
| Duration     | Commitment     | 25 days      | White/secondary |
| Max Loss     | Maximum Loss   | 2% (or 100%) | Red if High     |

**Mobile**: Stacked 2-column layout

- Each metric in a card with label above value
- Amount and Yield in first row (equal width)
- Duration and Max Loss in second row (equal width)
- Light background (bg-white/5) with subtle border

**Special Case - Aggressive Max Loss**:

- If Max Loss = 100%, add warning icon next to the value
- Add helper text below: "This commitment can result in total loss of principal"
- Color: Amber/yellow instead of red

#### Compliance & Health Section (Optional)

- **When to show**: If this data exists in the listing
- **Content**:
  - Health Score (0-100, color-coded)
  - Compliance Status (On-Track / At-Risk / Default)
  - Last attestation timestamp
- **Visual**: Card format with small icon indicators

#### Attestation History (Optional)

- **When to show**: If the commitment has a documented attestation trail
- **Collapsed state** (mobile/default):
  - "View Attestation History (3 events)" as expandable row
  - Chevron icon to indicate expand/collapse
- **Expanded state**:
  - Timeline of events (verified, disputed, settled, etc.)
  - Each event with date, status, and explorer link (external, safe)
  - Maximum 10 events shown; "Load more" if > 10

#### External Explorer Link

- **Placement**: Bottom of commitment summary section on desktop; after all attestations on mobile
- **Format**: Icon + link text + external-link icon
- **Copy**: "View on Stellar Expert" or "View on Explorer"
- **Behavior**:
  - Opens in new tab (target="\_blank")
  - Proper rel="noopener noreferrer" for security
  - 10-12px smaller icon than text for visual hierarchy

---

### 3.2 Seller Information Sidebar (Desktop) / Section (Mobile)

#### Seller Address Card

- **Desktop**: Sticky sidebar, width ~280px
- **Mobile**: Full-width section, collapsed initially (chevron to expand)
- **Content**:
  - "Seller" label (uppercase, 10px, lighter color)
  - Shortened address with copy button (e.g., "0x742d...44e")
  - On click: Copy full address to clipboard, show success toast

#### Trust Badge

- **Type**: Use existing `TrustBadge` component
- **Position**: Directly below seller address
- **Levels**: `verified`, `reputable`, `unverified` (from SellerTrustGuidelines)
- **Behavior**: Hover shows tooltip with trust criteria

#### Reputation Display

- **Component**: Use existing `ReputationDisplay` component
- **Metrics shown**:
  - Score (0-100, color-coded)
  - Total commitments
  - Success rate (%)
- **Visual**: Card with border and subtle background
- **Mobile**: Full-width card below trust badge

#### Verification Details (New Sub-section)

- **Only show if** trust level is `verified` or `reputable`
- **Content**:
  - "Verification Status: ✓ Identity Verified" (if verified)
  - "Last verified: Jan 15, 2026"
  - Link to "View Verification Details" → opens info modal or new tab to trust methodology
- **Modal content** (if clicked):
  - "How We Verify Sellers"
  - KYC criteria checklist
  - Historical performance snippet
  - Close button and "OK, I understand" button

---

### 3.3 Purchase CTA Section

#### CTA Button States

All states use a full-width button on mobile; fixed width on desktop (within sidebar or hero).

##### 3.3.1 Eligible State

- **When**: User is authenticated, has wallet connected, has sufficient balance
- **Button**: Primary color (green/teal), solid
- **Copy**: "Purchase Commitment" or "Buy Now"
- **Secondary Text** (below button): "You have sufficient balance to purchase this commitment"
- **On Click**: Navigate to purchase confirmation flow
- **Disabled**: No (clickable)

##### 3.3.2 Ineligible State

- **When**: User is authenticated, but does not meet purchase criteria (e.g., buyer = seller, commitment not for sale, insufficient data)
- **Button**: Disabled/grayscale, cursor not-allowed
- **Copy**: "Unavailable for Purchase" or specific reason
- **Helper Text** (below button):
  - If buyer = seller: "You cannot purchase your own commitments"
  - If not for sale: "This commitment is not currently available for purchase"
  - If other reason: "This commitment doesn't meet your criteria"
- **Secondary Link**: "Browse other commitments" (text link)

##### 3.3.3 Needs Wallet State

- **When**: User is authenticated but no wallet connected
- **Button**: Primary color (orange/amber), solid
- **Copy**: "Connect Wallet to Purchase"
- **Helper Text**: "Connect your Stellar wallet to proceed with purchase"
- **On Click**: Trigger wallet connection flow (e.g., Freighter modal)
- **Icon**: Wallet icon or chain icon on the left of the button text

##### 3.3.4 Unauthenticated State

- **When**: User is not logged in
- **Button**: Secondary color, solid
- **Copy**: "Sign In to Purchase"
- **Helper Text**: "Create an account or sign in to buy commitments"
- **On Click**: Navigate to login/signup
- **Icon**: User icon or login icon

#### CTA Secondary Actions

- **Below the primary CTA button** (mobile) or **to the right in a compact row** (desktop):
  - "Share this listing" (secondary button, outline style)
  - "Save for later" (icon button, heart icon)
- **On Share Click**: Show native share sheet (mobile) or copy link + toast (desktop)
- **On Save Click**: Toggle heart icon, save to "Watchlist", show toast confirmation

#### Trust Disclaimer

- **Placement**: Below all CTA buttons and secondary actions
- **Visual**: Light background card, subtle border, no more than 2 lines
- **Copy**: "Verification indicators are based on historical platform data and external identity checks. They do not constitute financial advice or a guarantee of future performance."
- **Font**: 11px, lighter color, 1.4 line-height
- **Link**: "Learn more" in the text, links to trust methodology page (external, safe)

---

## 4. Loading State

### Desktop

- **Placeholder sections**:
  - Type badge: Gray skeleton pill (80px wide, 24px tall)
  - Commitment ID: Gray skeleton text (120px wide, 16px tall)
  - Key metrics grid: 4 skeleton cards (each 150px x 100px) with pulsing animation
  - Seller address: Skeleton text (100px wide)
  - CTA button: Gray skeleton button (full width, 44px tall)
- **Animation**: Gentle pulsing effect (opacity 0.5 → 1.0, 1.5s cycle)
- **No spinners or loaders**: Use only skeleton placeholders for seamless UX

### Mobile

- Same as desktop but in mobile layout
- Key metrics stacked vertically
- CTA button full-width
- Ensure no layout shift as real content loads

### Timing Hints

- Skeletons should show for minimum 300ms and maximum 3s
- If loading exceeds 3s, show subtle "Loading..." text overlay

---

## 5. Error State

### Page-Level Error

- **Trigger**: Listing ID not found, network error, permission denied
- **Visual**: Full-page centered error container
- **Content**:
  - Large icon (warning or chain broken)
  - Title: "Listing Not Found" or "Unable to Load"
  - Description: "This commitment may have been delisted or is no longer available."
  - Action buttons:
    - "Browse Marketplace" (primary)
    - "Go Home" (secondary)
    - "Report Issue" (text link)
- **Desktop**: Centered, max-width 400px
- **Mobile**: Full-width, padded container

### Partial Error (Data Load Failure)

- **Trigger**: Commitment data loads, but seller reputation fails; attestation history fails to load
- **Visual**: Section shows partial data + error indicator
- **Content**:
  - Section header with warning icon
  - "Could not load [section name]" message
  - "Retry" button or "Try again" link
  - User can still purchase based on available data
- **Reputation section fails example**:
  - Show seller address and trust badge (if cached)
  - "Seller reputation temporarily unavailable" message
  - "Retry" button
  - CTA remains active but shows additional helper text: "Seller reputation data unavailable. Purchase at your own discretion."

### Network Error Fallback

- If user loses connectivity during page load:
  - Show error card: "Lost Connection"
  - "Check your internet connection and try again"
  - Auto-retry button or manual "Retry" button
  - Preserve any cached data on the page

---

## 6. Mobile-Specific Patterns

### Viewport: 375px - 767px

#### Top Navigation

- Breadcrumb: "Marketplace > #ABC123" (right-aligned if space constrained)
- Back button (← arrow) on left, title in center
- Sticky header with minimal padding (12px vertical)

#### Hero Section (Mobile)

- Commitment type badge at top
- Large amount display: "Amount: $50,000" in 32px font
- Yield below: "5.2% Annualized" in 24px font, highlighted
- All center-aligned

#### Card-Based Layout

- All sections as full-width cards with 16px margin
- Rounded corners (12px)
- Light border (1px white/10)
- 12px padding inside each card

#### CTA Button

- Full-width with 16px margins (so ~327px on 375px viewport)
- Minimum 44px height for touch targets
- No hover states (touch device), but show active/pressed state

#### Sticky Footer CTA (Optional)

- If listing detail page is long:
  - "Floating" CTA button that sticks to bottom (44px height)
  - Stays visible as user scrolls
  - Dismiss button (×) if user wants to hide it
  - Dismissal preference saved to localStorage

#### Collapsed Sections

- Attestation history, Verification Details initially collapsed on mobile
- Tap to expand with smooth animation (150ms)
- Chevron icon rotates to indicate state

---

## 7. Safe External Links

All external links (blockchain explorer, trust methodology, seller external profile) follow these patterns:

### Visual Pattern

- External link icon (↗) placed **after** link text
- Icon color: Matches link color or slightly lighter
- Icon size: 12px (smaller than text)
- No underline by default; underline on hover

### Label Clarity

- Every external link must include destination hint
- Copy examples:
  - "View on Stellar Expert" (not "View on Block Explorer")
  - "Learn more about trust levels" (not just "Learn more")
  - "Seller's external website" (if applicable)

### Interaction Behavior

- target="\_blank"
- rel="noopener noreferrer" (security requirement)
- No automatic opening in modal or iframe
- User must explicitly click to navigate

### Mobile UX

- External links in touch-friendly regions (minimum 44px × 44px)
- If link is inline text, wrap in padding or use button style for mobile
- Example: Instead of small inline link, use "Learn more" as a full-width card on mobile

### Color Treatment

- External links: Slightly desaturated compared to internal navigation links
- On hover: Slight opacity change (opacity 0.8 → 1.0)
- No color shift that could be mistaken for state change

---

## 8. Typography & Color Scales

### Typography Hierarchy

| Element            | Size | Weight | Color         |
| ------------------ | ---- | ------ | ------------- |
| Page title         | 24px | 700    | White         |
| Section headers    | 16px | 600    | White         |
| Metric labels      | 12px | 500    | White/50%     |
| Metric values      | 18px | 700    | White/90%     |
| Body text          | 14px | 400    | White/70%     |
| Helper/hint text   | 12px | 400    | White/50%     |
| Button text        | 14px | 600    | White/primary |
| External link text | 14px | 500    | Link color    |

### Color Tokens

- **Primary (CTA)**: `#00C950` (green)
- **Warning**: `#FF8904` (orange)
- **Error**: `#FF4757` (red)
- **Success**: `#00C950` (green)
- **Info**: `#51A2FF` (blue)
- **Background**: `#000000` (black)
- **Border**: `rgba(255, 255, 255, 0.1)` (white/10)
- **Text Primary**: `rgba(255, 255, 255, 0.9)` (white/90)
- **Text Secondary**: `rgba(255, 255, 255, 0.5)` (white/50)

---

## 9. Accessibility Requirements

### Keyboard Navigation

- All buttons and interactive elements focusable with Tab
- Focus indicators visible (outline or highlight)
- Focus order: top-to-bottom, logical flow
- No keyboard traps

### ARIA Labels

- Seller address copy button: `aria-label="Copy seller address"`
- External links: `aria-label="View on Stellar Expert, opens in new tab"`
- CTA button states: `aria-label="Purchase commitment" or "Sign in to purchase"`
- Expandable sections: `aria-expanded="false" → true` on toggle

### Color Contrast

- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Do not rely on color alone to communicate state
- Use icons, text, or patterns in addition to color

### Screen Reader Support

- Semantic HTML (button, a, section, article)
- Form labels properly associated with inputs
- Breadcrumbs marked with `<nav>`
- Success/error messages announced via ARIA live regions

---

## 10. Testing Checklist

### Desktop Testing (1024px+)

- [ ] All metrics display correctly in 4-column grid
- [ ] Sidebar remains sticky on scroll (if implemented)
- [ ] Hover states work on CTA button
- [ ] External links open in new tab and are visually distinguished
- [ ] Seller reputation component renders without overflow
- [ ] Loading skeleton pulses smoothly

### Mobile Testing (375px)

- [ ] Hero section amounts are readable at 375px width
- [ ] Full-width CTA button has 16px margins
- [ ] Trust badge doesn't overflow on narrow viewport
- [ ] Key metrics stack in 2-column layout, not wrapping
- [ ] Attestation history collapses/expands smoothly
- [ ] Touch targets are minimum 44px × 44px

### Tablet Testing (768px)

- [ ] Layout adapts smoothly between mobile and desktop
- [ ] No awkward gaps or overflow at 768px breakpoint
- [ ] Sidebar transitions from full-width to side-by-side layout

### State Testing

- [ ] Eligible state CTA is clickable and navigates to purchase
- [ ] Ineligible state shows correct reason and is disabled
- [ ] Needs wallet state shows wallet connection prompt
- [ ] Unauthenticated state shows sign-in prompt
- [ ] Loading state shows for minimum 300ms, maximum 3s
- [ ] Error state shows actionable recovery options
- [ ] Success toast appears on address copy

### Readability & UX Testing

- [ ] Trust signals are visible above the fold on desktop
- [ ] CTA is primary focal point without overshadowing listing
- [ ] Helper text is concise and non-alarming
- [ ] Ineligible reason is clear without making user feel blamed
- [ ] External links are obviously external (icon + label)

### QA Sign-Off Gates

1. All CTAs clear and unambiguous
2. Trust signals prominent and trustworthy
3. Error messages guide user to resolution
4. No layout shift on state transitions
5. External links safe and properly labeled

---

## 11. Reference Components

These components are already built and can be reused:

- `TrustBadge.tsx`: Displays verified/reputable/unverified status
- `ReputationDisplay.tsx`: Shows reputation score, total commitments, success rate
- `MarketplaceCard.tsx`: Existing card pattern for listings
- Error layouts: `ErrorLayout.tsx`
- Skeleton: `Skeleton.tsx`, `HealthMetricsSkeleton.tsx`

---

## 12. Suggested File Structure

When implementing, create the following files:

```
src/
├── app/
│   └── marketplace/
│       └── [id]/
│           ├── page.tsx                    # Main listing detail page
│           ├── page.module.css             # Page-specific styles
│           └── components/
│               ├── ListingDetailHeader.tsx
│               ├── CommitmentSummary.tsx
│               ├── SellerInfoSection.tsx
│               ├── PurchaseCtaSection.tsx
│               ├── AttestationHistorySection.tsx
│               ├── ListingDetailSkeleton.tsx
│               └── ListingDetailError.tsx
├── types/
│   └── listingDetail.ts                    # TypeScript interfaces
└── components/
    └── listing-detail/
        ├── ListingDetailCard.tsx           # Reusable card for summaries
        └── ExternalLinkBadge.tsx           # Reusable external link pattern
```

---

## 13. Notes for Implementers

1. **Do Not Import Yet**: This is design-only. No component implementation.
2. **Establish Pattern First**: Create design system tokens/CSS variables for colors and spacing before building components.
3. **Mobile-First Build**: Start with mobile CSS, then add desktop layouts with media queries.
4. **Reuse Existing Components**: Always check if `TrustBadge`, `ReputationDisplay`, and error layouts can be extended rather than rebuilding.
5. **Test Early**: As soon as loading and error states are scaffolded, test in multiple browsers and viewports.
6. **Commit Message**: Follow the pattern:
   ```
   docs: design marketplace listing detail UX with trust signals and purchase state patterns
   ```

---

## 14. Handoff Summary

This design specification covers:

- ✅ Desktop and mobile layouts
- ✅ All CTA states (eligible, ineligible, needs wallet, unauthenticated)
- ✅ Loading and error states
- ✅ Safe external link patterns
- ✅ Seller trust signals and verification display
- ✅ Commitment summary with key metrics
- ✅ Accessibility and keyboard navigation requirements
- ✅ Testing checklist for QA
- ✅ Component reuse guidance

**Not Included** (for future work):

- Backend API contract for listing detail endpoint
- Real data integration
- Wallet connection flow specifics
- Purchase confirmation modal/flow

---

## 15. Related Documentation

- [SellerTrustGuidelines.md](../../docs/SellerTrustGuidelines.md) — Trust badge and reputation display standards
- [FigmaDesign.md](../../docs/design/FigmaDesign.md) — Success state UX patterns (relevant for post-purchase states)
- [ERROR_PAGES_README.md](../../docs/error-pages/ERROR_PAGES_README.md) — Error page patterns and recovery flows
- [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) — Coding standards and component patterns
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System architecture and data flow

---

**Status**: ✅ Design Specification Complete  
**Date**: 2026-02-28  
**Approval**: Ready for implementation review
