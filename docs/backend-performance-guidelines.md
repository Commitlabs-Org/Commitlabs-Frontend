# Backend Performance Guidelines

This document establishes clear technical standards for backend performance, including acceptable endpoint latency, payload sizes, and optimal polling frequencies. These guidelines apply to all REST and GraphQL endpoints within the CommitLabs ecosystem.

## 1. Latency Standards

| Operation Type | Threshold | Rationale |
| :--- | :--- | :--- |
| **CRUD Operations** | < 200ms | Standard user interactions (Create, Read, Update, Delete) must feel instantaneous to ensure a smooth user experience and reduce perceived wait times. |
| **Complex Queries** | < 500ms | Aggregations, joins across multiple tables, or heavy filtering may take longer but should remain sub-second to maintain application responsiveness. |
| **Batch Operations** | < 2s | Processing multiple records or generating reports is expected to be slower. If an operation exceeds 2s, it should be offloaded to a background job. |

*Note: Latency is measured as Time to First Byte (TTFB) + Content Download Time from the server's perspective.*

## 2. Payload Size Limits

| Payload Type | Maximum Size | Rationale |
| :--- | :--- | :--- |
| **Standard API Requests/Responses** | 1 MB | Large JSON payloads increase parsing time, memory usage, and network transfer time on both client and server. |
| **File Uploads** | 10 MB | Direct uploads should be limited to prevent server blocking. For larger files, use presigned URLs to upload directly to object storage (e.g., S3). |

### Best Practices for Payloads
*   **Pagination**: Always implement pagination for list endpoints. Default page size should be 20-50 items.
*   **Field Selection**: Allow clients to request only necessary fields (e.g., GraphQL or sparse fieldsets in REST) to reduce payload size.
*   **Compression**: Ensure GZIP/Brotli compression is enabled for all text-based responses.

## 3. Polling Frequency Recommendations

| Use Case | Recommended Frequency | Rationale |
| :--- | :--- | :--- |
| **Real-time Updates** | 1-5 seconds | Critical status changes (e.g., payment processing, live tracking) require near real-time feedback. Prefer WebSockets/SSE over polling if possible. |
| **Dashboard Refreshes** | 30-60 seconds | General analytics and overview data do not change rapidly enough to warrant frequent polling, reducing unnecessary server load. |
| **Bulk Data Sync** | 5-15 minutes | Background synchronization processes should be spaced out to avoid server congestion and database contention. |

### Optimization Strategy
*   **Exponential Backoff**: Implement exponential backoff for polling when the state hasn't changed or errors occur.
*   **E-Tags / Last-Modified**: Use conditional requests (If-None-Match, If-Modified-Since) to avoid downloading data that hasn't changed.

## 4. Implementation Examples

### REST API Example (Node.js/Express)

```javascript
// Good: Pagination, Field Selection, and Timeout Handling
app.get('/api/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Enforce max limit
  const fields = req.query.fields ? req.query.fields.split(',') : null;

  try {
    const users = await db.users.find({}, {
      skip: (page - 1) * limit,
      limit: limit,
      projection: fields // Only select requested fields
    }).maxTimeMS(500); // Set query timeout

    res.json({
      data: users,
      meta: { page, limit }
    });
  } catch (error) {
    res.status(500).json({ error: 'Query timeout or database error' });
  }
});
```

### GraphQL Example

```graphql
# Good: Complexity Limits and Pagination
type Query {
  users(first: Int = 20, after: String): UserConnection!
}

# Avoid deeply nested queries that can cause N+1 problems.
# Use DataLoader to batch and cache database requests.
```

## 5. Monitoring Requirements

All services must emit metrics to be monitored by the observability platform (e.g., Prometheus, Datadog).

*   **Key Metrics**:
    *   `http_request_duration_seconds`: Histogram of response times (P50, P90, P95, P99).
    *   `http_requests_total`: Counter of requests by status code and endpoint.
    *   `http_response_size_bytes`: Histogram of response sizes.
*   **Alerting**:
    *   **P95 Latency**: Alert if P95 latency exceeds the defined threshold for > 5 minutes.
    *   **Error Rate**: Alert if 5xx error rate > 1% for > 5 minutes.

## 6. Performance Testing Methodologies

*   **Load Testing**: Use tools like k6 or JMeter to simulate expected peak traffic.
*   **Stress Testing**: Determine the breaking point of the system by increasing load until failure.
*   **Automated Checks**: Integrate performance tests into the CI/CD pipeline. Fails build if latency thresholds are exceeded.

## 7. Escalation Procedures

If a service consistently violates performance guidelines:

1.  **Incident Creation**: Automated alert triggers an incident ticket (Severity determined by impact).
2.  **Investigation**: The owning team must investigate within 2 business days.
3.  **Remediation Plan**: A plan to fix the issue (e.g., caching, database indexing, code refactoring) must be proposed within 1 week.
4.  **Critical Violations**: If P99 latency exceeds 3x the threshold, it may block future deployments until resolved.

## 8. Review Process for Exceptions

Exceptions to these guidelines must be approved by the Architecture Review Board.

*   **Request Process**: Submit a "Performance Exception Request" document detailing:
    *   Reason for exception (e.g., legacy system limitation, extremely complex computation).
    *   Impact analysis on system resources and user experience.
    *   Proposed mitigation (e.g., aggressive caching, async processing).
    *   Timeline for compliance or permanent waiver justification.
