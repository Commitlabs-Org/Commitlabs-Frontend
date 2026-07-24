# Marketplace Listing Detail Page - QA & Testing Guide

This document provides a comprehensive testing checklist, QA procedures, and validation criteria for the listing detail page design before implementation.

---

## 1. Design Review Checklist

### 1.1 Visual Consistency

- [ ] Type badge (Safe/Balanced/Aggressive) uses consistent colors across all pages
- [ ] Trust badges (Verified/Reputable/Unverified) match TrustBadge.tsx component colors
- [ ] Metric cards use consistent spacing and border styles
- [ ] Buttons match design system (height 44px, padding 12px 24px)
- [ ] External link icons (↗) are consistent size (12px) throughout
- [ ] Skeleton placeholders use same pulsing animation (1.5s cycle)
- [ ] Error states match ErrorLayout.tsx pattern

### 1.2 Typography Hierarchy

- [ ] Page title (24px) is distinct from section headers (16px)
- [ ] Metric values (18px) are larger than labels (12px)
- [ ] Body text (14px) is readable at mobile sizes
- [ ] Helper text (12px) is not too small; meets WCAG contrast ratios
- [ ] All text uses project font stack (no custom fonts without fallback)
- [ ] Font weights follow spec (400, 500, 600, 700 only)

### 1.3 Color Accessibility

- [ ] Text meets WCAG AA contrast ratio (4.5:1 for normal, 3:1 for large)
- [ ] Color is not the only differentiator (icons/text/patterns also used)
- [ ] Disabled buttons use reduced opacity (not just color change)
- [ ] Error messages use color + icon + text (not just red)
- [ ] CTA button states are visually distinct without relying on color alone

### 1.4 Spacing & Alignment

- [ ] All spacing uses 4px base unit (Tailwind: space-2, space-4, space-6)
- [ ] Gaps between sections are consistent (16px or 24px)
- [ ] Padding inside cards is balanced (24px on desktop, 16px on mobile)
- [ ] No awkward gaps or alignment issues at any breakpoint
- [ ] Metric grid columns align vertically (no staggered alignment)
- [ ] Sidebar doesn't overlap content at any breakpoint

### 1.5 Responsive Design

- [ ] Desktop (1024px+): 2-column layout with sticky sidebar
- [ ] Tablet (768px): Sidebar adjusts to 30% width
- [ ] Mobile (375px): Single column, full-width components
- [ ] No horizontal scroll at any breakpoint
- [ ] All elements stack predictably (no unexpected wrapping)
- [ ] Touch targets minimum 44px × 44px on mobile

---

## 2. Desktop Testing (1024px+)

### Page Load State

- [ ] Page renders without errors
- [ ] Header with breadcrumb is visible and sticky
- [ ] Main content area is readable (max-width looks good)
- [ ] Sidebar is 280px wide and aligned right
- [ ] Sidebar is sticky (position: sticky) and stays visible on scroll

### Commitment Summary Section

- [ ] Type badge displays correctly with icon and color
- [ ] Commitment ID is copy-able (clipboard works)
- [ ] Asset details show name and network badge
- [ ] Key metrics grid displays in 4 columns
- [ ] Metric values are right-aligned, labels left-aligned
- [ ] Max Loss shows warning icon if 100%
- [ ] Health score bar fills correctly (0-100)
- [ ] Compliance status icon is visible and appropriate color
- [ ] Attestation section is expanded by default

### Seller Info Sidebar

- [ ] Seller address displays shortened (0x742d...)
- [ ] Copy button works and shows success toast
- [ ] Trust badge is visible without scrolling sidebar
- [ ] Reputation display shows score, commits, success rate
- [ ] Verification details visible if status is "verified" or "reputable"
- [ ] "Learn more" links go to external pages in new tab

### Purchase CTA Section

- [ ] CTA button is full-width within sidebar
- [ ] Button text changes based on state (eligible/ineligible/needs-wallet/unauth)
- [ ] Helper text is concise (1-2 lines)
- [ ] Share and Save buttons are below primary CTA
- [ ] Trust disclaimer is visible without scrolling
- [ ] All links open in new tab with rel="noopener noreferrer"

### Interactive Elements

- [ ] Buttons have hover states (opacity change)
- [ ] External links have hover states (underline + opacity)
- [ ] Copy button shows success toast on click
- [ ] Sidebar stays sticky while scrolling (sticky top: 80px)
- [ ] Attestation timeline scrolls smoothly (if many events)

### External Links

- [ ] "View on Stellar Expert" link is visually distinct (icon + label)
- [ ] All external links open in new tab
- [ ] All external links have rel="noopener noreferrer"
- [ ] No security warnings in browser console

---

## 3. Mobile Testing (375px)

