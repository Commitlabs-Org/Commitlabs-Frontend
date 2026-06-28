# Success State UX Direction

This handoff defines UI/UX patterns for success states after users create a commitment, settle a commitment, or list a commitment on the marketplace.

The goal is to confirm completion clearly, suggest useful next steps without pressure, and keep external navigation safe and easy to understand.

## Design Principles

- Confirm the completed action in plain language before offering any follow-up actions.
- Keep all next steps optional. Never make the user feel they must continue to another flow.
- Prioritize the most likely immediate need as the primary action and keep all other actions secondary or tertiary.
- Only show share tools when sharing is genuinely useful for the completed action.
- Label external destinations clearly before the user leaves the product.
- Use the same structure, spacing rhythm, and accessibility behavior as other system feedback states.

## Flows Covered

### 1. Create Success
- Trigger: commitment creation completes successfully
- Default container: modal on top of the create flow
- Escalate to full page only when the user entered from a dedicated transaction confirmation route or deep-linked wallet callback
- Core message: the commitment is now active
- Recommended primary action: `View Commitment`
- Secondary options: `Create Another`, `Go to Dashboard`
- Optional tertiary action: `Share`
- Optional external link: `View on Explorer`

### 2. Settle Success
- Trigger: settlement completes successfully
- Default container: modal from commitment details or settlement flow
- Use full page when the underlying commitment record is no longer actionable and the user benefits from a closed-loop summary
- Core message: funds have been settled and the commitment is closed
- Recommended primary action: `View Settlement Details` or `Back to Commitments`
- Secondary options: `Go to Dashboard`, `Browse Marketplace`
- Optional tertiary action: `Share Receipt`
- Optional external link: `View Settlement on Explorer`

### 3. Listing Success
- Trigger: marketplace listing is published successfully
- Default container: modal from listing flow
- Use full page when listing includes promotional/share context or the listing route becomes canonical
- Core message: listing is live and discoverable
- Recommended primary action: `View Listing`
- Secondary options: `Share Listing`, `Go to Marketplace`
- Optional tertiary action: `Create Another Listing`
- Optional external link: `View Listing Transaction`

## Modal Variant

Use the success modal when the user should stay close to the original workflow context.

### Recommended Structure
1. Success icon or illustrated confirmation
2. Clear title with completed verb
3. One-sentence description
4. Key metadata block
5. Optional next-step recommendations
6. Primary action
7. Secondary actions
8. Optional share row
9. Optional safe external link row

### Content Rules
- Title examples: `Commitment Created`, `Commitment Settled`, `Listing Published`
- Description should answer "what happened" and "what changed"
- Metadata block should show one or two high-value identifiers only
- Next-step copy should be helpful and non-urgent
- Close affordance must remain visible and equivalent to declining follow-up actions

## Full Page Variant

Use the full success page when users need more breathing room, stronger orientation, or a durable destination after completion.

### Recommended Structure
1. Success hero with title and summary
2. Status card with key identifiers and timestamps
3. Outcome summary section
4. Recommended next steps section
5. Optional share panel
6. Optional related destinations
7. Safe external links section

### Full Page Advantages
- Better for mobile when modals feel cramped
- Better for settlement flows that end an active lifecycle
- Better for canonical listing URLs that users may want to revisit or share

## Suggested Copy Patterns

### Create
- Title: `Commitment Created`
- Body: `Your commitment is active and ready to track from your dashboard.`
- Next steps:
  - `Review performance and compliance`
  - `Copy or share the commitment link`
  - `Create another commitment later if needed`

### Settle
- Title: `Commitment Settled`
- Body: `Settlement is complete and this commitment is now closed.`
- Next steps:
  - `Review the final settlement details`
  - `Return to your commitments overview`
  - `Share a receipt link if you want a record outside the app`

### Listing
- Title: `Listing Published`
- Body: `Your commitment is now visible in the marketplace.`
- Next steps:
  - `Preview the live listing`
  - `Share the listing with potential buyers`
  - `Return to marketplace management`

## Share UX

Share is optional and should never visually outrank the core product action.

### Share Entry Points
- Inline secondary button in modals when the item now has a stable URL
- Dedicated share card on full success pages
- Overflow menu only if space is constrained on mobile

### Share Options
- `Copy Link`
- `Share Listing` or `Share Commitment`
- Native share sheet on supported mobile browsers

### Share Rules
- Do not auto-open native share sheets
- Do not auto-copy links
- Do not gate completion behind sharing
- Show a lightweight confirmation after link copy

## Safe External Links

External links must be clearly optional and visually de-emphasized.

### Allowed External Link Use Cases
- Blockchain explorer transaction details
- Public listing link outside the authenticated app shell
- Official documentation explaining the resulting state

### Requirements
- Always use an external-link icon and label the destination
- Open in a new tab
- Use safe rel attributes for security
- Include helper text when the user is leaving the product context
- Never style external links like the primary confirmation action

### Recommended Labels
- `View on Stellar Explorer`
- `Open Public Listing`
- `Read Settlement Reference`

## Layout Behavior

### Desktop
- Modal max width: 520px to 640px
- Keep action stack simple: one primary button, up to two secondary actions
- Place share and external links in a quieter footer zone

### Mobile
- Prefer bottom-sheet or full-height modal treatment when content exceeds two actions plus metadata
- Keep the primary action pinned within thumb reach
- Avoid more than three visible follow-up choices before truncation or stacking

## Accessibility And Trust

- Announce success state with proper dialog or page heading semantics
- Move focus to the primary action or success heading
- Preserve a visible close path that does not feel like cancellation
- Keep contrast high for all status text and metadata
- Avoid celebratory motion that delays comprehension
- Do not use confetti, countdowns, or urgency language

## Variants Summary

| Flow | Modal Primary | Modal Secondary | Full Page Add-on | Share Default | External Link |
| --- | --- | --- | --- | --- | --- |
| Create | View Commitment | Create Another / Dashboard | Activity summary | Optional | Optional |
| Settle | View Settlement Details | Dashboard / Marketplace | Final outcome summary | Optional | Optional |
| Listing | View Listing | Share / Marketplace | Promo-ready listing panel | Recommended | Optional |

## QA Checklist

- Success title matches the completed action exactly
- Description explains the resulting state, not just that it worked
- Primary action helps the user continue naturally
- Secondary actions are useful but clearly optional
- Share affordance is present only when a stable shareable destination exists
- External links are labeled, optional, and visually subordinate
- Modal and page variants use the same content hierarchy
- Keyboard focus, escape behavior, and close behavior are consistent with other system states
- Mobile layout keeps actions readable and reachable
- No copy creates pressure, urgency, or hidden promotion

## Deliverables

- Success modal pattern for create, settle, and listing flows
- Full success page pattern for create, settle, and listing flows
- Content and hierarchy rules for next-step recommendations
- Optional share pattern with trust-first behavior
- Safe external-link pattern aligned with system feedback states
