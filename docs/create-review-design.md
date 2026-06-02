# CreateCommitmentStepReview — Design Documentation

## Overview

The `CreateCommitmentStepReview` component provides users with a comprehensive review of their commitment before final submission. It groups commitment parameters into logical sections with per-section edit links, allowing users to navigate back to specific wizard steps to modify their choices.

## Component Purpose

The review step (Step 3 of the commitment creation wizard) serves as a critical checkpoint before on-chain submission. Users must:

1. Review their full commitment configuration across all parameter groups
2. Navigate back to specific steps if corrections are needed
3. Accept terms and risk acknowledgments
4. Confirm and submit their commitment

## Visual Hierarchy & Sections

The component groups commitment parameters into four distinct sections, each with its own edit link:

### 1. **Commitment Type Section**

- **Purpose**: Shows the selected risk profile
- **Fields**:
  - Type label (Safe, Balanced, Aggressive)
  - Icon representing the commitment type
  - Description: "Your selected commitment strategy"
- **Edit Link**: Returns to Step 1 (SelectType)
- **Rationale**: Type selection fundamentally affects all other parameters (yield, risk, duration constraints); isolating it acknowledges this importance

### 2. **Amount & Asset Section**

- **Purpose**: Displays the commitment principal
- **Fields**:
  - Amount with asset denomination (e.g., "1000 XLM")
- **Edit Link**: Returns to Step 2 (Configure)
- **Rationale**: Amount is a primary parameter that affects fees and potential returns; grouped separately for clarity

### 3. **Duration Section**

- **Purpose**: Shows the commitment timeline
- **Fields**:
  - Duration in days
  - Start date
  - End date
- **Edit Link**: Returns to Step 2 (Configure)
- **Rationale**: Temporal parameters are displayed together to help users visualize the full commitment period

### 4. **Risk & Protections Section**

- **Purpose**: Summarizes loss protection and financial parameters
- **Fields**:
  - Max Loss Protection (with visual risk indicator if no protection)
  - Early Exit Penalty
  - Estimated Transaction Fees
  - Estimated Yield (APY)
- **Edit Link**: Returns to Step 2 (Configure)
- **Rationale**: Groups all risk-related and financial metrics together, allowing users to see the full risk/reward profile at a glance

## Edit Button Behavior

### Navigation Model

- Edit buttons are context-aware links that jump to the relevant wizard step
- All risk/duration/amount edits return to Step 2 (Configure)
- Type edits return to Step 1 (SelectType)
- The component receives an `onEditStep` callback prop (optional) that accepts a step number (1 or 2)

### Keyboard Navigation

- Edit buttons are fully keyboard-accessible
- Tab order follows visual flow
- Enter and Space keys activate buttons
- Clear focus indicators (outline) on focus
- Implemented with semantic `<button>` elements for proper assistive technology support

### Accessibility Features

- **aria-label**: Each button has a descriptive label, e.g., "Edit commitment type"
- **title attribute**: Provides additional context on hover, e.g., "Return to step 1 to edit commitment type"
- **Semantic sections**: Each group uses `<section>` with `aria-labelledby` pointing to its heading id
- **ARIA labels**: Section headings have unique ids tied to their parent sections

## Visual Design

### Color Scheme

