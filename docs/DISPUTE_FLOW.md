# Dispute submission flow

## Overview

The commitment detail page now exposes a dispute submission flow from the Report an Issue action. When a user opens the modal, they can choose a dispute category, enter a required reason, optionally add evidence or notes, and submit the report to the backend dispute route.

## Request shape

The modal submits a POST request to `/api/commitments/[id]/dispute` with the following JSON payload:

```json
{
  "reason": "Detailed explanation of the issue",
  "evidence": "Optional supporting notes",
  "callerAddress": "G..."
}
```

The frontend reads the connected wallet address from the wallet hook and sends it as `callerAddress`.

## User-facing behavior

- Validates that the reason is present and no more than 500 characters.
- Shows clear feedback for validation and API failures without alarming language.
- Handles these server responses with specific copy:
  - `400`: review your reason and evidence before submitting again
  - `404`: the commitment could not be found
  - `409`: the commitment already has an active dispute
  - `429`: the user should wait a moment and try again
- On success, the modal surfaces a confirmation and the commitment detail page updates the visible state to reflect an active dispute.

## Accessibility and security notes

- The modal uses `role="dialog"` with an accessible title and description.
- Focus is moved into the dialog when opened and restored to the previously focused element when it closes.
- Keyboard support includes Escape to close and standard tab trapping inside the dialog.
- The form only renders user-provided strings as text content and does not inject them into the DOM unsafely.
