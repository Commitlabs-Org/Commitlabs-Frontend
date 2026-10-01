# Session Implementation Documentation

## Overview

This document describes the secure cookie-based session management system implemented for CommitLabs. The system uses random opaque session tokens delivered via HTTP-only cookies with CSRF protection for web-based authentication.

## Architecture

### Session Flow

1. **Authentication Request**: Client sends Stellar signature verification request to `/api/auth/verify`
2. **Signature Verification**: Server validates the signature and nonce
3. **Session Creation**: Server generates a random opaque session token and associates it with a newly generated CSRF token and user metadata in a server-side in-memory session store.
4. **Cookie Setting**: Server sets secure HTTP-only session cookie and non-HttpOnly CSRF cookie
5. **Authenticated Requests**: Client includes session cookie automatically and CSRF token in headers for state-changing requests
6. **Session Validation**: Server validates the opaque token against the in-memory store and verifies the CSRF token for protected routes
7. **Session Termination**: Client can logout via `/api/auth/logout` to revoke session

### Security Features

#### Opaque Session Tokens

- **Format**: 16-byte random hex string prefixed with `session_`
- **Expiry**: 24 hours
- **Storage**: Server-side in-memory `Map` containing user address, issued timestamp, expiry timestamp, and CSRF token.
- **Revocation**: Removed from the in-memory store upon logout.
- **Limitation (Known Issue)**: The current session store is strictly in-memory (`sessionStoreMap`) and does not support cross-instance persistence. This limitation is tracked in an existing issue. A multi-instance production deployment currently requires sticky sessions or will drop sessions on request routing changes.

#### Cookie Security

- **Session Cookie**: HTTP-only, Secure (production), SameSite=Lax, 24-hour expiry
- **CSRF Cookie**: Non-HttpOnly, Secure (production), SameSite=Lax, 24-hour expiry
- **Path**: `/` (site-wide availability)

#### CSRF Protection

- **Synchronizer Token Pattern**: CSRF token stored in server-side session and mirrored in header
- **Double-Submit Cookie Pattern**: CSRF token available in non-HttpOnly cookie
- **Origin Validation**: Additional defense-in-depth with Origin/Referer header checks

## Implementation Details

### Core Functions

#### `createSessionToken(address: string)`

Generates an opaque session token and stores session context (including CSRF token) in the server-side store.

```typescript
const token = createSessionToken(address);
```

**Returns**: The opaque session token (string)

#### `verifySessionToken(token: string)`

Validates the opaque token against the session store and returns session information.

```typescript
const result = verifySessionToken(token);
// result.valid, result.address, result.csrfToken, result.error
```

**Returns**: SessionVerificationResult with validity status and user data

#### `revokeSession(token: string)`

Revokes a session token for logout functionality, clearing it from the in-memory store.

```typescript
const revoked = revokeSession(token);
```

**Returns**: Boolean indicating successful revocation

### Authentication Middleware

#### `requireAuth(req: NextRequest)`

Middleware function for protecting routes that extracts and validates session cookies against the store.

```typescript
const authenticatedReq = requireAuth(req);
// authenticatedReq.user.address, authenticatedReq.user.csrfToken
```

**Throws**: UnauthorizedError for invalid/missing sessions

#### `validateCsrfToken(req: NextRequest, expectedCsrfToken: string)`

Validates CSRF token for state-changing requests (POST, PUT, PATCH, DELETE).

```typescript
validateCsrfToken(req, expectedCsrfToken);
```

**Throws**: UnauthorizedError for missing/invalid CSRF tokens

#### `validateOrigin(req: NextRequest)`

Validates Origin/Referer headers for additional CSRF protection.

```typescript
validateOrigin(req);
```

**Throws**: UnauthorizedError for cross-origin requests

## API Endpoints

### POST /api/auth/verify

Authenticates user via Stellar signature and creates session.

**Request Body**:

```json
{
  "address": "G...",
  "signature": "signature-hex",
  "message": "Sign in to CommitLabs: nonce"
}
```

**Response**:

```json
{
  "verified": true,
  "address": "G...",
  "message": "Signature verified successfully",
  "csrfToken": "csrf-token-hex"
}
```

**Cookies Set**:

- `session`: HTTP-only opaque token (24 hours)
- `csrf`: Non-HttpOnly CSRF token (24 hours)

### POST /api/auth/logout

Terminates user session and clears cookies.

