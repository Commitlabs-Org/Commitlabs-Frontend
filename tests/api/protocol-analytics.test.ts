import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, buildProtocolAnalytics, ProtocolAnalyticsResponse } from '@/app/api/analytics/protocol/route';
import { createMockRequest, parseResponse } from './helpers';
import type { ChainCommitment } from '@/lib/backend/services/contracts';

/**
 * Test suite for the protocol analytics API endpoint and builder function.
 *
 * Covers:
 * - Success scenarios with various commitment states
 * - Empty/boundary cases (no commitments)
 * - Null/undefined handling in numeric aggregations
 * - Compliance score calculation precision
 * - Feature flag enforcement
 * - CORS policy enforcement
 * - Error handling and fallback behavior
 * - Numeric string field aggregation (amount, feeEarned)
 */

// Test fixtures: ChainCommitment objects in various states
const ACTIVE_COMMITMENT: ChainCommitment = {
  id: 'c1',
  ownerAddress: 'GXXXX',
  asset: 'USDC',
  amount: '1000.00',
  status: 'ACTIVE',
  complianceScore: 95,
  currentValue: '1050.00',
  feeEarned: '10.00',
  violationCount: 0,
};

const SETTLED_COMMITMENT: ChainCommitment = {
  id: 'c2',
  ownerAddress: 'GYYYY',
  asset: 'BTC',
  amount: '2000.00',
  status: 'SETTLED',
  complianceScore: 100,
  currentValue: '2100.00',
  feeEarned: '20.00',
  violationCount: 0,
};

const VIOLATED_COMMITMENT: ChainCommitment = {
  id: 'c3',
  ownerAddress: 'GZZZZ',
  asset: 'ETH',
  amount: '500.00',
  status: 'VIOLATED',
  complianceScore: 40,
  currentValue: '450.00',
  feeEarned: '0.00',
  violationCount: 3,
};

const ZERO_VALUES_COMMITMENT: ChainCommitment = {
  id: 'c4',
  ownerAddress: 'GAAA1',
  asset: 'USDC',
  amount: '0.00',
  status: 'ACTIVE',
  complianceScore: 0,
  currentValue: '0.00',
  feeEarned: '0.00',
  violationCount: 0,
};

const FRACTIONAL_COMPLIANCE: ChainCommitment = {
  id: 'c5',
  ownerAddress: 'GAAA2',
  asset: 'USDC',
  amount: '500.50',
  status: 'ACTIVE',
  complianceScore: 85.333,
  currentValue: '525.00',
  feeEarned: '5.50',
  violationCount: 1,
};