- Section containers: Dark background (#111111) with teal border (#0FF0FC)
- Edit buttons: Transparent background with teal border and text, hover state adds subtle glow
- Risk indicators: Orange (#f97316) for high-risk conditions (100% loss allowed)
- Yield/success metrics: Teal (#0FF0FC) for positive indicators

### Typography

- Section titles: 1.1rem, semibold (600), white
- Field labels: Uppercase, 0.75rem, gray (#6b7280), letter-spacing
- Field values: Monospace, 0.95rem, white, semibold
- Type description: Small gray text (0.8rem) below type value

### Spacing & Layout

- Sections stack vertically with 1.5rem gap
- Within each section: 1.5rem padding
- Field grids: 2-column on desktop, 1-column on mobile
- Section header with title and edit button: flex row with space-between alignment

### Responsive Behavior

- **Desktop**: All sections visible, 2-column field grids where applicable
- **Mobile**: Single column layout, edit button stack below title on smaller screens
- Fields within sections adapt to viewport width

## Component Props

```typescript
interface CreateCommitmentStepReviewProps {
  // Display data
  typeLabel: string; // e.g., "Balanced Commitment"
  amount: string; // e.g., "1000"
  asset: string; // e.g., "XLM"
  durationDays: number; // e.g., 60
  maxLossPercent: number; // e.g., 8
  earlyExitPenalty: string; // e.g., "30 XLM"
  estimatedFees: string; // e.g., "0.5 XLM"
  estimatedYield: string; // e.g., "12.5% APY"
  commitmentStart: string; // e.g., "Immediately"
  commitmentEnd: string; // e.g., "2024-08-10"

  // State
  isSubmitting?: boolean;
  submitError?: string;

  // Callbacks
  onBack: () => void;
  onSubmit: () => void;
  onEditStep?: (step: 1 | 2) => void; // New: Navigate to edit step
}
```

## Data Flow

```
Step 1: SelectType
  ↓ (user selects type)
Step 2: Configure
  ↓ (user configures amount, duration, risk)
Step 3: Review
  ├─ Display all parameters in grouped sections
  ├─ User can edit any section (returns to Step 1 or 2)
  ├─ User accepts terms and risks
  └─ User submits (triggers blockchain transaction)
```

## Integration Points

### Parent Component (src/app/create/page.tsx)

- Manages wizard step state
- Provides `onEditStep` callback to jump between steps
- Supplies review data from configured parameters
- Handles submission and success modal

### Data Sources

- **Amount, Asset, Duration, Risk Parameters**: From Step 2 (Configure) form state
- **Estimated Fees, Yield**: Calculated or fetched (future integration with protocol constants)
- **Commitment Dates**: Calculated from duration and current time
- **Type Label**: From Step 1 selection, mapped to display name

## Accessibility Compliance

### WCAG 2.1 Level AA

- ✅ All interactive elements are keyboard-accessible
- ✅ Focus indicators are clearly visible
- ✅ Button labels are descriptive and meaningful
- ✅ Semantic HTML with `<section>` and heading hierarchy
- ✅ Color is not the only means of conveying information (e.g., risk is shown via text, not just color)
- ✅ Form controls (checkboxes) have proper labels
- ✅ Error messages and important notices are clearly displayed

### Assistive Technology

- Screen readers announce section headings and their relationships
- Button purposes are clear from aria-label and title
- Form structure follows standard patterns
- Disclaimer text is readable and meaningful

## Testing Strategy

### Unit Tests

- Component renders all sections correctly
- Edit buttons call `onEditStep` with correct step numbers
- Checkboxes toggle state correctly
- Submit button disabled state based on checkbox state
- Error and loading states display appropriately

### Integration Tests

- Edit button navigation integrates with wizard stepper
- Form state persists when returning from edit
- Back button navigates correctly

### Accessibility Tests

- Keyboard navigation (Tab, Enter, Space)
- Screen reader announces all content
- Focus indicators visible on all interactive elements
- Color contrast meets WCAG AA standards

### Edge Cases

- No loss protection (100% max loss) displays correctly
- Very long commitment dates format properly
- Large numbers display in monospace without wrapping
- Rapid edit button clicks handled gracefully

## Future Enhancements

1. **Protocol Constants Integration**: Pull fee and yield estimates from `protocolConstants.ts`
2. **Animated Transitions**: Smooth scroll to edited sections when returning from Step 1/2
3. **Comparison View**: Option to compare current review with previously saved drafts
4. **PDF Export**: Generate a commitment summary PDF for user records
5. **On-Chain Verification**: Display smart contract address and details for verification
6. **Tiered Edit**: Allow editing of specific fields without returning to full step
7. **Mobile Bottom Sheet**: Use bottom sheet drawer for edit navigation on mobile

## Development Guidelines

### Code Organization

- Component file: `src/components/CreateCommitmentStepReview.tsx`
- Styles: `src/components/CreateCommitmentStepReview.module.css`
- Tests: `tests/components/CreateCommitmentStepReview.test.tsx`

### CSS Architecture

- CSS Modules for style isolation
- BEM-like naming conventions for clarity
- Mobile-first media queries
- CSS custom properties for theming (future)

### Props Handling

- `onEditStep` is optional; edit buttons render conditionally
- All props are required except `isSubmitting` and `submitError`
- Type safety via TypeScript interface

## Version History

| Version | Date | Changes                                              |
| ------- | ---- | ---------------------------------------------------- |
| 1.0.0   | 2024 | Initial release with grouped sections and edit links |

---

## References

- **Figma Design**: [Link to design system]
- **Accessibility Audit**: `design/accessibility-audit/findings/02-create-wizard.md`
- **API Reference**: `docs/backend-api-reference.md`
- **Protocol Constants**: `src/lib/backend/services/protocolConstants.ts`
