# Unified API Response Contract Documentation

## Overview

This document describes the unified API response contract implemented across all CommitLabs API endpoints. The contract ensures consistent response formats, proper error handling, and request correlation tracking.

## Response Structure

### Success Response

All successful responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "correlationId": "string",
    "timestamp": "ISO 8601 string",
    "...": "additional metadata"
  }
}
```

**Fields:**
- `success`: Always `true` for successful responses
- `data`: The actual response payload (varies by endpoint)
- `meta`: Metadata object containing:
  - `correlationId`: Request correlation identifier for tracing
  - `timestamp`: ISO 8601 timestamp of response generation
  - Additional metadata fields as needed (pagination, totals, etc.)

### Error Response

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "correlationId": "string",
    "timestamp": "ISO 8601 string",
    "details": { ... }
  }
}
```

**Fields:**
- `success`: Always `false` for error responses
- `error`: Error object containing:
  - `code`: Machine-readable error code (see Error Codes section)
  - `message`: Human-readable error description
  - `correlationId`: Request correlation identifier
  - `timestamp`: ISO 8601 timestamp of error occurrence
  - `details`: Optional additional error context (omitted in production for sensitive errors)

## Correlation IDs

### Purpose

Correlation IDs help track requests across services and logs, enabling:
- Request tracing through the system
- Debugging distributed workflows
- Performance monitoring
- Error correlation

### Implementation

- **Generation**: 32-character hexadecimal string (16 bytes of entropy)
- **Extraction**: Priority order:
  1. `x-correlation-id` header
  2. `x-request-id` header (fallback)
  3. Auto-generated if neither present
- **Propagation**: Included in response headers and response body

### Usage Examples

**Client-side:**
```javascript
// Generate correlation ID for new request
const correlationId = crypto.randomUUID().replace(/-/g, '');

// Make request with correlation ID
const response = await fetch('/api/endpoint', {
  headers: {
    'x-correlation-id': correlationId,
    'content-type': 'application/json',
  },
});

// Extract correlation ID from response
const responseCorrelationId = response.headers.get('x-correlation-id');
```

**Server-side:**
```typescript
// Correlation ID automatically handled by withApiHandler
export const GET = withApiHandler(async (req, context, correlationId) => {
  // Use correlationId for logging
  logger.info('Processing request', { correlationId });
  
  return ok(data, undefined, 200, correlationId);
});
```

## Error Codes

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Malformed or invalid request |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (duplicate, state mismatch) |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `UNPROCESSABLE_ENTITY` | 422 | Well-formed but semantically invalid request |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `BAD_GATEWAY` | 502 | Upstream service failure |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `GATEWAY_TIMEOUT` | 504 | Upstream service timeout |

### Domain-Specific Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BLOCKCHAIN_CALL_FAILED` | 502 | Blockchain interaction failed |
| `BLOCKCHAIN_UNAVAILABLE` | 503 | Blockchain service unavailable |
| `NONCE_EXPIRED` | 400 | Authentication nonce expired |
| `SIGNATURE_INVALID` | 400 | Cryptographic signature verification failed |

## Implementation Guidelines

### Route Handler Pattern

All API routes must use the `withApiHandler` wrapper and follow this pattern:

```typescript
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok, fail } from '@/lib/backend/apiResponse';
import { ValidationError } from '@/lib/backend/errors';

export const GET = withApiHandler(async (req, context, correlationId) => {
  // 1. Extract and validate inputs
  const param = context.params.id;
  if (!param) {
    throw new ValidationError('Missing required parameter');
  }

  // 2. Process request
  const result = await processRequest(param);

  // 3. Return unified response
  return ok(result, undefined, 200, correlationId);
});
```

### Response Helpers

#### Success Responses

```typescript
// Basic success response
return ok(data, undefined, 200, correlationId);

// Success with custom status
return ok(data, undefined, 201, correlationId);

// Success with metadata
return ok(data, { total: 42, page: 1 }, 200, correlationId);

// Success with status as second parameter
return ok(data, 201, undefined, correlationId);
```

#### Error Responses

```typescript
// Let withApiHandler handle ApiError subclasses
throw new ValidationError('Invalid input', { field: 'email' });

// Manual error response (rarely needed)
return fail('VALIDATION_ERROR', 'Invalid input', { field: 'email' }, 400, correlationId);
```

### Error Handling Strategy

1. **Validation Errors**: Use `ValidationError` subclass
2. **Authentication Errors**: Use `UnauthorizedError` subclass
3. **Authorization Errors**: Use `ForbiddenError` subclass
4. **Not Found**: Use `NotFoundError` subclass
5. **Conflicts**: Use `ConflictError` subclass
6. **Rate Limiting**: Use `TooManyRequestsError` subclass
7. **Unknown Errors**: Let `withApiHandler` handle automatically

## Migration Guide

### Before (Mixed Patterns)

```typescript
// Old pattern 1: NextResponse.json
return NextResponse.json({ data: result }, { status: 200 });

// Old pattern 2: Custom response shape
return Response.json({
  success: true,
  payload: result,
  metadata: { timestamp: new Date() }
});

// Old pattern 3: Manual error handling
return Response.json({
  error: 'Something went wrong',
  code: 'ERROR_500'
}, { status: 500 });
```

### After (Unified Contract)

