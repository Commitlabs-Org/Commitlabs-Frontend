# Listing Detail Page - Component Specifications

This document provides detailed component APIs, props interfaces, and interaction patterns for the marketplace listing detail page.

---

## 1. Page Component: `ListingDetailPage`

### File Path

`src/app/marketplace/[id]/page.tsx`

### Props

```typescript
interface ListingDetailPageProps {
  params: {
    id: string; // Listing ID from URL
  };
}
```

### State Management

- **Data Fetching**: Use Next.js 14 Server Component with `fetch()` to load listing data
- **Error Handling**: Catch errors and pass to `ListingDetailError` component
- **Loading**: Show `ListingDetailSkeleton` while fetching
- **Client Interactivity**: Wrap interactive sections in `'use client'` sub-components

### Responsibilities

- Fetch listing data from `/api/marketplace/listings/[id]`
- Fetch seller reputation data (may be included in same endpoint)
- Render page layout (header, main content, sidebar on desktop)
- Handle 404 and error states

### Layout Structure

```
<header>           // Breadcrumb + title
<main>             // Two-column flex container
  <section>        // Left: Commitment summary (grows)
  <aside>          // Right: Sidebar (sticky, 280px on desktop; full-width mobile)
</main>
```

---

## 2. Component: `CommitmentSummary`

### File Path

`src/components/listing-detail/CommitmentSummary.tsx`

### Props Interface

```typescript
interface CommitmentSummaryProps {
  listingId: string;
  commitmentType: "Safe" | "Balanced" | "Aggressive";
  amount: string; // Formatted: "$50,000"
  yield: string; // Formatted: "5.2%"
  duration: string; // Formatted: "25 days"
  maxLoss: string; // Formatted: "2%" or "100%"
  assetName: string; // E.g., "Stellar Lumens (XLM)"
  network: "mainnet" | "testnet";
  healthScore?: number; // 0-100, optional
  complianceStatus?: "on-track" | "at-risk" | "default";
  lastAttestation?: Date;
  attestationCount?: number;
}
```

### Subcomponents

1. **CommitmentTypeBadge**
   - Props: `type: 'Safe' | 'Balanced' | 'Aggressive'`
   - Renders: Colored pill with icon and text
2. **CommitmentIdCopy**

   - Props: `id: string`
   - Behavior: Click to copy; show toast confirmation
   - Icon: Copy icon (lucide-react)

3. **AssetDetailsRow**
   - Props: `assetName: string, network: 'mainnet' | 'testnet'`
   - Renders: Inline badge pills for asset and network
4. **KeyMetricsGrid**

   - Props: `{ amount, yield, duration, maxLoss }`
   - Layout: 4-column grid (desktop), 2-column (mobile)
   - Each cell: Label (top) + Value (below)
   - Special: Max Loss shows warning icon if 100%

5. **ComplianceHealthCard** (Optional)

   - Props: `{ healthScore, complianceStatus, lastAttestation }`
   - Renders: Card with health bar, status badge, timestamp

6. **AttestationHistorySection**
   - Props: `{ attestationCount, listingId }`
   - Behavior: Collapsible on mobile, expanded on desktop
   - Content: Timeline of events with external explorer links

### Events/Callbacks

- `onCopyId`: Fired when user copies listing ID
- `onExplorerClick`: Fired when user clicks external link (for analytics)

### Styling

- Use `CommitmentSummary.module.css` for grid and layout
- Use Tailwind for spacing, typography, borders
- Mobile breakpoint: `sm:` (640px)

---

## 3. Component: `SellerInfoSection`

### File Path

`src/components/listing-detail/SellerInfoSection.tsx`

### Props Interface

```typescript
interface SellerInfoProps {
  sellerAddress: string; // Full address (0x...)
  sellerName?: string; // Optional display name
  trustLevel: "verified" | "reputable" | "unverified";
  reputationScore: number; // 0-100
  totalCommitments: number;
  successRate: number; // Percentage (0-100)
  verificationDate?: Date;
  isCurrentUser: boolean; // If buyer is seller
  className?: string;
}
```

### Subcomponents

1. **SellerAddressCard**
   - Props: `{ address: string, name?: string }`
   - Renders: Shortened address with copy button
   - Behavior: Copy full address to clipboard on button click
   - Icon: Copy icon