### Layout & Overflow

- [ ] No horizontal scroll at 375px viewport
- [ ] Content fits within 375px width with margins
- [ ] All text wraps appropriately (no overflow)
- [ ] Metric cards stack in 2-column layout (not squished)
- [ ] Full-width elements have 16px margin on each side

### Hero Section

- [ ] Type badge centered and readable
- [ ] Amount displays large (32px) and readable
- [ ] Yield percentage is prominent (24px, green highlight)
- [ ] All elements fit above fold (no scroll needed for hero)

### Seller Info Section

- [ ] Seller address is readable and copy-able
- [ ] Trust badge fits without wrapping
- [ ] Reputation score and metrics stack vertically
- [ ] Verification details don't wrap awkwardly

### Key Metrics

- [ ] 2-column layout: Amount + Yield (top), Duration + Max Loss (bottom)
- [ ] Each metric card has adequate padding
- [ ] No text overflow or truncation
- [ ] Max Loss warning icon is visible

### CTA Button

- [ ] Button is full-width with 16px margins (≈327px on 375px viewport)
- [ ] Button height is minimum 44px (easy to tap)
- [ ] Button text doesn't truncate
- [ ] Helper text is readable (12px)
- [ ] Share and Save buttons stack vertically

### Attestation History

- [ ] Collapsed by default (chevron down)
- [ ] Header text: "View Attestation History (3 events)"
- [ ] Tapping expands smoothly (150ms animation)
- [ ] Timeline events are readable when expanded
- [ ] Events don't overflow horizontally
- [ ] "View on Stellar Expert" links are tap-friendly (44px+ height)

### Trust Disclaimer

- [ ] Fits within mobile width
- [ ] Text is readable (12px, line-height 1.4)
- [ ] Link doesn't break text flow
- [ ] "Learn more" link is tap-friendly

### Floating CTA (if implemented)

- [ ] Appears only if page content > 800px
- [ ] Sticks to bottom of viewport (44px height)
- [ ] Has dismiss button (×) on right side
- [ ] Dismissal preference saved to localStorage
- [ ] Doesn't cover critical content when fixed

---

## 4. Tablet Testing (768px)

### Layout Transition

- [ ] Sidebar adjusts from full-width to 30% width smoothly
- [ ] No awkward gaps at 768px breakpoint
- [ ] Content reflow is smooth (no layout jumps)

### Content Fit

- [ ] Both columns fit without overflow
- [ ] Metric grid adjusts appropriately (3-4 columns)
- [ ] CTA button is appropriately sized in sidebar
- [ ] Text doesn't become unreadably small

### Scrolling Behavior

- [ ] Sidebar scrolls with content if sidebar content exceeds viewport height
- [ ] Sticky positioning works correctly at 768px

---

## 5. Loading State Testing

### Skeleton Display

- [ ] Skeletons appear immediately (no flash of unstyled content)
- [ ] Skeleton shapes match final content (pill for badge, text for ID)
- [ ] Pulsing animation is smooth (opacity 0.5 → 1.0, 1.5s cycle)
- [ ] All sections have skeleton placeholders

### Loading Duration

- [ ] Skeletons show for minimum 300ms (even if data loads fast)
- [ ] Skeletons disappear after 3s maximum (fallback to error if needed)
- [ ] No janky transitions between skeleton and loaded state

### Layout Stability

- [ ] No content shift when skeleton disappears
- [ ] Final layout matches skeleton size and position
- [ ] Metric grid doesn't reflow when data loads

---

## 6. Error State Testing

### 404 Not Found

- [ ] Large warning icon is visible
- [ ] Title: "Listing Not Found" is clear
- [ ] Description explains what happened (delisted or unavailable)
- [ ] Buttons are prominent: "Browse Marketplace", "Go Home", "Report Issue"
- [ ] Buttons navigate to correct destinations
- [ ] Page is centered and readable

### Network Error

- [ ] Icon: Wifi-off or similar
- [ ] Title: "Connection Error" is clear
- [ ] Description explains network issue
- [ ] "Retry" button triggers page reload
- [ ] "Go Home" button navigates to home

### Permission Denied

- [ ] Icon: Lock or shield-slash
- [ ] Title: "Not Authorized"
- [ ] Description is non-accusatory
- [ ] Buttons guide user to recovery (sign in, go home)

### Partial Error (Reputation Load Fails)

- [ ] Seller address is still visible
- [ ] Warning message displays in reputation section
- [ ] "Retry" button reloads reputation data
- [ ] CTA button is still active with helper text: "Seller reputation unavailable..."
- [ ] User can still purchase based on available data

---

## 7. CTA State Testing

### Eligible State

