# Settlement Eligibility Checklist

The commitment detail actions now include a settlement preview block that checks the settlement eligibility endpoint before the user opens the settlement flow.

## What it does

- Calls the preview endpoint for the commitment.
- Shows a compact checklist of settlement readiness signals.
- Disables the settle action when the preview marks the commitment as ineligible.
- Displays the blocking reason and the estimated settlement amount when available.

## Notes

The preview is refreshed whenever the commitment id changes. The component also handles loading and error states so users still get a clear explanation if the preview cannot be fetched.
