# Listing Detail Page - Visual Layout & Wireframe Reference

This document provides ASCII wireframes and visual layout specifications for the marketplace listing detail page across all device sizes and states.

---

## 1. Desktop Layout (1024px+)

### Full Page View

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Marketplace > Commitment #001 - Safe Commitment                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐               │
│  │ MAIN CONTENT AREA (Left ~65%)                                      │ SIDEBAR (35%)│
│  │                                                                    │               │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ ┌─────────────┐
│  │  │ [Safe] Commitment #001                                      │ │ │ Seller Info │
│  │  └─────────────────────────────────────────────────────────────┘ │ │             │
│  │                                                                    │ │ 0x742d...   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │ ✓ Verified  │
│  │  │ Stellar Lumens (XLM)                    [Mainnet]            │ │ │             │
│  │  └─────────────────────────────────────────────────────────────┘ │ │ Score: 95   │
│  │                                                                    │ │ 235 commits │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐  │ │ 98% Success │
│  │  │  Amount      │ │    Yield     │ │   Duration   │ │ Max Loss│  │ │             │
│  │  │  $50,000     │ │     5.2%     │ │   25 days    │ │   2%    │  │ │ ✓ Verified  │
│  │  │              │ │  Annualized  │ │              │ │         │  │ │ Jan 15 2026 │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘  │ │             │
│  │                                                                    │ │ [Purchase]  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │             │
│  │  │ Compliance Status                                           │ │ │ Share       │
│  │  │ Health Score: 92/100 ████████████░░░ On-Track             │ │ │ Save        │
│  │  │ Last Verified: Jan 28, 2026                                │ │ │             │
│  │  └─────────────────────────────────────────────────────────────┘ │ │ [Disclosure]│
│  │                                                                    │ │             │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ └─────────────┘
│  │  │ ▼ Attestation History (3 events)                            │ │
│  │  │                                                              │ │ [Sticky on │
│  │  │  ●─ JAN 28  Verified ✓ Commitment verified on-chain        │ │  scroll]   │
│  │  │     ↗ View on Stellar Expert                                │ │            │
│  │  │                                                              │ │ [Sidebar]  │
│  │  │  ●─ JAN 20  Created ⊙ Initial commitment recorded           │ │            │
│  │  │     ↗ View on Stellar Expert                                │ │            │
│  │  │                                                              │ │            │
│  │  │  ●─ JAN 15  Settled ✓ Commitment reached maturity           │ │            │
│  │  │     ↗ View on Stellar Expert                                │ │            │
│  │  │                                                              │ │            │
│  │  └─────────────────────────────────────────────────────────────┘ │            │
│  │                                                                    │            │
│  │  ↗ View on Stellar Expert                                         │            │
│  │                                                                    │            │
│  └────────────────────────────────────────────────────────────────────┘            │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘

SIDEBAR (right, 280px wide):
- Sticky position: top: 80px (below header)
- Remains visible as user scrolls main content
- On reach end of content, becomes unstuck
- Background: Subtle, same as main content
```

---

## 2. Mobile Layout (375px)

### Full Page View (Scrolled Through)

```
┌───────────────────────────┐
│ ← Marketplace > #001      │  [Header - sticky]
├───────────────────────────┤
│                           │
│  [Safe Commitment]        │  [Type badge - centered]
│                           │
│  $50,000                  │  [Amount - large, 32px font]
│                           │
│  5.2% Annualized Yield    │  [Yield - 24px, green highlight]
│                           │
├───────────────────────────┤
│ Seller Information        │  [Section title]
│                           │
│ Address: 0x742d...        │  [Seller address with copy icon]
│                           │
│ ✓ Verified Seller         │  [Trust badge - compact]
│                           │
│ Score: 95/100             │  [Reputation section]
│ 235 Total Commitments     │  [Compact layout]
│ 98% Success Rate          │
│                           │
│ ✓ Identity Verified       │  [Verification details]
│ Last verified: Jan 15     │
│ Learn more about          │
│ verification ↗            │
│                           │
├───────────────────────────┤
│ Commitment Details        │
│                           │
│ Amount:      $50,000      │  [2-column layout]
│ Yield:       5.2%         │
│                           │
│ Duration:    25 days      │  [2-column layout]
│ Max Loss:    2%           │
│                           │
│ Health Score: 92/100      │  [Health indicator]
│ Status: On-Track          │
│                           │
├───────────────────────────┤
│                           │
│  [Purchase Commitment]    │  [Full-width CTA button]
│                           │
│ You have sufficient       │  [Helper text]
│ balance to purchase       │
│                           │
│  [Share Listing]  [Save]  │  [Secondary actions - stacked]
│                           │
│ Verification indicators  │  [Trust disclaimer - small text]
│ are based on historical  │
│ data. Learn more ↗        │
│                           │
├───────────────────────────┤
│ Attestation History       │  [Collapsed header]
│ (3 events)         ▼      │  [Chevron indicates collapsed]
│                           │
├───────────────────────────┤
│                           │
│ View on Stellar Expert ↗  │  [External link - safe]
│                           │
└───────────────────────────┘

