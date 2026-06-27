# ExportCommitmentsModal Test Coverage

This document summarizes the current test coverage for `src/components/export/ExportCommitmentsModal.tsx`.

## Covered behaviors

### Token resolution
- Explicit `sessionToken` prop takes precedence over stored tokens.
- Token resolved from `sessionStorage` using the first `STORED_TOKEN_KEYS` key (`commitlabs.sessionToken`).
- Falls back to `localStorage` when `sessionStorage` has no token for a given key.
- Walks the full `STORED_TOKEN_KEYS` fallback chain (`commitlabs.sessionToken` → `commitlabs:sessionToken` → `sessionToken`).
- Whitespace-only stored tokens are skipped, falling through to the next storage key.
- Error shown when no token exists in any location (prop, sessionStorage, localStorage).
- Token value is never rendered into the DOM before or after export.

### Export flow (idle → loading → success)
- Calls the export endpoint with the correct owner address query parameter and `Bearer` authorization header.
- Loading state shows "Preparing export" text, disables Export CSV, Cancel, and Close buttons.
- Buttons are disabled while loading, preventing accidental close mid-download.
- Escape key is blocked while an export is in progress.
- Successful response downloads the CSV via a temporary anchor element.
- Correct record count displayed for single and multiple commitment exports.
- Empty CSV (header only) shown as a non-failure with a clear message.
- Filename extracted from the `content-disposition` response header.

### Error handling
- 401 status shows "Sign in again" message.
- 403 status shows "This export is only available for the connected owner address."
- 429 status shows "Too many export attempts. Wait a moment and try again."
- Generic HTTP error (500) shows "Export failed. Try again in a moment."
- Network failure (fetch throws) shows a generic error message.
- Missing `ownerAddress` shows "Connect a wallet before exporting commitments."
- Recovery after error: second export attempt succeeds after a failed one.

### Dialog behavior
- Opens and closes with proper focus management.
- Focus is trapped inside the dialog (Tab cycles between Close and Export CSV buttons).
- Escape key closes the dialog when not loading.
- State resets when the dialog reopens (no stale error/success message).

### Input sanitization
- Whitespace stripped from `ownerAddress` and `sessionToken` before use.

## Test file

- `tests/components/ExportCommitmentsModal.test.tsx`

## Notes

- `fetch` is globally mocked; each test controls the response.
- `window.URL.createObjectURL` and `window.URL.revokeObjectURL` are stubbed.
- `HTMLAnchorElement.prototype.click` is spied on to verify download without triggering a real navigation.
