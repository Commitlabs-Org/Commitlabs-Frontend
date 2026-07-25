# Create Wizard — Commitment Templates & Presets

## Overview

The **Select Type** step of the Create Commitment wizard includes a quick-start preset picker that prefills duration and max-loss values in the Configure step, reducing friction for new users while keeping all fields editable.

## Presets

Presets are defined in `src/components/create/commitmentPresets.ts`:

| Preset ID | Label | Type | Duration | Max Loss |
|---|---|---|---|---|
| `conservative-90` | Conservative 90-day | safe | 90 days | 2% |
| `balanced-60` | Balanced 60-day | balanced | 60 days | 8% |
| `aggressive-30` | Aggressive 30-day | aggressive | 30 days | 20% |

A **Start from scratch** option lets users pick a type and configure every field themselves.

## Props / API

### `CreateCommitmentStepSelectType`

New optional prop:

```ts
onApplyPreset?: (preset: CommitmentPreset) => void;
```

Called when a preset button is activated. The parent (`src/app/create/page.tsx`) uses this to update `durationDays` and `maxLossPercent` state before the user proceeds to the Configure step.

### `CommitmentPreset` (from `commitmentPresets.ts`)

```ts
interface CommitmentPreset {
  id: string;
  label: string;
  description: string;
  type: 'safe' | 'balanced' | 'aggressive';
  durationDays: number;
  maxLossPercent: number;
}
```

## Behavior

1. User sees the preset strip above the existing type cards.
2. Clicking a preset calls `onSelectType(preset.type)` **and** `onApplyPreset(preset)`.
3. The parent applies the preset values to `durationDays` and `maxLossPercent` state.
4. The Configure step opens pre-populated; every field remains editable.
5. Selecting a type card directly (without a preset) leaves Configure fields at their current defaults.
6. Draft persistence (`useDraftPersistence`) captures preset-prefilled values automatically since they flow through the same state variables.

## Accessibility

- The presets container uses `role="radiogroup"` with `aria-label="Commitment templates"`.
- Each preset button uses `role="radio"` and `aria-checked` reflecting selection state.
- Keyboard: `Enter` and `Space` activate a preset (default submit prevented).
- No animation is added, so `prefers-reduced-motion` is unaffected.

## Usage Example

```tsx
<CreateCommitmentStepSelectType
  selectedType={selectedType}
  onSelectType={handleSelectType}
  onNext={handleNextStep}
  onBack={handleBack}
  onApplyPreset={handleApplyPreset}
/>
```

Where `handleApplyPreset` in the page:

```ts
const handleApplyPreset = (preset: CommitmentPreset) => {
  setSelectedType(preset.type);
  setCommitmentType(preset.type);
  setDurationDays(preset.durationDays);
  setMaxLossPercent(preset.maxLossPercent);
};
```

## Testing

Tests live in `src/components/create/CreateTemplates.test.tsx` (Jest/Vitest + React Testing Library, happy-dom). They cover:

- Rendering all presets and the scratch option
- Accessibility roles and aria attributes
- Preset prefill calling `onApplyPreset` with correct values
- Keyboard activation (Enter / Space)
- Scratch option not calling `onApplyPreset`
- Continue button enabled/disabled state
- `commitmentPresets` data validity (types, ranges, uniqueness)
