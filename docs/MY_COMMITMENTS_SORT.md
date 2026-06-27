# My Commitments Sorting Feature

## Overview
This feature adds sorting capabilities to the My Commitments grid, allowing users to order their commitments by various criteria.

## Sort Options
- **Newest**: Sort by creation date (newest first)
- **Oldest**: Sort by creation date (oldest first)
- **Value High → Low**: Sort by commitment amount (highest first)
- **Value Low → High**: Sort by commitment amount (lowest first)
- **Maturity Soonest**: Sort by days remaining (soonest first)
- **Maturity Latest**: Sort by days remaining (latest first)
- **Compliance High → Low**: Sort by compliance score (highest first)
- **Compliance Low → High**: Sort by compliance score (lowest first)
- **Yield High → Low**: Sort by change percentage (highest first)
- **Yield Low → High**: Sort by change percentage (lowest first)

## Files Modified/Added
- `src/utils/sortCommitments.ts`: Contains sorting logic
- `src/utils/__tests__/sortCommitments.test.ts`: Tests for sorting function
- `src/components/MyCommitmentsFilters/SortMenu.tsx`: Sort menu component
- `src/components/MyCommitmentsFilters/MyCommitmentsFilters.tsx`: Updated to use SortMenu
- `src/components/MyCommitmentsOverview/MyCommitmentsOverview.tsx`: Updated types
- `src/app/commitments/page.tsx`: Integrated sorting
- `docs/MY_COMMITMENTS_SORT.md`: This documentation

## Usage
The sorting is applied after filtering and is persistent for the session. The active sort is reflected in the UI and accessible via aria attributes.