2. **TrustBadgeDisplay**

   - Props: `{ level: TrustLevel }`
   - Renders: Existing `TrustBadge` component (reuse)
   - Tooltip: Shows trust criteria on hover

3. **VerificationDetailsBox**

   - Props: `{ level: TrustLevel, date?: Date }`
   - Visible only if: `level === 'verified'` or `level === 'reputable'`
   - Content:
     - "✓ Identity Verified" (if verified)
     - "Last verified: Jan 15, 2026"
     - Link: "Learn more about verification"
   - Link behavior: Opens modal or external page

4. **ReputationCard**
   - Props: Spread from `SellerInfoProps`
   - Renders: Existing `ReputationDisplay` component (reuse)
   - Styling: Card format with border

### Layout (Desktop vs Mobile)

- **Desktop**: Sticky sidebar, fixed width 280px, right column
- **Mobile**: Full-width section, below commitment summary

### Accessibility

- All interactive elements have `aria-label`
- Copy button: `aria-label="Copy seller address"`
- Link to verification: `aria-label="Learn more about seller verification, opens in new tab"`

---

## 4. Component: `PurchaseCtaSection`

### File Path

`src/components/listing-detail/PurchaseCtaSection.tsx`

### Props Interface

```typescript
interface PurchaseCtaProps {
  listingId: string;
  listingStatus: "available" | "not-for-sale" | "delisted";
  userStatus: "authenticated" | "unauthenticated";
  walletConnected: boolean;
  walletAddress?: string;
  sellerAddress: string;
  userHasSufficientBalance?: boolean;
  ctaState: "eligible" | "ineligible" | "needs-wallet" | "unauthenticated";
  ineligibleReason?: string; // E.g., "You cannot purchase your own commitments"
  onPurchaseClick: () => void;
  onConnectWalletClick: () => void;
  onSignInClick: () => void;
  className?: string;
}
```

### CTA State Logic

```typescript
type CtaState = "eligible" | "ineligible" | "needs-wallet" | "unauthenticated";

function computeCtaState(props: PurchaseCtaProps): CtaState {
  if (!props.userStatus === "unauthenticated") return "unauthenticated";
  if (!props.walletConnected) return "needs-wallet";
  if (props.listingStatus !== "available") return "ineligible";
  if (props.walletAddress === props.sellerAddress) return "ineligible";
  if (!props.userHasSufficientBalance) return "ineligible";
  return "eligible";
}
```

### Subcomponents

1. **PrimaryCtaButton**

   - Props: `{ state: CtaState, onClick, loading? }`
   - Renders:
     - Eligible: `"Purchase Commitment"` (green, clickable)
     - Ineligible: `"Unavailable for Purchase"` (gray, disabled)
     - Needs Wallet: `"Connect Wallet to Purchase"` (orange, clickable)
     - Unauthenticated: `"Sign In to Purchase"` (blue, clickable)
   - Height: 44px minimum
   - Width: Full-width on mobile, fixed on desktop
   - Loading state: Show spinner inside button, disable

2. **HelperText**

   - Props: `{ state: CtaState, reason?: string }`
   - Below primary button (12px gap)
   - Copy varies by state:
     - Eligible: "You have sufficient balance to purchase this commitment"
     - Ineligible: Show custom reason or generic "Not available"
     - Needs Wallet: "Connect your Stellar wallet to proceed with purchase"
     - Unauthenticated: "Create an account or sign in to buy commitments"
   - Color: White/70% for all states

3. **SecondaryActions**

   - Props: `{ listingId, onShare, onSave, isSaved? }`
   - Layout: Below helper text on mobile; inline row on desktop
   - Actions:
     - "Share this listing" (secondary button, outline)
     - "Save for later" (icon button, heart, toggle-able)
   - Behavior:
     - Share: Show native share sheet (mobile) or copy link + toast (desktop)
     - Save: Toggle heart icon, persist to localStorage, show toast

4. **TrustDisclaimer**
   - Props: None (static content)
   - Below all CTA sections
   - Copy: "Verification indicators are based on historical platform data..."
   - Link in text: "Learn more" → external link to trust methodology
   - Visual: Light background card, no more than 2 lines

### Error Handling

- If CTA state computation fails, show ineligible state
- If onClick callback fails, show error toast and rollback UI state

### Mobile-Specific

- Full-width button with 16px margins
- Sticky footer option: If page > 800px height, show floating CTA at bottom
- Secondary actions stack vertically on mobile