```typescript
// New unified pattern
export const GET = withApiHandler(async (req, context, correlationId) => {
  const result = await getData();
  return ok(result, undefined, 200, correlationId);
});

// Errors handled automatically
export const POST = withApiHandler(async (req, context, correlationId) => {
  if (!req.body) {
    throw new ValidationError('Request body required');
  }
  // ... processing
});
```

## Testing Guidelines

### Unit Testing Response Contract

```typescript
import { ok, fail, getCorrelationId } from '@/lib/backend/apiResponse';

describe('Response Contract', () => {
  it('should create proper success response', () => {
    const correlationId = 'test-123';
    const response = ok({ data: 'test' }, undefined, 200, correlationId);
    
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);
    
    return response.json().then(json => {
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ data: 'test' });
      expect(json.meta.correlationId).toBe(correlationId);
    });
  });
});
```

### Integration Testing Routes

```typescript
describe('API Contract Compliance', () => {
  it('should follow contract for GET /api/endpoint', async () => {
    const req = new NextRequest('http://localhost:3000/api/endpoint', {
      headers: { 'x-correlation-id': 'test-456' }
    });
    
    const response = await GET(req, { params: {} }, 'test-456');
    
    expect(response.headers.get('x-correlation-id')).toBe('test-456');
    
    const json = await response.json();
    expect(json).toHaveProperty('success');
    expect(json).toHaveProperty('meta.correlationId', 'test-456');
    expect(json).toHaveProperty('meta.timestamp');
  });
});
```

## Security Considerations

### Error Information Leakage

- **Production**: Error details omitted for security-sensitive errors
- **Development**: Full error details included for debugging
- **Logging**: All errors logged with correlation IDs for internal tracking

### Correlation ID Security

- **Client-Generated**: Accept client-provided correlation IDs but validate format
- **Server-Generated**: Use cryptographically secure random generation
- **Header Injection**: Sanitize correlation ID extraction to prevent header injection

### Response Header Security

- **Correlation Headers**: Always included in responses for tracing
- **Security Headers**: Maintained alongside correlation headers
- **CORS**: Consider correlation ID implications for cross-origin requests

## Performance Considerations

### Correlation ID Overhead

- **Generation**: Minimal overhead using Node.js crypto.randomBytes()
- **Header Processing**: Negligible impact on request processing
- **Memory**: Correlation IDs are short-lived strings

### Response Serialization

- **Consistent Structure**: Predictable JSON serialization performance
- **Metadata Size**: Keep metadata minimal for better performance
- **Timestamp Format**: ISO 8601 strings are efficient and standardized

## Monitoring and Observability

### Metrics to Track

1. **Response Contract Compliance**: Percentage of responses following contract
2. **Correlation ID Propagation**: Success rate of correlation ID tracking
3. **Error Code Distribution**: Frequency of different error types
4. **Response Times**: Performance impact of unified contract

### Logging Integration

```typescript
// Enhanced logging with correlation ID
logger.info('Request completed', {
  correlationId,
  endpoint: '/api/commitments',
  duration: Date.now() - startTime,
  statusCode: response.status,
});

// Error logging with full context
logger.error('Request failed', error, {
  correlationId,
  endpoint: '/api/commitments',
  statusCode: error.statusCode,
  errorCode: error.code,
});
```

## Best Practices

### Do's

- ✅ Always use `withApiHandler` for route handlers
- ✅ Include correlation ID in all responses
- ✅ Use appropriate `ApiError` subclasses
- ✅ Keep error messages user-friendly
- ✅ Add timestamps to all responses
- ✅ Test both success and error scenarios

### Don'ts

- ❌ Return raw `NextResponse.json()` objects
- ❌ Create custom response shapes
- ❌ Expose internal error details to clients
- ❌ Skip correlation ID propagation
- ❌ Mix response patterns within the same API
- ❌ Ignore error handling best practices

## Troubleshooting

### Common Issues

1. **Missing Correlation ID**: Check `withApiHandler` usage
2. **Inconsistent Response Format**: Ensure all routes use `ok()`/`fail()` helpers
3. **Error Not Propagating**: Verify `ApiError` subclass usage
4. **Header Not Set**: Check response helper function calls

### Debug Mode

Enable debug logging for response contract issues:

```bash
DEBUG=api-response:* npm run dev
```

This will provide detailed logging for:
- Correlation ID generation/extraction
- Response contract validation
- Error handling flow
- Header processing

## Future Enhancements

### Planned Improvements

1. **Response Validation**: Automatic contract validation middleware
2. **Enhanced Metadata**: Structured metadata schemas per endpoint
3. **Correlation Context**: Extended correlation context for distributed tracing
4. **Performance Metrics**: Built-in response time tracking
5. **API Documentation**: Auto-generated OpenAPI specs from contract

### Extensibility

The unified contract is designed to be extensible:
- New metadata fields can be added without breaking changes
- Additional error codes can be introduced as needed
- Correlation ID format can evolve while maintaining compatibility
- Response helpers can be extended for specialized use cases

## Conclusion

The unified API response contract provides a consistent, secure, and maintainable foundation for all CommitLabs API endpoints. By following this contract, developers ensure:

- **Consistency**: Predictable response formats across all endpoints
- **Observability**: Complete request tracing with correlation IDs
- **Security**: Proper error handling without information leakage
- **Maintainability**: Centralized response logic and error handling
- **Testing**: Comprehensive test coverage for response patterns

This contract serves as the foundation for reliable API communication and enables robust monitoring, debugging, and maintenance of the CommitLabs platform.