FLOATING CTA (optional, if content > 800px):
┌───────────────────────────┐
│     [Purchase Commitment] │  [Sticky footer]
│     You have sufficient   │  [Appears when user scrolls]
└───────────────────────────┘
```

### Mobile - Attestation Expanded

```
├───────────────────────────┤
│ Attestation History    ▲  │  [Expanded state - chevron up]
│                           │
│  ● JAN 28  Verified ✓     │  [Event 1]
│    Commitment verified    │
│    on-chain               │
│    View on Stellar ↗      │
│                           │
│  ● JAN 20  Created ⊙      │  [Event 2]
│    Initial commitment     │
│    recorded               │
│    View on Stellar ↗      │
│                           │
│  ● JAN 15  Settled ✓      │  [Event 3]
│    Commitment reached     │
│    maturity               │
│    View on Stellar ↗      │
│                           │
└───────────────────────────┘
```

---

## 3. Tablet Layout (768px)

### Full Page View

```
┌─────────────────────────────────────────────────────────────────┐
│ Marketplace > Commitment #001                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Safe Commitment]              [Seller: 0x742d...]             │
│  $50,000  |  5.2% Yield         [✓ Verified Seller]             │
│                                 Score: 95/100                    │
│  Stellar Lumens (XLM)           235 Commitments                  │
│  [Mainnet]                      98% Success                      │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐                              │
│  │ Amount       │ │ Yield        │  [Button in sidebar]          │
│  │ $50,000      │ │ 5.2%         │  [Purchase Commitment]        │
│  └──────────────┘ └──────────────┘                              │
│  ┌──────────────┐ ┌──────────────┐  [Share] [Save]              │
│  │ Duration     │ │ Max Loss     │                              │
│  │ 25 days      │ │ 2%           │                              │
│  └──────────────┘ └──────────────┘                              │
│                                                                  │
│  Compliance Status: On-Track                                     │
│  Health: 92/100                                                  │
│                                                                  │
│  ▼ Attestation History (3 events)                               │
│                                                                  │
│  ● JAN 28  Verified ✓                                           │
│  ● JAN 20  Created ⊙                                            │
│  ● JAN 15  Settled ✓                                            │
│                                                                  │
│  View on Stellar Expert ↗                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Loading State

