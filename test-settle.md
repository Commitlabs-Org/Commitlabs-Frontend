# Commitment Settlement Endpoint Test

## API Endpoint

### POST /api/commitments/[id]/settle

Settles a matured commitment and returns the final funds to the owner.

## Request Format

```json
{
  "callerAddress": "GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z" // optional
}
```

## Response Format

### Success Response (200)
```json
{
  "ok": true,
  "data": {
    "commitmentId": "test-id",
    "settlementAmount": "1000.50",
    "finalStatus": "SETTLED",
    "txHash": "abc123...",
    "reference": "TODO_CHAIN_CALL_SETTLE_COMMITMENT",
    "settledAt": "2026-02-26T11:30:00.000Z"
  }
}
```

### Error Responses

#### 400 - Bad Request (Non-mature commitment)
```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Commitment has not matured yet and cannot be settled."
  }
}
```

#### 409 - Conflict (Already settled)
```json
{
  "ok": false,
  "error": {
    "code": "CONFLICT", 
    "message": "Commitment has already been settled."
  }
}
```

#### 404 - Not Found
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Commitment not found."
  }
}
```

## Features Implemented

✅ **Maturity Validation**: Checks if commitment is expired/matured
✅ **Status Validation**: Prevents settling already settled commitments  
✅ **Rate Limiting**: Applied to prevent abuse
✅ **Request Validation**: Validates JSON and input parameters
✅ **Error Handling**: Proper error responses with appropriate status codes
✅ **Logging**: Comprehensive logging for settlement attempts
✅ **Standard Response Format**: Uses the shared API response format

## Settlement Logic

1. **Validate Request**: Check commitment ID and request body
2. **Fetch Commitment**: Get commitment details from blockchain
3. **Maturity Check**: Verify commitment can be settled (expired or matured)
4. **Status Check**: Ensure commitment isn't already settled
5. **Call Settlement**: Invoke `settle_commitment` on smart contract
6. **Return Result**: Provide settlement amount and transaction details

## TODO Items for Production

- [ ] Add comprehensive Stellar address validation
- [ ] Implement proper transaction fee handling
- [ ] Add settlement deadline checks beyond just expiration
- [ ] Implement settlement queue for high-volume scenarios
- [ ] Add settlement history tracking
- [ ] Implement settlement notification system
