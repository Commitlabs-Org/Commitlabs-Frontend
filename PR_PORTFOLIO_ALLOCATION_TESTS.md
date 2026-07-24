# PR Title

Add tests for portfolio allocation utilities

# PR Body

## Summary

- Adds Vitest coverage for portfolio allocation grouping by risk profile and asset.
- Verifies fallback handling for unknown risk profiles, missing assets, and non-numeric amounts.
- Covers asset color palette cycling and allocation value formatting.

## Tests

- `corepack pnpm exec vitest run src/utils/__tests__/portfolioAllocation.test.ts`
