# Marketplace Saved Searches

This feature allows users to:
- Persist marketplace filter state in the URL
- Save and manage named search presets

## URL Parameters Schema

The marketplace page uses the following URL query parameters:

| Parameter           | Type                          | Example                        | Description                                  |
|---------------------|-------------------------------|--------------------------------|----------------------------------------------|
| `sortBy`            | string                        | `sortBy=compliance`            | Sort order                                   |
| `commitmentType`    | comma-separated string        | `commitmentType=balanced,safe` | Selected commitment types                    |
| `priceRange`        | comma-separated numbers       | `priceRange=0,500000`          | Min and max price range                      |
| `durationRange`     | comma-separated numbers       | `durationRange=0,60`           | Min and max duration remaining (days)        |
| `minCompliance`     | number                        | `minCompliance=80`             | Minimum compliance score                     |
| `maxLoss`           | number                        | `maxLoss=50`                   | Maximum loss threshold                       |

## User Preferences API

Saved searches are stored in the user's preferences under the `savedMarketplaceSearches` key.

### Schema

```typescript
interface SavedSearch {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string; // ISO 8601 date string
}

interface Filters {
  sortBy: string;
  commitmentType: ('balanced' | 'aggressive' | 'conservative')[];
  priceRange: [number, number];
  durationRange: [number, number];
  minCompliance: number;
  maxLoss: number;
}
```

### API Endpoint

Use the existing `/api/user/preferences` endpoint:

**GET** `/api/user/preferences` - Retrieve saved searches along with other preferences
**PUT** `/api/user/preferences` - Save or update saved searches

#### Example PUT Request

```json
{
  "savedMarketplaceSearches": [
    {
      "id": "1234567890",
      "name": "Low Risk",
      "filters": {
        "sortBy": "compliance",
        "commitmentType": ["conservative", "balanced"],
        "priceRange": [0, 1000000],
        "durationRange": [0, 90],
        "minCompliance": 80,
        "maxLoss": 10
      },
      "createdAt": "2026-06-28T00:00:00.000Z"
    }
  ]
}
```

## Duplicate Names Handling

When saving a search with a name that already exists, the existing search with that name is overwritten.

## Hooks

### `useMarketplaceFilters`

Located in `src/hooks/useMarketplaceFilters.ts`:

- Automatically serializes filters to URL on change
- Hydrates filters from URL on initial load
- Handles malformed/invalid parameters gracefully (falls back to defaults)
- Exports:
  - `filters`: Current filter state
  - `updateFilters`: Function to update filters and URL
  - `resetFilters`: Reset to default filters

## Components

### `SavedSearches`

Located in `src/components/MarketplaceFilter/SavedSearches.tsx`:

- "Save this search" button that expands to name input
- Dropdown/list of saved searches
- Apply saved search functionality
- Delete saved search functionality
- Integrated with user preferences API