**Headers**: Requires valid session cookie

**Response**:

```json
{
  "loggedOut": true,
  "message": "Session terminated successfully"
}
```

**Cookies Cleared**: Both session and CSRF cookies

## Usage Examples

### Protected Route Implementation

```typescript
import { requireAuth, validateCsrfToken, validateOrigin } from '@/lib/backend/requireAuth';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  // Authenticate user
  const authenticatedReq = requireAuth(req);

  // Validate CSRF for state-changing requests
  validateCsrfToken(req, authenticatedReq.user.csrfToken);

  // Additional origin validation
  validateOrigin(req);

  // Process authenticated request
  const userAddress = authenticatedReq.user.address;

  return NextResponse.json({
    message: 'Action completed successfully',
    user: userAddress,
  });
};
```

### Client-Side Usage

```javascript
// After successful authentication
const response = await fetch('/api/auth/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    address,
    signature,
    message,
  }),
});

// For subsequent authenticated requests
const protectedResponse = await fetch('/api/protected-route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken(), // Get from cookie or response
  },
  body: JSON.stringify(data),
});
```

## Security Considerations

### Production Deployment

1. **HTTPS**: Ensure all cookies are marked Secure (automatic in production)
2. **Session Store**: Replace in-memory store with Redis/database for scalability (pending issue fix)
3. **Rate Limiting**: Implement rate limiting on authentication endpoints
4. **Monitoring**: Log authentication failures and suspicious activity

### Threat Mitigations

#### Session Hijacking

- HTTP-only cookies prevent JavaScript access
- SameSite=Lax (with double constraints) prevents cross-site request forgery
- Secure flag ensures HTTPS-only transmission
- 24-hour expiry limits exposure window

#### CSRF Attacks

- Synchronizer token pattern requires server-managed token
- Origin validation provides additional protection
- Double-submit cookie pattern for client-side access

#### Token Replay

- Session records include issued timestamp and expiry
- Server-side map for immediate logout
- Nonce consumption prevents signature replay

#### Cross-Origin Attacks

- SameSite=Lax and CSRF tokens prevent cross-site action execution
- Origin/Referer header validation
- Host header validation in production

## Testing

### Test Coverage Areas

1. **Session Token Creation/Verification**
   - Valid token generation
   - Token validation
   - Expired token handling
   - Invalid token rejection
   - Token revocation

2. **Authentication Middleware**
   - Valid session authentication
   - Missing session rejection
   - Invalid session rejection
   - CSRF token validation
   - Origin validation

3. **API Endpoints**
   - Successful authentication
   - Invalid signature handling
   - Malformed request handling
   - Logout functionality

### Running Tests

```bash
# Run all session-related tests
npm test -- auth

# Run with coverage
npm run test:coverage -- auth
```

## Migration Guide

### From Placeholder Implementation

1. **Update Client Code**: Remove handling of `sessionToken` in response body
2. **Cookie Handling**: Ensure browser automatically includes session cookie
3. **CSRF Implementation**: Add CSRF token to headers for state-changing requests
4. **Error Handling**: Update error handling for 401/403 responses

### Environment Variables

```bash
# Optional (defaults to secure settings in production)
NODE_ENV=production
```

## Future Enhancements

### Planned Improvements

1. **Refresh Tokens**: Implement token rotation without requiring re-authentication
2. **Session Analytics**: Track session patterns and anomalies
3. **Multi-Device Support**: Allow multiple simultaneous sessions per user
4. **Session Persistence**: Database-backed session storage for persistence across restarts
5. **Advanced CSRF**: Implement more sophisticated CSRF protection mechanisms

### Scalability Considerations

1. **Horizontal Scaling**: Redis-based session store for multiple server instances (crucial current gap)
2. **Load Balancing**: Ensure session affinity or shared session store
3. **Caching**: Implement session caching for high-traffic scenarios
4. **Monitoring**: Add metrics for session creation, validation, and revocation

## Troubleshooting

### Common Issues

1. **Token Verification Fails**: The in-memory store doesn't persist across restarts or multiple server instances.
2. **CSRF Validation Fails**: Ensure client includes X-CSRF-Token header
3. **Cookie Not Set**: Verify SameSite and Secure settings match environment
4. **Session Expires Too Soon**: Check server time synchronization

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=session:* npm run dev
```

This will provide detailed logging for session operations without exposing sensitive data.
