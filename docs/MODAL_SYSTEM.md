# Modal System

This document outlines the architecture and conventions for creating modals and dialogs in the Commitlabs frontend.

## The `Dialog` Primitive

Historically, modals in this repository were built as standalone `div` elements rendered via React Portals, each manually implementing focus traps, scroll locking, and Escape key handling. This led to duplicated code and inconsistent accessibility behaviors.

To solve this, we introduced the `Dialog` primitive (`src/components/ui/Dialog.tsx`). It is a headless-style, reusable wrapper that standardizes:
- **Focus Trapping:** Keeps Tab/Shift+Tab navigation within the modal.
- **Escape Key Handling:** Closes the modal when Escape is pressed.
- **Focus Restoration:** Returns focus to the element that triggered the modal upon close.
- **Scroll Locking:** Prevents the underlying page from scrolling while the modal is open.
- **Inert Background:** Hides the rest of the application from screen readers when the modal is active.
- **Reduced Motion:** Respects the user's OS-level reduced motion preferences for entry animations.
- **ARIA Attributes:** Enforces `role="dialog"`, `aria-modal="true"`, and standardizes `aria-labelledby` / `aria-describedby` labeling.

## Creating a New Modal

When creating a new modal component, you should **never** write your own focus trap `useEffect` or manage `document.body.style.overflow`. Instead, compose your modal contents inside the `Dialog` primitive.

### 1. Basic Example

```tsx
import { Dialog } from '@/components/ui/Dialog';

export function MyCustomModal({ isOpen, onClose }) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledById="my-modal-title"
      describedById="my-modal-desc"
      className="w-full max-w-md bg-zinc-900 rounded-xl p-6 shadow-xl"
    >
      <h2 id="my-modal-title" className="text-xl font-bold">
        Confirm Action
      </h2>
      <p id="my-modal-desc" className="mt-2 text-zinc-400">
        Are you sure you want to proceed with this action?
      </p>
      
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="...">Cancel</button>
        <button className="...">Confirm</button>
      </div>
    </Dialog>
  );
}
```

### 2. API Reference (`DialogProps`)

| Prop | Type | Default | Description |
|---|---|---|---|
| `isOpen` | `boolean` | (required) | Controls whether the dialog is rendered. |
| `onClose` | `() => void` | (required) | Callback fired when the backdrop is clicked or Escape is pressed. |
| `labelledById` | `string` | `undefined` | ID of the element providing the modal's accessible title. |
| `describedById` | `string` | `undefined` | ID of the element providing the modal's accessible description. |
| `closeOnEscape` | `boolean` | `true` | Set to `false` to disable closing the modal via the Escape key (e.g., during async processing). |
| `initialFocusRef` | `RefObject` | `undefined` | Ref to the element that should receive focus when the modal opens. Falls back to the first focusable element. |
| `className` | `string` | `''` | Classes applied to the inner dialog panel element. |
| `backdropClassName` | `string` | `'bg-black/80 ...'` | Classes applied to the full-screen backdrop overlay. Overrides the default dark blur. |

### 3. Accessibility Checklist

When building modals, verify the following:
- [ ] You have passed a `labelledById` string that matches the `id` of your modal's visual `<h2>` title element.
- [ ] You have passed a `describedById` string that matches the `id` of the modal's visual `<p>` description element, if one exists.
- [ ] You have passed an `initialFocusRef` to the safest or most common action (e.g., a "Cancel" button or a primary CTA) if the first focusable element isn't ideal.
- [ ] If your modal has a loading state (e.g., waiting for an on-chain transaction), pass `closeOnEscape={!isLoading}` so the user cannot accidentally dismiss it during a critical path.

## Migrated Modals

The following modals have been migrated to the `Dialog` primitive:
- `CommitmentCreatedModal`
- `CommitmentDetailsModal`
- `CommitmentDisputeModal`
- `SettlementModal`
- `CommitmentEarlyExitModal`
- `ExportCommitmentsModal`

Do not reintroduce manual focus or scroll event listeners into these components. The `Dialog` primitive automatically guarantees:
1. Focus trapping (cycles within the active dialog using keyboard Tab/Shift+Tab).
2. Initial focus on mount (prioritizing the `initialFocusRef` if provided, falling back to the first focusable element, and then the dialog body).
3. Focus restoration on unmount (returning focus to the previously active element).
4. Body scroll locking while open.
5. Sibling root elements accessibility hiding (setting `inert` and `aria-hidden="true"`).

