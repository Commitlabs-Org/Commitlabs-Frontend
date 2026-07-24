# Create Wizard Draft Autosave

## Overview

This feature adds draft autosave and restore functionality to the commitment creation wizard, ensuring users never lose their progress when navigating away or refreshing the page.

## Files Modified/Added

### New Files

1. **`src/hooks/useDraftPersistence.ts`** - React hook that handles:
   - Saving draft state to localStorage with debouncing (500ms)
   - Loading and validating saved drafts
   - Clearing drafts on successful submission
   - Schema versioning for safe handling of stale data

2. **`src/components/create/ResumeDraftPrompt.tsx`** - Modal component that:
   - Displays when a saved draft is detected
   - Shows a summary of the draft content
   - Provides "Resume Draft" and "Start Fresh" options

3. **`src/hooks/__tests__/useDraftPersistence.test.ts`** - Comprehensive test suite covering:
   - Loading valid drafts
   - Ignoring invalid or stale drafts
   - Debounced saving
   - Clearing drafts
   - Resume functionality

4. **`docs/CREATE_DRAFT_AUTOSAVE.md`** - This documentation file

### Modified File

- **`src/app/create/page.tsx`** - Integrated the draft persistence hook and resume prompt

## Usage

### `useDraftPersistence` Hook

```typescript
import { useDraftPersistence } from '@/hooks/useDraftPersistence';

function YourComponent() {
  const {
    draft,         // Current saved draft (null if none)
    saveDraft,     // Save a new draft state (debounced)
    clearDraft,    // Clear the saved draft
    resumeDraft,   // Return the current draft
  } = useDraftPersistence();
  
  // ... your logic
}
```

### Draft State Schema (v1)

```typescript
interface DraftState {
  step: number;
  selectedType: "safe" | "balanced" | "aggressive" | null;
  commitmentType: "safe" | "balanced" | "aggressive";
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}
```

## Key Features

1. **Debounced Autosave**: Drafts are saved to localStorage after 500ms of inactivity to reduce unnecessary writes.
2. **Schema Versioning**: Stale drafts (with old schema versions) are automatically cleared.
3. **Safe Validation**: Invalid or malformed drafts are ignored and cleared.
4. **Clear on Success**: Drafts are cleared when a commitment is successfully created.

## How It Works

1. **On Load**: The `useDraftPersistence` hook checks localStorage for a saved draft.
2. **Resume Prompt**: If a valid draft exists, `ResumeDraftPrompt` is displayed.
3. **Autosave**: As the user progresses through the wizard, state changes trigger autosaves.
4. **Clear on Submit**: When a commitment is created successfully, the draft is cleared.

## Tests

Run the test suite:

```bash
pnpm test
```

The tests cover:
- Loading valid and invalid drafts
- Schema version validation
- Debounced save behavior
- Draft clearing
- Resume functionality
