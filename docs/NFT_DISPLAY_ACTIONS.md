# NFT Display Actions

## Overview

The `NFTDisplay` component has been enhanced with metadata refresh and token ID copy capabilities, allowing users to:
- Refresh stale NFT metadata
- Copy the token ID to clipboard for use in explorers or support requests
- Fall back to a placeholder if the NFT image fails to load
- Access all actions via keyboard

## New/Updated Files

### `src/hooks/useNftMetadata.ts`
React hook that handles fetching NFT metadata from a given URL:
- `metadata`: Fetched metadata object
- `isLoading`: Loading state boolean
- `error`: Error message string if fetch fails
- `refresh`: Function to trigger a re-fetch

### `src/components/NFTDisplay.tsx`
Updated component with:
- NFT image display with fallback to placeholder on error
- Token ID section with copy button
- Metadata refresh button with loading state
- Error display for failed metadata fetches
- Accessible buttons with focus rings

### `src/components/__tests__/NFTDisplay.test.tsx`
Comprehensive test suite covering:
- Basic rendering
- Token ID copy functionality (success and failure)
- Metadata refresh
- Loading and error states
- Image fallback

## Usage

```tsx
import NFTDisplay from '@/components/NFTDisplay';

function MyComponent() {
  return (
    <NFTDisplay
      tokenId="your-token-id"
      metadata={{ name: 'My NFT' }}
      metadataUrl="https://example.com/metadata.json"
      imageUrl="https://example.com/nft-image.png"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tokenId` | `string` | - | **Required** - The NFT's token ID |
| `metadata` | `Record<string, unknown>` | `undefined` | Optional initial metadata to display (if not provided, will fetch from `metadataUrl`) |
| `metadataUrl` | `string` | `undefined` | URL to fetch metadata from |
| `imageUrl` | `string` | `undefined` | URL of the NFT image to display |

## Features

### Refresh Metadata
- Click the "Refresh Metadata" button to re-fetch the metadata
- Shows a loading spinner while fetching
- Displays a success toast on completion
- Shows an error message if fetching fails
- Disabled when no `metadataUrl` is provided

### Copy Token ID
- Click the copy button next to the token ID to copy to clipboard
- Shows a success toast when copied
- Shows an error toast if copying fails
- Accessible via keyboard

### Broken Image Fallback
- If the NFT image fails to load, falls back to a Commitment NFT placeholder
- Prevents broken image icons from being displayed

## Accessibility
- All buttons have proper ARIA labels
- Focus indicators are visible when navigating via keyboard
- Loading states are clearly indicated