- [ ] Button text: "Purchase Commitment"
- [ ] Button color: Green/primary
- [ ] Helper text: "You have sufficient balance to purchase this commitment"
- [ ] Button is clickable and navigates to purchase flow
- [ ] No accessibility warnings

### Ineligible State

- [ ] Button text: "Unavailable for Purchase"
- [ ] Button color: Gray/disabled
- [ ] cursor: not-allowed on hover
- [ ] Helper text shows specific reason (e.g., "You cannot purchase your own commitments")
- [ ] Alternative link: "Browse other commitments"
- [ ] Button is not clickable (aria-disabled="true")

### Needs Wallet State

- [ ] Button text: "Connect Wallet to Purchase"
- [ ] Button color: Orange/warning
- [ ] Icon: Wallet or chain symbol
- [ ] Helper text: "Connect your Stellar wallet to proceed"
- [ ] On click: Triggers wallet connection modal

### Unauthenticated State

- [ ] Button text: "Sign In to Purchase"
- [ ] Button color: Blue/info
- [ ] Helper text: "Create an account or sign in to buy commitments"
- [ ] On click: Navigates to login/signup flow

---

## 8. Trust Signal Testing

### Trust Badge Visibility

- [ ] Trust badge visible on initial page load
- [ ] Badge doesn't require scrolling on desktop
- [ ] Badge is prominently displayed in sidebar
- [ ] Badge color is correct for trust level (green/blue/gray)

### Tooltip on Hover

- [ ] Tooltip appears on badge hover
- [ ] Tooltip content is relevant to trust level
- [ ] Tooltip dismisses on mouse leave
- [ ] Tooltip is readable (contrast, size)

### Reputation Display

- [ ] Score is displayed with correct color (green if 90+, blue if 75+, orange if <75)
- [ ] Track record shows total commits
- [ ] Success rate shows percentage
- [ ] All metrics are accurate and match mock data

### Verification Details

- [ ] Shows only if trust level is "verified" or "reputable"
- [ ] "✓ Identity Verified" text is clear
- [ ] Last verification date is shown
- [ ] "Learn more" link is external and opens in new tab

---

## 9. Readability & Content Testing

### Metric Clarity

- [ ] Amount is clearly labeled and formatted ($50,000 or similar)
- [ ] Yield percentage is unmistakable and highlighted
- [ ] Duration is in human-readable format (e.g., "25 days")
- [ ] Max Loss is clear and shows warning if high (100%)

### CTA Clarity

- [ ] Button text is unambiguous (not generic like "Next" or "Continue")
- [ ] Helper text explains reason for state (not just "not available")
- [ ] No accusatory language (e.g., "insufficient balance" not "you're poor")
- [ ] Alternative actions are clear (e.g., "Browse other commitments")

### Trust Language

- [ ] Trust badge copy is positive but not misleading
- [ ] Disclaimer is visible and readable
- [ ] All trust levels have appropriate labels
- [ ] No false sense of security conveyed

### External Links

- [ ] All external destinations are clearly labeled
- [ ] Icon (↗) indicates external navigation
- [ ] No surprise navigation outside the app
- [ ] Link text is descriptive (not "click here")

---

## 10. Accessibility Testing

### Keyboard Navigation

- [ ] All buttons and links focusable with Tab key
- [ ] Focus order is logical (top-to-bottom, left-to-right)
- [ ] Focus indicators are visible (outline or highlight)
- [ ] No keyboard traps (user can always Tab or Shift+Tab out)
- [ ] Expandable sections can be toggled with Enter/Space

### Screen Reader Testing

- [ ] Page title is announced
- [ ] Section headers are marked with `<h2>` or `<h3>`
- [ ] Buttons have clear aria-labels (e.g., "Purchase commitment")
- [ ] External links are labeled (e.g., "View on Stellar Expert, opens in new tab")
- [ ] Images/icons have alt text (no empty alt="")
- [ ] Copy button success announces via live region
- [ ] Errors announce via ARIA live region

### Color Contrast

- [ ] All text meets WCAG AA ratio (4.5:1 for normal, 3:1 for large)
- [ ] Disabled buttons have sufficient contrast (no invisible text)
- [ ] CTA button text contrasts with background color
- [ ] Metric cards don't rely on color alone to distinguish values

### Form Controls

- [ ] Copy button: Clear purpose and accessible label
- [ ] Save button: Toggle state is announced
- [ ] Share button: Opens modal or share sheet (not navigating away)
- [ ] All form elements have associated labels

---

## 11. Performance Testing

### Load Time

- [ ] Initial page load < 3s on 4G network
- [ ] Skeleton appears immediately (< 100ms)
- [ ] Content loads smoothly without janky transitions

### Interaction Performance

