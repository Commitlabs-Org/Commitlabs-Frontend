# Help drawer

The in-app help drawer is available from the landing-page navigation bar. It provides quick answers to frequently asked questions about commitments, fees, disputes, and wallet connection without leaving the app.

## What it includes

- A searchable FAQ experience backed by a single source of truth in src/lib/faq.ts
- A prominent Discord link for unanswered questions
- Dialog-based behavior with keyboard support, focus handling, and Escape-to-close

## Maintenance

To add or update help entries, edit src/lib/faq.ts. The drawer will pick up the new entries automatically.