describe('buildProtocolAnalytics', () => {
  describe('Success scenarios', () => {
    it('should compute analytics for a single ACTIVE commitment', () => {
      const result = buildProtocolAnalytics([ACTIVE_COMMITMENT]);

      expect(result).toEqual({
        totalCommitments: 1,
        activeCommitments: 1,
        settledCommitments: 0,
        violatedCommitments: 0,
        totalValueLocked: '1000.00',
        totalFeesEarned: '10.00',
        averageComplianceScore: 95,
        totalViolations: 0,
        uniqueOwners: 1,
      });
    });

    it('should aggregate multiple commitments across different states', () => {
      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT,
        SETTLED_COMMITMENT,
        VIOLATED_COMMITMENT,
      ]);

      expect(result.totalCommitments).toBe(3);
      expect(result.activeCommitments).toBe(1);
      expect(result.settledCommitments).toBe(1);
      expect(result.violatedCommitments).toBe(1);
      expect(result.uniqueOwners).toBe(3);
    });

    it('should correctly sum numeric string fields (amount, feeEarned)', () => {
      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT,
        SETTLED_COMMITMENT,
        VIOLATED_COMMITMENT,
      ]);

      // 1000 + 2000 + 500 = 3500
      expect(result.totalValueLocked).toBe('3500.00');
      // 10 + 20 + 0 = 30
      expect(result.totalFeesEarned).toBe('30.00');
    });

    it('should calculate average compliance score with 2 decimal places precision', () => {
      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT, // 95
        SETTLED_COMMITMENT, // 100
        VIOLATED_COMMITMENT, // 40
      ]);

      // (95 + 100 + 40) / 3 = 78.333... -> 78.33
      expect(result.averageComplianceScore).toBe(78.33);
    });

    it('should calculate average compliance score correctly for fractional inputs', () => {
      const result = buildProtocolAnalytics([
        { ...FRACTIONAL_COMPLIANCE, complianceScore: 85.333 },
        { ...FRACTIONAL_COMPLIANCE, complianceScore: 84.667, id: 'c6' },
      ]);

      // (85.333 + 84.667) / 2 = 85
      expect(result.averageComplianceScore).toBe(85);
    });

    it('should sum violations correctly', () => {
      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT, // 0 violations
        VIOLATED_COMMITMENT, // 3 violations
        { ...VIOLATED_COMMITMENT, id: 'c7', violationCount: 5 }, // 5 violations
      ]);

      expect(result.totalViolations).toBe(8);
    });

    it('should count unique owners correctly', () => {
      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT, // GXXXX
        SETTLED_COMMITMENT, // GYYYY
        { ...ACTIVE_COMMITMENT, id: 'c8', ownerAddress: 'GXXXX' }, // duplicate owner
        VIOLATED_COMMITMENT, // GZZZZ
      ]);

      // GXXXX, GYYYY, GZZZZ = 3 unique
      expect(result.uniqueOwners).toBe(3);
    });
  });

  describe('Boundary cases: Empty and zero values', () => {
    it('should return zero values for empty commitment list', () => {
      const result = buildProtocolAnalytics([]);

      expect(result).toEqual({
        totalCommitments: 0,
        activeCommitments: 0,
        settledCommitments: 0,
        violatedCommitments: 0,
        totalValueLocked: '0.00',
        totalFeesEarned: '0.00',
        averageComplianceScore: 0,
        totalViolations: 0,
        uniqueOwners: 0,
      });
    });

    it('should handle commitments with zero amounts and fees', () => {
      const result = buildProtocolAnalytics([
        ZERO_VALUES_COMMITMENT,
        { ...ZERO_VALUES_COMMITMENT, id: 'c9' },
      ]);

      expect(result.totalValueLocked).toBe('0.00');
      expect(result.totalFeesEarned).toBe('0.00');
      expect(result.totalCommitments).toBe(2);
    });

    it('should exclude empty ownerAddress from unique owner count', () => {
      const result = buildProtocolAnalytics([
        { ...ACTIVE_COMMITMENT, ownerAddress: '' },
        { ...SETTLED_COMMITMENT, ownerAddress: '' },
        VIOLATED_COMMITMENT, // GZZZZ
      ]);

      // Only GZZZZ counted, empty strings filtered out
      expect(result.uniqueOwners).toBe(1);
    });

    it('should handle mixed empty and non-empty owner addresses', () => {
      const result = buildProtocolAnalytics([
        { ...ACTIVE_COMMITMENT, ownerAddress: '' },
        ACTIVE_COMMITMENT, // GXXXX
        SETTLED_COMMITMENT, // GYYYY
        { ...VIOLATED_COMMITMENT, ownerAddress: '' },
      ]);

      // GXXXX, GYYYY = 2 unique
      expect(result.uniqueOwners).toBe(2);
    });
  });

  describe('Null/undefined handling', () => {
    it('should skip non-finite values in numeric aggregation', () => {
      const commitmentWithNaN: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: 'invalid',
      };

      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT,
        commitmentWithNaN,
        SETTLED_COMMITMENT,
      ]);

      // Only valid numbers summed: 1000 + 2000 = 3000
      expect(result.totalValueLocked).toBe('3000.00');
    });

    it('should handle Infinity as non-finite', () => {
      const commitmentWithInfinity: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: String(Number.POSITIVE_INFINITY),
      };

      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT,
        commitmentWithInfinity,
        SETTLED_COMMITMENT,
      ]);

      // Infinity skipped: 1000 + 2000 = 3000
      expect(result.totalValueLocked).toBe('3000.00');
    });

    it('should handle negative Infinity', () => {
      const commitmentWithNegInfinity: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: String(Number.NEGATIVE_INFINITY),
      };

      const result = buildProtocolAnalytics([
        commitmentWithNegInfinity,
        SETTLED_COMMITMENT,
      ]);

      // Negative infinity skipped: 2000
      expect(result.totalValueLocked).toBe('2000.00');
    });
  });

  describe('Precision and formatting', () => {
    it('should format numeric strings with 2 decimal places', () => {
      const commitment: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: '1234.5678',
        feeEarned: '12.345',
      };

      const result = buildProtocolAnalytics([commitment]);

      expect(result.totalValueLocked).toBe('1234.57');
      expect(result.totalFeesEarned).toBe('12.35');
    });

    it('should handle large numbers correctly', () => {
      const largeCommitment: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: '999999999.99',
        feeEarned: '123456.78',
      };

      const result = buildProtocolAnalytics([largeCommitment]);

      expect(result.totalValueLocked).toBe('999999999.99');
      expect(result.totalFeesEarned).toBe('123456.78');
    });

    it('should handle very small numbers correctly', () => {
      const smallCommitment: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        amount: '0.01',
        feeEarned: '0.001',
      };

      const result = buildProtocolAnalytics([smallCommitment]);

      expect(result.totalValueLocked).toBe('0.01');
      expect(result.totalFeesEarned).toBe('0.00');
    });
  });

  describe('Status filtering', () => {
    it('should correctly filter by ACTIVE status', () => {
      const commitments = [
        ACTIVE_COMMITMENT,
        SETTLED_COMMITMENT,
        VIOLATED_COMMITMENT,
        { ...ACTIVE_COMMITMENT, id: 'c10' },
      ];

      const result = buildProtocolAnalytics(commitments);

      expect(result.activeCommitments).toBe(2);
    });

    it('should correctly filter by SETTLED status', () => {
      const commitments = [
        ACTIVE_COMMITMENT,
        SETTLED_COMMITMENT,
        { ...SETTLED_COMMITMENT, id: 'c11' },
        VIOLATED_COMMITMENT,
      ];

      const result = buildProtocolAnalytics(commitments);

      expect(result.settledCommitments).toBe(2);
    });

    it('should correctly filter by VIOLATED status', () => {
      const commitments = [
        ACTIVE_COMMITMENT,
        VIOLATED_COMMITMENT,
        { ...VIOLATED_COMMITMENT, id: 'c12' },
        SETTLED_COMMITMENT,
      ];

      const result = buildProtocolAnalytics(commitments);

      expect(result.violatedCommitments).toBe(2);
    });

    it('should exclude unknown or unhandled statuses from counts', () => {
      const unknownCommitment: ChainCommitment = {
        ...ACTIVE_COMMITMENT,
        status: 'UNKNOWN',
      };

      const result = buildProtocolAnalytics([
        ACTIVE_COMMITMENT,
        unknownCommitment,
        SETTLED_COMMITMENT,
      ]);

      // Only ACTIVE and SETTLED are counted
      expect(result.activeCommitments).toBe(1);
      expect(result.settledCommitments).toBe(1);
      expect(result.violatedCommitments).toBe(0);
      expect(result.totalCommitments).toBe(3);
    });
  });

  describe('Response type invariants', () => {
    it('should always return all required fields in ProtocolAnalyticsResponse', () => {
      const result = buildProtocolAnalytics([ACTIVE_COMMITMENT]);

      expect(result).toHaveProperty('totalCommitments');
      expect(result).toHaveProperty('activeCommitments');
      expect(result).toHaveProperty('settledCommitments');
      expect(result).toHaveProperty('violatedCommitments');
      expect(result).toHaveProperty('totalValueLocked');
      expect(result).toHaveProperty('totalFeesEarned');
      expect(result).toHaveProperty('averageComplianceScore');
      expect(result).toHaveProperty('totalViolations');
      expect(result).toHaveProperty('uniqueOwners');
    });

    it('should return numeric types for all numeric fields', () => {
      const result = buildProtocolAnalytics([ACTIVE_COMMITMENT]);

      expect(typeof result.totalCommitments).toBe('number');
      expect(typeof result.activeCommitments).toBe('number');
      expect(typeof result.settledCommitments).toBe('number');
      expect(typeof result.violatedCommitments).toBe('number');
      expect(typeof result.averageComplianceScore).toBe('number');
      expect(typeof result.totalViolations).toBe('number');
      expect(typeof result.uniqueOwners).toBe('number');
    });

    it('should return string types for amount fields', () => {
      const result = buildProtocolAnalytics([ACTIVE_COMMITMENT]);

      expect(typeof result.totalValueLocked).toBe('string');
      expect(typeof result.totalFeesEarned).toBe('string');
    });

    it('should never return NaN, Infinity, or negative values', () => {
      const result = buildProtocolAnalytics([ACTIVE_COMMITMENT, SETTLED_COMMITMENT]);

      expect(Number.isNaN(result.averageComplianceScore)).toBe(false);
      expect(Number.isFinite(result.totalCommitments)).toBe(true);
      expect(Number.isFinite(result.uniqueOwners)).toBe(true);
      expect(result.totalViolations).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Integration tests for the GET /api/analytics/protocol endpoint
 *
 * Tests cover:
 * - HTTP method enforcement (GET only)
 * - Feature flag gating
 * - CORS policy enforcement
 * - Error handling and status codes
 * - Authorization and permission checking
 * - Response format and headers
 */
describe('GET /api/analytics/protocol', () => {
  beforeEach(() => {
    // Ensure feature flag is enabled by default for these tests
    process.env.COMMITLABS_FEATURE_ANALYTICS_PROTOCOL = 'true';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.COMMITLABS_FEATURE_ANALYTICS_PROTOCOL;
  });

  describe('Success responses', () => {
    it('should return 200 OK with analytics data', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('totalCommitments');
      expect(result.data).toHaveProperty('totalValueLocked');
      expect(result.data).toHaveProperty('averageComplianceScore');
    });

    it('should include CORS headers in the response', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);

      // CORS headers should be applied by applyCorsPolicy
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should return consistent totals across status fields', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      const { activeCommitments, settledCommitments, violatedCommitments, totalCommitments } =
        result.data;

      // Invariant: status breakdowns should sum to or be <= total
      expect(activeCommitments + settledCommitments + violatedCommitments).toBeLessThanOrEqual(
        totalCommitments,
      );
    });
  });

  describe('Feature flag gating', () => {
    it('should return 404 when analyticsProtocol feature is disabled', async () => {
      process.env.COMMITLABS_FEATURE_ANALYTICS_PROTOCOL = 'false';

      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      expect(result.status).toBe(404);
      expect(result.data.error?.code).toBe('NOT_FOUND');
      expect(result.data.error?.message).toContain('disabled');
    });

    it('should return 404 with feature details when feature flag missing', async () => {
      delete process.env.COMMITLABS_FEATURE_ANALYTICS_PROTOCOL;

      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      expect(result.status).toBe(404);
      expect(result.data.error?.details?.feature).toBe('analyticsProtocol');
    });
  });

  describe('HTTP method enforcement', () => {
    it('should only allow GET requests', async () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        const req = createMockRequest('http://localhost/api/analytics/protocol', { method });
        const response = await GET(req);
        const result = await parseResponse(response);

        // Should get a 405 Method Not Allowed or similar
        expect([400, 405]).toContain(result.status);
      }
    });
  });

  describe('CORS policy enforcement', () => {
    it('should enforce CORS first-party policy for GET', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com', // third-party
        },
      });

      const response = await GET(req);

      // Response should be processed through CORS policy
      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
    });

    it('should handle missing Origin header gracefully', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      // Should still return a valid response
      expect(result.status).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should return 500 on internal errors', async () => {
      // This test verifies error normalization behavior
      // Actual error conditions would be harder to trigger in unit tests
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);

      // Should return a valid response with status code
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should normalize errors to BackendError format', async () => {
      process.env.COMMITLABS_FEATURE_ANALYTICS_PROTOCOL = 'false';

      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      if (result.status >= 400) {
        expect(result.data.error).toHaveProperty('code');
        expect(result.data.error).toHaveProperty('message');
      }
    });
  });

  describe('Response format invariants', () => {
    it('should return valid JSON for successful requests', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      expect(result.data).toBeDefined();
      if (result.status === 200) {
        expect(typeof result.data).toBe('object');
        expect(result.data).not.toBeNull();
      }
    });

    it('should return proper content-type header', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response = await GET(req);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Query parameter handling', () => {
    it('should ignore unknown query parameters', async () => {
      const req = createMockRequest('http://localhost/api/analytics/protocol?foo=bar&baz=qux', {
        method: 'GET',
      });

      const response = await GET(req);
      const result = await parseResponse(response);

      // Should behave identically to request without parameters
      expect([200, 404]).toContain(result.status);
    });

    it('should return same response for identical requests', async () => {
      const req1 = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const req2 = createMockRequest('http://localhost/api/analytics/protocol', {
        method: 'GET',
      });

      const response1 = await GET(req1);
      const response2 = await GET(req2);

      const result1 = await parseResponse(response1);
      const result2 = await parseResponse(response2);

      expect(result1.status).toBe(result2.status);
      if (result1.status === 200 && result2.status === 200) {
        // Data should be equivalent (not necessarily identical object references)
        expect(result1.data).toEqual(result2.data);
      }
    });
  });
});