- [ ] Button clicks register immediately (no lag)
- [ ] Attestation expand/collapse animation is smooth (60fps)
- [ ] Copy button shows toast in < 200ms
- [ ] No layout shift when skeleton → content

---

## 12. Cross-Browser Testing

### Desktop Browsers

- [ ] Chrome 120+
- [ ] Firefox 121+
- [ ] Safari 17+
- [ ] Edge 120+

### Mobile Browsers

- [ ] Chrome on Android 14+
- [ ] Safari on iOS 17+
- [ ] Samsung Internet 24+

### Test Criteria for Each Browser

- [ ] Page renders without console errors
- [ ] Sticky sidebar works correctly
- [ ] Animations are smooth (no stuttering)
- [ ] External links open in new tab
- [ ] Copy to clipboard works (or shows fallback)
- [ ] Touch targets are adequate on mobile

---

## 13. Sign-Off Gates

Before implementation, all of the following must be verified:

### Gate 1: Visual Design

- [ ] All layouts match wireframes (desktop, tablet, mobile)
- [ ] Colors match design system tokens
- [ ] Typography hierarchy is clear and consistent
- [ ] Spacing uses 4px base unit consistently
- [ ] No layout shifts between states

### Gate 2: Functional Design

- [ ] CTA states are clearly distinct and unambiguous
- [ ] Trust signals are prominent and trustworthy
- [ ] Error messages guide user to recovery
- [ ] Loading state is smooth and doesn't flicker
- [ ] External links are obviously external

### Gate 3: Responsive Design

- [ ] Mobile layout (375px) is usable
- [ ] Tablet layout (768px) is appropriate
- [ ] Desktop layout (1024px+) looks professional
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch targets are adequate (44px+)

### Gate 4: Accessibility

- [ ] Keyboard navigation works end-to-end
- [ ] Screen reader announces all content correctly
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators are visible
- [ ] No content is hidden from assistive technology

### Gate 5: Content & Copy

- [ ] CTA button text is clear and action-oriented
- [ ] Helper text explains each state
- [ ] Error messages are non-accusatory
- [ ] Trust language is positive but honest
- [ ] All links are descriptive

---

## 14. QA Testing Procedure

### Phase 1: Design Review (Day 1-2)

1. Review all wireframes against checklist items
2. Get stakeholder sign-off on layout and hierarchy
3. Verify compliance with design system
4. Document any design exceptions

### Phase 2: Responsive Testing (Day 3-4)

1. Test on emulated viewports: 375px, 768px, 1024px, 1440px
2. Test on real devices if available
3. Verify no overflow or layout shifts
4. Test on landscape and portrait orientation (mobile)

### Phase 3: State Testing (Day 5)

1. Test all CTA states (eligible, ineligible, needs-wallet, unauth)
2. Test loading state with artificial delay (min 300ms)
3. Test error states (404, network, permission denied)
4. Test partial error (reputation load failure)

### Phase 4: Accessibility Testing (Day 6)

1. Keyboard navigation audit
2. Screen reader testing (NVDA/JAWS on Windows, VoiceOver on Mac)
3. Color contrast verification
4. Focus indicator visibility

### Phase 5: Cross-Browser Testing (Day 7)

1. Test on Chrome, Firefox, Safari, Edge
2. Test on mobile Safari (iOS) and Chrome (Android)
3. Document any browser-specific issues
4. Verify workarounds for older browser versions

### Phase 6: Performance Testing (Day 8)

1. Measure initial load time
2. Check for layout shift (CLS metric)
3. Verify animations run at 60fps
4. Test on slow network (throttle to 4G)

---

## 15. Known Issues & Limitations

### Browser Limitations

- [ ] Older browsers (IE 11) not supported; graceful degradation OK
- [ ] Copy to clipboard: Fallback to manual selection if Clipboard API unavailable
- [ ] Sticky sidebar: Fallback to fixed positioning if CSS Grid not supported

### Design Limitations

- [ ] Sidebar collapses on mobile (not available as mini sidebar)
- [ ] Floating CTA button only on mobile if content > 800px
- [ ] Max 10 attestation events shown; "Load more" button for additional

---

## 16. Testing Sign-Off

After all testing phases are complete:

- [ ] **Design Lead**: Signs off on visual design and layout
- [ ] **QA Lead**: Signs off on responsive and accessibility testing
- [ ] **Product Manager**: Signs off on copy and CTA clarity
- [ ] **Accessibility Specialist**: Signs off on WCAG AA compliance
- [ ] **Engineering Lead**: Reviews design specs for implementation feasibility

**Ready for Implementation**: ✅ All gates passed, ready to code

---

**Status**: ✅ QA & Testing Guide Complete  
**Last Updated**: 2026-02-28  
**Next Step**: Schedule design review with stakeholders
