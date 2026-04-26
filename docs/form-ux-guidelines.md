# Form UX Guidelines — Validation, Helper Text & Error Placement

**Reference:** [#230 - UI/UX: Define form UX guidelines for validation helper text and error placement](https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues/230)

Applies to all form inputs across the **create wizard** and **marketplace flows**.

---

## 1. Label & Description Rules

- Every input must have a visible `<label>` element associated via `htmlFor` / `id`. Never use placeholder text as a substitute for a label.
- Labels sit **above** the input, left-aligned.
- Optional fields are marked with `(optional)` appended to the label text — never mark required fields with an asterisk alone without a legend.
- Helper/description text sits **below the label, above the input** for guidance that helps the user fill in the field correctly (e.g. format hints, character limits).
- Keep helper text to one short sentence. If more context is needed, use a tooltip or expandable info icon.

```
[Label text]         ← always visible
[Helper text]        ← below label, above input (format hints, limits)
[_____________]      ← input field
[Error message]      ← below input, only when invalid
```

---

## 2. Validation Timing

| Trigger | Behaviour |
|---|---|
| **On blur** (default) | Validate when the user leaves the field. Show errors only after first interaction. |
| **On change** (after first error) | Once an error has been shown, re-validate on every keystroke so the user sees it clear in real time. |
| **On submit** | Always re-validate all fields on submit regardless of prior interaction. Focus the first invalid field. |

- Do **not** validate on focus or on the very first keystroke — this feels aggressive.
- Do **not** clear an error until the field value actually becomes valid.

---

## 3. Error Message Placement & Content

- Error messages appear **directly below the input** they relate to, never in a summary banner alone.
- Use `role="alert"` or `aria-live="polite"` on the error container so screen readers announce it without stealing focus.
- Associate the error message with the input via `aria-describedby`.
- Write errors in plain language: say what is wrong and how to fix it.

| ❌ Avoid | ✅ Use instead |
|---|---|
| "Invalid input" | "Enter a valid email address, e.g. name@example.com" |
| "Required" | "Commitment title is required" |
| "Error" | "Amount must be between 1 and 10,000 XLM" |

- Error text colour must meet WCAG AA contrast (4.5:1) against the background. Never rely on colour alone — pair with an icon (⚠) or bold weight.
- Maximum one error message per field at a time. Show the most actionable error first.

---

## 4. Numeric Input Formatting

- Display numeric values with locale-aware thousand separators (e.g. `1,000` not `1000`) in read-only or summary views.
- Input fields accept raw numbers only — strip formatting on blur and re-apply on display.
- Show the currency or unit label (e.g. `XLM`) as a static suffix/prefix outside the input, not inside it.
- For token amounts, always show the maximum available balance as helper text below the input.
- Validate min/max bounds on blur and surface a specific message: `"Minimum deposit is 10 XLM"`.

---

## 5. Accessible Error Announcement

- Wrap each field's error region in a container with `aria-live="polite"` and `id` linked to the input's `aria-describedby`.
- On submit with multiple errors, move focus to the first invalid field — do not just scroll.
- Do not use `aria-live="assertive"` for inline field errors; reserve assertive for critical system-level alerts.
- Ensure error icons have `aria-hidden="true"` — the text message carries the meaning.

```html
<!-- Example pattern -->
<label for="amount">Amount</label>
<p id="amount-hint" class="helper-text">Enter the XLM amount you want to commit.</p>
<input
  id="amount"
  type="number"
  aria-describedby="amount-hint amount-error"
  aria-invalid="true"
/>
<p id="amount-error" role="alert" class="error-text">
  Amount must be at least 10 XLM.
</p>
```

---

## 6. Figma Spec Reference

Design the following states for every input component in Figma:

| State | Visual treatment |
|---|---|
| Default | Border: neutral, label visible, helper text visible |
| Focus | Border: brand primary colour, focus ring (2px offset) |
| Valid | Border: success green, optional checkmark icon |
| Error | Border: error red, error message below, warning icon |
| Disabled | Reduced opacity (40%), no interaction, label still readable |

- Mobile: inputs must be at least **44×44px** tap target. Error text minimum **14px**.
- Keyboard-only: focus ring must be visible at all times — never `outline: none` without a custom replacement.
- Test with iOS/Android soft keyboards: ensure the viewport does not obscure the active input or its error message.

---

## 7. Quick Reference Checklist

Use this during design QA and code review:

### Labels & Helper Text
- [ ] Every input has a visible, associated `<label>`
- [ ] Placeholder text is supplementary only — not the label
- [ ] Helper text is above the input, error text is below
- [ ] Optional fields are marked `(optional)` in the label

### Validation Timing
- [ ] Errors appear on blur (first time), on change (after first error), and on submit
- [ ] No validation fires on focus or first keystroke
- [ ] Submit always re-validates all fields and focuses the first error

### Error Messages
- [ ] Error is placed directly below its input
- [ ] Error container uses `aria-live="polite"` or `role="alert"`
- [ ] Input has `aria-describedby` pointing to both helper text and error ids
- [ ] Input has `aria-invalid="true"` when in error state
- [ ] Error text is specific and actionable (not just "Invalid")
- [ ] Error colour meets WCAG AA contrast (4.5:1)
- [ ] Error is not conveyed by colour alone

### Numeric Inputs
- [ ] Unit/currency label is outside the input field
- [ ] Max available balance shown as helper text
- [ ] Min/max validation message is specific

### Keyboard & Mobile
- [ ] Focus ring is always visible on keyboard navigation
- [ ] Tap targets are at least 44×44px on mobile
- [ ] Active input and its error are not obscured by soft keyboard
- [ ] Submit moves focus to first invalid field

---

*This document was created as part of issue #230. Update it as new form patterns are introduced.*