### Desktop Loading

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Marketplace > ...                                                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐               │
│  │ ▓▓▓▓▓▓▓▓ (pulse)  #▓▓▓▓▓▓▓                                         │ SIDEBAR      │
│  │                                                                    │               │
│  │ ▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓                                           │ ┌─────────────┐
│  │                                                                    │ │ ▓▓▓▓▓▓ ▓▓▓ │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐  │ │             │
│  │ │ ▓▓▓▓▓▓▓▓▓▓   │ │ ▓▓▓▓▓▓▓▓▓▓   │ │ ▓▓▓▓▓▓▓▓▓▓   │ │▓▓▓▓▓▓ │  │ │ ▓▓▓▓▓▓ ▓▓▓ │
│  │ │ ▓▓▓▓▓▓▓▓▓▓   │ │ ▓▓▓▓▓▓▓▓▓▓   │ │ ▓▓▓▓▓▓▓▓▓▓   │ │▓▓▓▓▓▓ │  │ │             │
│  │ │              │ │              │ │              │ │         │  │ │ ▓▓▓▓▓▓▓▓▓▓ │
│  │ └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘  │ │             │
│  │                                                                    │ │ ▓▓▓▓▓▓▓▓▓▓ │
│  │ ┌─────────────────────────────────────────────────────────────┐ │ │             │
│  │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            │ │ │ ▓▓▓▓▓▓▓▓▓▓ │
│  │ │                                                                  │ │             │
│  │ └─────────────────────────────────────────────────────────────┘ │ │ ▓▓▓▓▓▓▓▓ ▓ │
│  │                                                                    │ │             │
│  │ ┌─────────────────────────────────────────────────────────────┐ │ └─────────────┘
│  │ │ ▼ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                         │ │
│  │ │                                                              │ │
│  │ │ ● ▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓                                         │ │
│  │ │ ● ▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓                                         │ │
│  │ │ ● ▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓                                         │ │
│  │ │                                                              │ │
│  │ └─────────────────────────────────────────────────────────────┘ │
│  │                                                                    │
│  └────────────────────────────────────────────────────────────────────┘
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘

Legend: ▓▓▓▓▓ = Pulsing skeleton placeholder (opacity 0.5 → 1.0)
Duration: 1.5s cycle, minimum display 300ms, maximum 3s
```

---

## 5. Error State

### 404 Not Found (Full Page)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Marketplace > Error                                                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                                                                                         │
│                                                                                         │
│                                                                                         │
│                  ⚠️                                                                     │
│                                                                                         │
│              Listing Not Found                                                          │
│                                                                                         │
│      This commitment may have been delisted                                            │
│      or is no longer available.                                                         │
│                                                                                         │
│                                                                                         │
│           [Browse Marketplace]                                                          │
│           [Go Home]                                                                     │
│           Report Issue ↗                                                                │
│                                                                                         │
│                                                                                         │
│                                                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Partial Error (Section)

```
┌─────────────────────────────────────────────────────────────────┐
│ Seller Information                                              │
│                                                                │
│ Address: 0x742d...                                            │
│                                                                │
│ ⚠️ Seller reputation temporarily unavailable                 │
│                                                                │
│ [Retry]                                                         │
│                                                                │
│ ℹ️ Seller reputation data unavailable. Purchase at your own   │
│ discretion.                                                     │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. CTA State Variations

### State 1: Eligible (Green)

```
┌─────────────────────────────────────────┐
│       [Purchase Commitment]  ✓           │  [Green/Primary Color]
│                                         │  [Clickable]
│ You have sufficient balance to purchase │
│ this commitment.                        │
│                                         │
│ [Share Listing]  [Save]                 │
│                                         │
└─────────────────────────────────────────┘
```

### State 2: Ineligible (Gray, Disabled)

```
┌─────────────────────────────────────────┐
│       Unavailable for Purchase ✗        │  [Gray/Secondary Color]
│                                         │  [Disabled, cursor: not-allowed]
│ You cannot purchase your own            │
│ commitments.                            │
│                                         │
│ Browse other commitments ↗              │
│                                         │
└─────────────────────────────────────────┘
```

### State 3: Needs Wallet (Orange)

```
┌─────────────────────────────────────────┐
│   🔗 Connect Wallet to Purchase         │  [Orange/Warning Color]
│                                         │  [Clickable]
│ Connect your Stellar wallet to proceed  │
│ with purchase.                          │
│                                         │
│ [Share Listing]  [Save]                 │
│                                         │
└─────────────────────────────────────────┘
```

### State 4: Unauthenticated (Blue)

