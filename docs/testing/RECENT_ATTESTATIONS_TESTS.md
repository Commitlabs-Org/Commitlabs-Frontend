# RecentAttestationsPanel Test Coverage

This document summarizes the current test coverage for `src/components/RecentAttestationsPanel/RecentAttestationsPanel.tsx`.

## Covered behaviors

- Rendering of the main panel and section title.
- Populated list state:
  - preserves item ordering provided by props
  - renders each attestation title, description, and truncated transaction hash
  - formats timestamps relative to the current time
- Severity styling and state:
  - `ok` severity rows receive the `ok` CSS class
  - `warning` severity rows receive the `warning` CSS class
  - `violation` severity rows receive the `violation` CSS class
- Accessibility and severity conveyance:
  - each item uses an accessible `aria-label` containing its severity and title
  - severity is exposed via text labels in accessible names, not only color
- Empty state:
  - renders a polite empty-state message when the attestation list is empty
  - does not render attestation rows in empty state
- User interaction callbacks:
  - row selection invokes `onSelectAttestation` with the selected ID
  - `View All` button invokes `onViewAll`

## Test file

- `tests/components/RecentAttestationsPanel.test.tsx`

## Notes

- CSS module imports are mocked in the test environment to preserve class name references.
- The test suite uses fake timers so relative timestamp formatting can be asserted deterministically.