---

## 5. Component: `AttestationHistorySection`

### File Path

`src/components/listing-detail/AttestationHistorySection.tsx`

### Props Interface

```typescript
interface AttestationHistorySectionProps {
  listingId: string;
  attestations: Attestation[];
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  isLoading?: boolean;
  error?: Error | null;
}

interface Attestation {
  id: string;
  event: "created" | "verified" | "settled" | "disputed" | "default";
  timestamp: Date;
  details?: string;
  transactionHash?: string;
  explorerUrl?: string;
}
```

### Subcomponents

1. **AttestationHeader** (Collapsible)

   - Props: `{ count: number, isExpanded, onToggle }`
   - Renders: "View Attestation History (3 events)" with chevron
   - Chevron rotates on toggle
   - Mobile: Always collapsible; Desktop: Can be expanded by default

2. **AttestationTimeline** (Content)

   - Props: `{ attestations: Attestation[], isLoading }`
   - Renders: Vertical timeline
   - Each event:
     - Date badge on left (12px)
     - Event icon and label (center)
     - Details and explorer link on right
   - Max visible: 10 events; "Load more" button if > 10

3. **AttestationEventBadge**

   - Props: `{ event: string, timestamp: Date }`
   - Icon + color coding by event type
   - Created: Blue
   - Verified: Green
   - Settled: Gray
   - Disputed: Orange
   - Default: Red

4. **ExplorerLinkBadge** (Reusable)
   - Props: `{ transactionHash: string, explorerUrl: string }`
   - Renders: "View on Stellar Expert" with external icon
   - Behavior: Opens in new tab, rel="noopener noreferrer"

### Mobile vs Desktop

- Mobile: Collapsed by default, user taps to expand
- Desktop: Expanded by default (or configurable)
- Timeline layout shifts to accommodate viewport

---

## 6. Component: `ListingDetailSkeleton`

### File Path

`src/components/listing-detail/ListingDetailSkeleton.tsx`

### Props Interface

```typescript
interface ListingDetailSkeletonProps {
  showSidebar?: boolean; // false on mobile
}
```

### Content

- Type badge skeleton (pill, 80px × 24px)
- Commitment ID skeleton (text, 120px × 16px)
- Asset details skeleton (pills, 200px × 24px)
- Key metrics grid skeleton (4 cards on desktop, 2 on mobile, each 150px × 100px)
- Seller section skeleton (text + card, 280px × 200px)
- CTA button skeleton (full-width, 44px)
- Attestation section skeleton (3 timeline items)

### Animation

- Pulsing opacity: `0.5 → 1.0` over 1.5s
- Use Tailwind `animate-pulse` or custom CSS

### Timing

- Minimum display: 300ms
- Maximum display: 3s (fallback to error if not loaded)

---

## 7. Component: `ListingDetailError`

### File Path

`src/components/listing-detail/ListingDetailError.tsx`

### Props Interface

```typescript
interface ListingDetailErrorProps {
  type: "not-found" | "network-error" | "permission-denied" | "unknown";
  onRetry?: () => void;
  onGoHome?: () => void;
  onBrowseMarketplace?: () => void;
  fullPage?: boolean; // true = full page layout; false = card in main area
}
```

### Error States

1. **Not Found** (404)

   - Icon: Warning or chain-broken
   - Title: "Listing Not Found"
   - Description: "This commitment may have been delisted or is no longer available."
   - Actions:
     - "Browse Marketplace" (primary)
     - "Go Home" (secondary)
     - "Report Issue" (text link)

2. **Network Error**

   - Icon: Wifi-off or globe-slash
   - Title: "Connection Error"
   - Description: "Unable to load this listing. Check your connection."
   - Actions:
     - "Try Again" (primary)
     - "Go Home" (secondary)

3. **Permission Denied**

   - Icon: Lock
   - Title: "Not Authorized"
   - Description: "You don't have permission to view this listing."
   - Actions:
     - "Go Home" (primary)
     - "Sign In" (secondary)

4. **Unknown Error**
   - Icon: AlertCircle
   - Title: "Something Went Wrong"
   - Description: "We encountered an unexpected error. Please try again."
   - Actions:
     - "Try Again" (primary)
     - "Report Issue" (text link)
     - "Go Home" (secondary)

### Layout

- **Full Page**: Centered container, max-width 400px, padding 40px
- **Card**: Within main content area, margin 20px, padding 24px