```
┌─────────────────────────────────────────┐
│         Sign In to Purchase             │  [Blue/Info Color]
│                                         │  [Clickable]
│ Create an account or sign in to buy     │
│ commitments.                            │
│                                         │
│ [Share Listing]  [Save]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 7. Trust Badge Variations

### Verified Seller

```
┌───────────────────────────────────────────┐
│                                           │
│ ✓ Verified Seller                        │  [Green badge]
│ Identity and historical performance have  │  [Hover: Tooltip]
│ been verified by Commitlabs.              │  "Trust criteria..."
│                                           │
│ ✓ Identity Verified                       │  [Sub-badge]
│ Last verified: Jan 15, 2026               │
│ Learn more about verification ↗           │  [External link]
│                                           │
└───────────────────────────────────────────┘
```

### Reputable Seller

```
┌───────────────────────────────────────────┐
│                                           │
│ ✓ Top Reputation                         │  [Blue badge]
│ Seller has a high successful commitment   │  [Hover: Tooltip]
│ rate and positive community feedback.     │  "Criteria..."
│                                           │
│ [No additional verification badge]        │  [No "verified" sub-badge]
│                                           │
└───────────────────────────────────────────┘
```

### Unverified Seller

```
┌───────────────────────────────────────────┐
│                                           │
│ ⚠️ Self-Reported                          │  [Gray badge]
│ This seller has not yet completed the     │  [Hover: Tooltip]
│ verification process. Exercise caution.   │  "Criteria..."
│                                           │
│ [No verification sub-badge]               │
│                                           │
└───────────────────────────────────────────┘
```

---

## 8. Color-Coded Metric Values

### Health Score - Gradient

```
Health Score: 92/100

████████████░░░  [Green gradient bar]

0    25   50    75   90  100
Low  Mid        Good  Excellent
```

### Max Loss - Color Coding

```
Scenario 1: Low Max Loss (2%)
Max Loss: 2%  [White text, no special coloring]

Scenario 2: Moderate Max Loss (8-15%)
Max Loss: 12%  [Orange/warning color]

Scenario 3: High Max Loss (100%)
Max Loss: 100%  ⚠️  [Red color with warning icon]
"This commitment can result in total loss of principal."
```

---

## 9. Responsive Breakpoints & Layout Shifts

| Breakpoint | Width  | Layout        | CTA Style      | Sidebar     |
| ---------- | ------ | ------------- | -------------- | ----------- |
| Mobile     | 375px  | Single column | Full-width     | Full-width  |
| Mobile     | 640px  | Single column | Full-width     | Full-width  |
| Tablet     | 768px  | Split (65/35) | Inline/Sidebar | 30% width   |
| Desktop    | 1024px | Split (65/35) | Sidebar sticky | 280px fixed |
| Large      | 1200px | Split (70/30) | Sidebar sticky | 300px fixed |

---

## 10. Interactive Element Dimensions

### Desktop

- Type badge: 80px × 24px (pill)
- Buttons (CTA): 160px × 44px (minimum)
- Card: 280px × auto (sidebar)
- Metric card: 150px × 100px
- External link icon: 12px × 12px (text-relative)

### Mobile

- Type badge: 100% width × 32px (stretched)
- Buttons (CTA): Full-width minus 32px margin (16px each side)
- Card: Full-width minus 32px margin
- Metric card: 50% width - 8px gap
- Touch target: Minimum 44px × 44px

### Font Sizes

- Page title: 24px (desktop) / 20px (mobile)
- Metric value: 18px (desktop) / 16px (mobile)
- Button text: 14px (all)
- Helper text: 12px (all)

---

## 11. Animation Timings

| Animation      | Duration | Easing      | Trigger         |
| -------------- | -------- | ----------- | --------------- |
| Skeleton pulse | 1.5s     | ease-in-out | Page load       |
| Chevron rotate | 150ms    | ease-out    | Expand/collapse |
| Opacity fade   | 200ms    | ease-in     | State change    |
| Toast appear   | 300ms    | ease-out    | Copy/error      |
| Sidebar stick  | N/A      | N/A         | Scroll event    |

---

## 12. Spacing System

Use 4px base unit (Tailwind default: `space-*`):

- `gap-2`: 8px (between inline elements)
- `gap-4`: 16px (between sections)
- `gap-6`: 24px (major section spacing)
- `px-4`: 16px (horizontal padding)
- `py-6`: 24px (vertical padding)
- `p-8`: 32px (container padding)

---

**Status**: ✅ Visual Layout Reference Complete  
**Last Updated**: 2026-02-28
