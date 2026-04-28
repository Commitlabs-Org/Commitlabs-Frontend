# Success State UX Patterns

This document defines the product UX for post-success states across commitment creation, settlement, and marketplace listing flows. It is intentionally UI/UX-only and does not prescribe implementation details beyond interaction behavior and content hierarchy.

## Purpose

Success states should do three things well:

1. Confirm what just completed.
2. Explain what the result means now.
3. Offer helpful next steps without steering the user into unwanted actions.

## Global Pattern

Every success state should follow this hierarchy:

1. Status confirmation
2. Result summary
3. Key metadata
4. Recommended next step
5. Optional supporting actions
6. Optional share surface
7. Optional external references

## System Rules

### What Good Looks Like
- Uses direct, calm language
- Surfaces one obvious next step
- Keeps completion and follow-up visually separate
- Lets users dismiss the state without penalty
- Uses the same trust cues as loading and error states

### What To Avoid
- Promotional copy immediately after success
- Auto-navigation away from the current context
- Auto-opening external pages
- Auto-triggering share
- Ambiguous labels like `Continue`
- Multiple competing primary actions

## Flow Patterns

### Commitment Created

#### User Need
The user needs reassurance that the commitment is active and a quick way to inspect it.

#### Modal Content
- Heading: `Commitment Created`
- Body: `Your commitment is active and available in your dashboard.`
- Metadata:
  - Commitment ID
  - Asset pair or strategy name
  - Start timestamp
- Primary action: `View Commitment`
- Secondary actions: `Create Another`, `Go to Dashboard`
- Optional share: `Copy Commitment Link`
- Optional external: `View on Stellar Explorer`

#### Full Page Additions
- Commitment summary card
- "What you can do next" recommendations
- Related shortcut cards for dashboard and marketplace

### Commitment Settled

#### User Need
The user needs closure, clarity on what changed financially, and a path back to overview screens.

#### Modal Content
- Heading: `Commitment Settled`
- Body: `Settlement is complete and this commitment is now closed.`
- Metadata:
  - Commitment ID
  - Settlement amount
  - Settlement timestamp
- Primary action: `View Settlement Details`
- Secondary actions: `Back to Commitments`, `Go to Dashboard`
- Optional share: `Copy Receipt Link`
- Optional external: `View Settlement on Explorer`

#### Full Page Additions
- Final state summary
- Outcome callout explaining that no further actions are required
- Links to related records, receipts, or portfolio pages

### Listing Published

#### User Need
The user needs confirmation that the listing is live plus an easy way to preview or share it.

#### Modal Content
- Heading: `Listing Published`
- Body: `Your listing is live and visible in the marketplace.`
- Metadata:
  - Listing ID
  - Ask price
  - Publish timestamp
- Primary action: `View Listing`
- Secondary actions: `Share Listing`, `Go to Marketplace`
- Optional tertiary action: `Create Another Listing`
- Optional external: `View Listing Transaction`

#### Full Page Additions
- Live listing preview card
- Share card with copy link and native share option
- Related discovery destinations in marketplace

## Next-Step Recommendations

Next-step recommendations should be framed as suggestions, not tasks.

### Copy Style
- Good: `You can review performance from your dashboard.`
- Good: `If you want to share it, copy a public link.`
- Avoid: `Next, list it now to maximize returns.`
- Avoid: `Don't stop here.`

### Recommendation Limits
- Show up to three recommendations
- Order by usefulness, not business preference
- Keep each recommendation to one line on mobile where possible

## Share View Pattern

Use a share view only when the completed object has a stable destination or public-safe reference.

### Modal Share Row
- Compact row below secondary actions
- Link copy first
- Native share second when supported

### Full Page Share Card
- Short explanation of what is being shared
- Copy link button
- Native share button when supported
- Optional preview of destination title

### Privacy Rules
- Do not expose sensitive wallet or balance details in share previews
- Do not assume the item is public unless the product explicitly makes it public
- Separate public listing URLs from authenticated management URLs

## Safe External Links Pattern

### Behavior
- Open in a new tab
- Mark with external icon
- Keep link styling understated
- Provide enough context for the user to know where they are going

### Placement
- Footer row in modals
- Side card or lower-priority section on full pages

### Copy
- `View on Stellar Explorer`
- `Open Public Listing`

## Content Tokens

These text rules should stay consistent across all success states:

- Headings use past-tense verbs: `Created`, `Settled`, `Published`
- Body copy explains the new system state
- Metadata labels use short nouns: `Commitment ID`, `Settlement Amount`, `Published`
- Primary buttons use destination-based labels, not vague verbs

## Visual Consistency With Global States

Success states should feel related to loading and error states without becoming identical.

### Shared Traits
- Clear headline area
- High-contrast content blocks
- Consistent spacing
- Calm motion
- Strong focus treatment

### Distinct Success Cues
- Positive iconography
- Resolved tone
- Reduced instructional density compared with error states

## Design QA

Use this checklist during review:

- The state can be understood in under five seconds
- The action result is explicit
- There is exactly one clear primary action
- Follow-up actions remain optional
- Share is not required to complete the flow
- External destinations are clearly labeled
- Mobile layout does not bury the close action
- Metadata is useful and not noisy
- The same flow can scale from modal to page without rewriting the information architecture
- The state does not introduce dark patterns, urgency, or guilt-based copy

## Suggested Future Figma Frames

- `Success / Create / Modal / Desktop`
- `Success / Create / Modal / Mobile`
- `Success / Settle / Modal / Desktop`
- `Success / Settle / Page / Mobile`
- `Success / Listing / Modal / Desktop`
- `Success / Listing / Page / Desktop`
- `Success / Share Card / Mobile`
- `Success / External Link Footer / Desktop`
