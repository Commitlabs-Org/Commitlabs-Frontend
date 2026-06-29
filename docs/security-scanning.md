# Security Scanning with CodeQL

This repository uses GitHub CodeQL to perform static security analysis on the TypeScript codebase.

## How to view findings
- Navigate to the **Security** tab of the repository.
- Under **Code scanning alerts**, you will see the results of the latest analysis.
- Each alert includes a description, severity, and a direct link to the affected line of code.

## Triage process
1. Review the alert description and severity.
2. Open the file at the indicated line to understand context.
3. Determine if the finding is a true positive.
   - If **yes**, create a ticket or fix the issue.
   - If **false positive**, add a comment to the alert or disable the rule.
4. Merge the fix and ensure the workflow passes on the next scan.

## Updating the workflow
- The workflow file is located at `.github/workflows/codeql.yml`.
- To modify the scope, edit the `paths` section.
- To add additional language packs, update the `languages` matrix.