---

## 8. Component: `ExternalLinkBadge` (Reusable)

### File Path

`src/components/listing-detail/ExternalLinkBadge.tsx`

### Props Interface

```typescript
interface ExternalLinkBadgeProps {
  href: string;
  label: string; // "View on Stellar Expert"
  icon?: React.ReactNode; // Optional custom icon
  className?: string;
}
```

### Rendering

- Icon (12px) + label + external-link icon (lucide-react)
- No underline by default; underline on hover
- Color: Match link color scheme

### Security

- Always set: `target="_blank"` and `rel="noopener noreferrer"`
- No onclick handlers; use plain `<a>` tag

---

## 9. Data Types / TypeScript Interfaces

### File Path

`src/types/listingDetail.ts`

```typescript
// Core listing data
interface Listing {
  id: string;
  commitmentType: "Safe" | "Balanced" | "Aggressive";
  amount: number; // In USD or base units
  yield: number; // Annual percentage
  duration: number; // In days
  maxLoss: number; // Percentage (0-100)
  assetName: string;
  network: "mainnet" | "testnet";
  sellerAddress: string;
  forSale: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Seller reputation data
interface SellerReputation {
  address: string;
  trustLevel: "verified" | "reputable" | "unverified";
  score: number; // 0-100
  totalCommitments: number;
  successRate: number; // 0-100
  verifiedAt?: Date;
}

// Attestation history
interface Attestation {
  id: string;
  listingId: string;
  event: "created" | "verified" | "settled" | "disputed" | "default";
  timestamp: Date;
  details?: string;
  transactionHash?: string;
}

// Combined page data
interface ListingDetailPageData {
  listing: Listing;
  seller: SellerReputation;
  attestations: Attestation[];
}

// CTA state for purchase button
type CtaState = "eligible" | "ineligible" | "needs-wallet" | "unauthenticated";
```

---

## 10. Styling Guide

### CSS Modules Scope

Create `ListingDetail.module.css` at `src/app/marketplace/[id]/page.module.css`:

```css
.container {
  display: grid;
  grid-template-columns: 1fr auto; /* desktop: content + sidebar */
  gap: 40px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 24px;
}

.mainContent {
  flex-grow: 1;
  min-width: 0; /* Prevent child overflow */
}

.sidebar {
  width: 280px;
  position: sticky;
  top: 80px; /* Below header */
  height: fit-content;
}

@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .sidebar {
    position: static;
    width: 100%;
  }
}
```

### Tailwind Classes Used

- Spacing: `px-4, py-6, gap-4, m-2`
- Typography: `text-lg, font-bold, text-white/70`
- Layout: `flex, grid, gap-2`
- Borders: `border, rounded-xl, border-white/10`
- Backgrounds: `bg-white/5, bg-white/10`
- States: `hover:opacity-80, disabled:opacity-50`

---

## 11. Testing Requirements

### Unit Tests

- CTA state computation logic (edge cases for all states)
- Address copy function (verify clipboard API call)
- Skeleton pulse animation duration
- External link rel attributes

### Integration Tests

- Page loads listing data correctly
- Seller reputation displays accurately
- CTA button state changes based on user auth status
- Expanding/collapsing attestation history works
- Error handling recovers gracefully

### E2E Tests

- User can view full listing detail page
- User can copy seller address
- User can click external links (verify they open in new tab)
- Responsive layout works on mobile (375px), tablet (768px), desktop (1024px)

### QA Checklist

- [ ] All CTA text clear and unambiguous
- [ ] Trust badges visible without scrolling on desktop
- [ ] Error messages guide user to recovery
- [ ] No layout shift between skeleton and loaded state
- [ ] External links are obviously external (icon present)
- [ ] Attestation timeline readable and organized
- [ ] Max loss warning appears when needed

---

## 12. Implementation Notes

1. **Do not implement yet** — This is specification only.
2. **Reuse components**: `TrustBadge`, `ReputationDisplay`, error layouts already exist.
3. **API contract**: Assumes `/api/marketplace/listings/[id]` returns `ListingDetailPageData`.
4. **Mobile-first CSS**: Start with mobile, then add desktop media queries.
5. **Accessibility first**: Use semantic HTML, ARIA labels, and keyboard navigation.

---

**Status**: ✅ Component Specifications Complete  
**Last Updated**: 2026-02-28
