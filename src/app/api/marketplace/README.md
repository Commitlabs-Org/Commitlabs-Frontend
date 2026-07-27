# Marketplace API Endpoints

## Featured Listings

**GET** `/api/marketplace/featured`

Returns a deterministic curated subset of public marketplace listings for the
featured marketplace carousel.

### Selection Rules

- Only listings with `complianceScore >= 85`
- Only listings with `maxLoss <= 8`
- Ordered by `complianceScore` descending, then `currentYield` descending, then
  `price` ascending, then `listingId` ascending
- Limited to `4` listings

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "listings": [
      {
        "listingId": "LST-001",
        "commitmentId": "CMT-001",
        "type": "Safe",
        "amount": 50000,
        "remainingDays": 25,
        "maxLoss": 2,
        "currentYield": 5.2,
        "complianceScore": 95,
        "price": 52000
      }
    ],
    "total": 1
  }
}
```

### Response Headers

- `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`
- Standard API security headers via `attachSecurityHeaders`

### Error Responses

- **429 Too Many Requests**: Request rate limit exceeded

---

## Create Listing

**POST** `/api/marketplace/listings`

Create a new marketplace listing for a Commitment NFT.

### Request Body

```json
{
  "commitmentId": "commitment_123",
  "price": "1000.50",
  "currencyAsset": "USDC",
  "sellerAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "listing": {
      "id": "listing_1_1234567890",
      "commitmentId": "commitment_123",
      "price": "1000.50",
      "currencyAsset": "USDC",
      "sellerAddress": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "status": "Active",
      "createdAt": "2026-02-25T10:00:00.000Z",
      "updatedAt": "2026-02-25T10:00:00.000Z"
    }
  }
}
```

### Error Responses

- **400 Bad Request**: Invalid input data
- **409 Conflict**: Commitment is already listed

---

## Cancel Listing

**DELETE** `/api/marketplace/listings/[id]`

Cancel an existing marketplace listing. The caller must be the listing's seller, authenticated via a Bearer session token — the seller address is derived from the token, not supplied by the client.

### URL Parameters

- `id`: Listing ID (required)

### Headers

- `Authorization: Bearer <sessionToken>` (required) — the seller's address is derived from this token via `verifySessionToken`. There is no `sellerAddress` query parameter; any such parameter is ignored.
- A valid CSRF token is required on this mutation (see `assertMutationCsrf`), consistent with other mutating marketplace endpoints.

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "listingId": "listing_1_1234567890",
    "cancelled": true,
    "message": "Listing cancelled successfully"
  }
}
```

### Error Responses

- **400 Bad Request**: Missing listing ID
- **401 Unauthorized**: Missing/malformed `Authorization` header, or an invalid/expired session token
- **403 Forbidden**: The authenticated session's address does not match the listing's `sellerAddress`
- **404 Not Found**: Listing not found
- **409 Conflict**: Listing is not active

### Example

```bash
curl -X DELETE "https://<host>/api/marketplace/listings/listing_1_1234567890" \
  -H "Authorization: Bearer <sessionToken>" \
  -H "X-CSRF-Token: <csrfToken>"
```

---

## Marketplace Stats

**GET** `/api/marketplace/stats`

Returns aggregate statistics for the marketplace for use in header KPIs and analytics.

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "activeListings": 6,
    "averageYield": 12.43,
    "medianPrice": 130000,
    "typeBreakdown": {
      "Safe": 2,
      "Balanced": 2,
      "Aggressive": 2
    }
  }
}
```

### Metrics Definitions

- **activeListings**: Total number of active listings currently on the marketplace.
- **averageYield**: The arithmetic mean of `currentYield` across all active listings.
- **medianPrice**: The middle price value among all active listings, ensuring outliers don't skew the KPI.
- **typeBreakdown**: Count of listings categorized by commitment type (Safe, Balanced, Aggressive).

### Performance

- **Cacheable**: Includes `Cache-Control` headers (`public, s-maxage=60, stale-while-revalidate=30`) for high performance and low origin load.
- **Rate Limited**: Protected by IP-based rate limiting to prevent abuse.

---

## Marketplace Stats

**GET** `/api/marketplace/stats`

Returns aggregate statistics for the marketplace for use in header KPIs and analytics.

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "activeListings": 6,
    "averageYield": 12.43,
    "medianPrice": 130000,
    "typeBreakdown": {
      "Safe": 2,
      "Balanced": 2,
      "Aggressive": 2
    }
  }
}
```

### Metrics Definitions

- **activeListings**: Total number of active listings currently on the marketplace.
- **averageYield**: The arithmetic mean of `currentYield` across all active listings.
- **medianPrice**: The middle price value among all active listings, ensuring outliers don't skew the KPI.
- **typeBreakdown**: Count of listings categorized by commitment type (Safe, Balanced, Aggressive).

### Performance

- **Cacheable**: Includes `Cache-Control` headers (`public, s-maxage=60, stale-while-revalidate=30`) for high performance and low origin load.
- **Rate Limited**: Protected by IP-based rate limiting to prevent abuse.

---

## Implementation Notes

- Currently uses in-memory stub storage
- Will be replaced with actual Soroban smart contract calls
- All responses follow the standard API response format
- Input validation is performed at both the endpoint and service layers
- Proper error handling with typed error classes
