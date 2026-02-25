# Marketplace API Endpoints

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

**DELETE** `/api/marketplace/listings/[id]?sellerAddress=GXXX...`

Cancel an existing marketplace listing.

### URL Parameters

- `id`: Listing ID (required)

### Query Parameters

- `sellerAddress`: Address of the seller (required)

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

- **400 Bad Request**: Missing required parameters or invalid seller
- **404 Not Found**: Listing not found
- **409 Conflict**: Listing is not active

---

## Implementation Notes

- Currently uses in-memory stub storage
- Will be replaced with actual Soroban smart contract calls
- All responses follow the standard API response format
- Input validation is performed at both the endpoint and service layers
- Proper error handling with typed error classes
