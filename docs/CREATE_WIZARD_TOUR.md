# Create Commitment Wizard Guided Tour

A dismissible, interactive guided tour designed to onboard users and walk them through the multi-step Create Commitment wizard. This tour reduces user drop-off and prevents misconfigurations by explaining DeFi concepts (e.g., penalty, risk profile, allocation constraints, auto-stop-loss) as users visit the wizard.

## Architecture

The guided tour is built with a modular, highly testable structure:

1. **`useGuidedTour` (Hook)**
   - Manages the active state of the tour, current step indices, and synchronizes with the wizard's step navigation flow.
   - Fetches and stores the "seen" flag off-chain via the `GET / PUT /api/user/preferences` user-preferences API.
   - Falls back to `localStorage` when no wallet is connected.
   - Triggers step transitions automatically when moving across wizard steps.
   - Location: [useGuidedTour.ts](file:///home/sudodave/Commitlabs-Frontend/src/hooks/useGuidedTour.ts)

2. **`GuidedTour` (Container Component)**
   - A declarative wrapper component that receives tour status and configuration, rendering the active step.
   - Location: [GuidedTour.tsx](file:///home/sudodave/Commitlabs-Frontend/src/components/onboarding/GuidedTour.tsx)

3. **`TourStep` (UI component)**
   - Tracks target selectors in the DOM and anchors tooltips dynamically (handles window resizes, scrolling, viewport constraints).
   - Highlights the target element with a clean, branded neon outline and shadow.
   - Focus traps keyboard navigation inside the tooltip (loops focus between controls).
   - Listens to global keyboard keys (`Escape` to skip/dismiss, `ArrowLeft` / `ArrowRight` for back/next navigation).
   - Respects `prefers-reduced-motion` to disable transitions for users with motion sensitivities.
   - Location: [TourStep.tsx](file:///home/sudodave/Commitlabs-Frontend/src/components/onboarding/TourStep.tsx)

## Step Flow

The tour traverses 12 specific target zones across the 3 wizard steps:

### Step 1: Select Type
1. **Wizard Steps Stepper**: Highlights the progress navigation.
2. **Commitment Types Cards**: Explains the difference between Safe, Balanced, and Aggressive profiles.
3. **Continue Button**: Directs the user on how to advance.

### Step 2: Configure Parameters
4. **Commitment Amount**: Explains selecting the amount and currency.
5. **Duration Slider**: Explains lock-in periods, yields, and early exit penalties.
6. **Max Loss Stop-Loss**: Teaches how automatic stop-loss protects capital on-chain.
7. **Advanced Toggle**: Displays advanced slippage/buffer parameters.
8. **Derived section**: Shows penalty calculation and fees.
9. **Configure Continue Button**: Directs the user to the review stage.

### Step 3: Review & Confirm
10. **Review Details**: Explains verifying the immutable parameters.
11. **Terms Checkboxes**: Emphasizes reading exit rules and agreeing to DeFi risks.
12. **Create Commitment Button**: Explains triggering the blockchain transaction.

## Features

- **Seen Persistence**: The tour runs automatically on first visit. Completing or skipping the tour updates user preferences so it is not shown again.
- **Relaunchable**: A help button labeled "Tour Guide" floats in the bottom-right corner, letting users re-launch the tour at any time.
- **Fully Accessible**: Implements focus trapping, keyboard shortcuts, proper focus restoration, and standard `aria` tags (`dialog`, `aria-labelledby`, `aria-describedby`).
- **Motion Sensitive**: Detects browser reduced motion preference and immediately suppresses animations.

## Tests

The feature is fully covered by a unit-test suite checking auto-start behavior, re-launching, skip persistence, keyboard focus trapping, and motion settings:

```bash
pnpm test src/components/onboarding/GuidedTour.test.tsx
```
