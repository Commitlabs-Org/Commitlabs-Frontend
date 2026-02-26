# Stellar Wallet Authentication Test

This document demonstrates how to test the Stellar wallet authentication flow.

## API Endpoints

### 1. Get Nonce
```
POST /api/auth/nonce
Content-Type: application/json

{
  "address": "GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "nonce": "a39ae240bfa1af0fee7c610cc37a6fa2",
    "message": "Sign in to CommitLabs: a39ae240bfa1af0fee7c610cc37a6fa2",
    "expiresAt": "2026-02-26T11:16:29.123Z"
  }
}
```

### 2. Verify Signature
```
POST /api/auth/verify
Content-Type: application/json

{
  "address": "GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z",
  "message": "Sign in to CommitLabs: a39ae240bfa1af0fee7c610cc37a6fa2",
  "signature": "SIGNATURE_FROM_WALLET"
}
```

**Success Response:**
```json
{
  "ok": true,
  "data": {
    "verified": true,
    "address": "GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z",
    "message": "Signature verified successfully",
    "sessionToken": "session_GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z_1740566185123",
    "sessionType": "placeholder"
  }
}
```

## Testing with Freighter

1. **Get a nonce** using the first endpoint
2. **Sign the message** using Freighter wallet:
   ```javascript
   const result = await window.freighter.signMessage(message);
   const signature = result.signature;
   ```
3. **Verify the signature** using the second endpoint

## Security Features

- **Rate limiting** on both endpoints
- **Nonce expiration** (5 minutes)
- **One-time use nonces** (consumed after verification)
- **Message format validation**
- **Address-to-nonce binding**

## TODO Items

- [ ] Replace in-memory nonce storage with Redis/database
- [ ] Implement proper JWT session tokens
- [ ] Add Stellar address format validation
- [ ] Add comprehensive logging
- [ ] Implement session management endpoints
- [ ] Add CSRF protection for session-based auth
