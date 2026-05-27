// tests/api/commitment-search.test.ts
//
// Comprehensive tests for GET /api/commitments/search
// Covers: filter combinations, pagination, sorting, caching, validation, and edge cases.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock chain service ───────────────────────────────────────────────────────

const mockGetUserCommitmentsFromChain = vi.fn();

vi.mock("@/lib/backend/services/contracts", () => ({
  getUserCommitmentsFromChain: (...args: unknown[]) =>
    mockGetUserCommitmentsFromChain(...args),
}));

// ─── Mock rate limiter (always allow) ─────────────────────────────────────────

vi.mock("@/lib/backend/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

// ─── Mock CORS ────────────────────────────────────────────────────────────────

vi.mock("@/lib/backend/cors", () => ({
  createCorsOptionsHandler: () => () => new Response(null, { status: 204 }),
  applyCorsPolicy: (_req: unknown, res: Response) => res,
  enforceCorsRequestPolicy: () => {},
  toCorsErrorResponse: () => new Response(null, { status: 403 }),
}));

// ─── Mock cache (no-op) ───────────────────────────────────────────────────────

vi.mock("@/lib/backend/cache/factory", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Import the handler under test ────────────────────────────────────────────

import { GET } from "@/app/api/commitments/search/route";
import { cache } from "@/lib/backend/cache/factory";
import { checkRateLimit } from "@/lib/backend/rateLimit";

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeCommitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    ownerAddress: "GABC123",
    asset: "XLM",
    amount: "1000",
    status: "ACTIVE",
    complianceScore: 85,
    currentValue: "1050",
    feeEarned: "5",
    violationCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const SAMPLE_COMMITMENTS = [
  makeCommitment({ id: "c1", asset: "XLM", status: "ACTIVE", complianceScore: 85, amount: "1000", createdAt: "2026-01-01T00:00:00.000Z" }),
  makeCommitment({ id: "c2", asset: "USDC", status: "SETTLED", complianceScore: 92, amount: "5000", createdAt: "2026-02-01T00:00:00.000Z" }),
  makeCommitment({ id: "c3", asset: "XLM", status: "VIOLATED", complianceScore: 45, amount: "2500", createdAt: "2026-03-01T00:00:00.000Z" }),
  makeCommitment({ id: "c4", asset: "USDC", status: "ACTIVE", complianceScore: 99, amount: "8000", createdAt: "2026-04-01T00:00:00.000Z" }),
  makeCommitment({ id: "c5", asset: "ETH", status: "EARLY_EXIT", complianceScore: 60, amount: "3000", createdAt: "2026-05-01T00:00:00.000Z" }),
];

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/commitments/search");
  url.searchParams.set("ownerAddress", "GABC123");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: "GET" });
}

async function parseJson(response: Response) {
  return response.json();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserCommitmentsFromChain.mockResolvedValue(SAMPLE_COMMITMENTS);
});

describe("GET /api/commitments/search", () => {
  // ─── Basic success ────────────────────────────────────────────────────────

  describe("basic responses", () => {
    it("returns 200 with all commitments when no filters are applied", async () => {
      const res = await GET(makeRequest(), { params: {} });
      expect(res.status).toBe(200);

      const body = await parseJson(res);
      expect(body.success).toBe(true);
      expect(body.data.data).toHaveLength(5);
      expect(body.data.meta.total).toBe(5);
    });

    it("includes filter metadata in response", async () => {
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data.filters).toEqual({
        asset: null,
        status: null,
        riskType: null,
        minCompliance: null,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });

    it("returns empty data array when no commitments match", async () => {
      mockGetUserCommitmentsFromChain.mockResolvedValue([]);
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(0);
      expect(body.data.meta.total).toBe(0);
    });
  });

  // ─── Asset filter ─────────────────────────────────────────────────────────

  describe("asset filter", () => {
    it("filters by asset (case-insensitive)", async () => {
      const res = await GET(makeRequest({ asset: "xlm" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(2);
      expect(body.data.data.every((c: any) => c.asset === "XLM")).toBe(true);
    });

    it("filters by USDC asset", async () => {
      const res = await GET(makeRequest({ asset: "USDC" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(2);
      expect(body.data.data.every((c: any) => c.asset === "USDC")).toBe(true);
    });

    it("returns empty when asset doesn't match", async () => {
      const res = await GET(makeRequest({ asset: "BTC" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(0);
    });

    it("reports asset in filters metadata", async () => {
      const res = await GET(makeRequest({ asset: "XLM" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.filters.asset).toBe("XLM");
    });
  });

  // ─── Status filter ────────────────────────────────────────────────────────

  describe("status filter", () => {
    it("filters by ACTIVE status", async () => {
      const res = await GET(makeRequest({ status: "ACTIVE" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(2);
      expect(body.data.data.every((c: any) => c.status === "ACTIVE")).toBe(true);
    });

    it("filters by SETTLED status", async () => {
      const res = await GET(makeRequest({ status: "SETTLED" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].status).toBe("SETTLED");
    });

    it("filters by VIOLATED status", async () => {
      const res = await GET(makeRequest({ status: "VIOLATED" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(1);
    });

    it("filters by EARLY_EXIT status", async () => {
      const res = await GET(makeRequest({ status: "EARLY_EXIT" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].status).toBe("EARLY_EXIT");
    });

    it("rejects invalid status values", async () => {
      const res = await GET(makeRequest({ status: "INVALID" }), { params: {} });
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ─── Risk type filter ─────────────────────────────────────────────────────

  describe("riskType filter", () => {
    it("filters by Safe risk type (all defaults to Safe)", async () => {
      const res = await GET(makeRequest({ riskType: "Safe" }), { params: {} });
      const body = await parseJson(res);

      // All commitments default to "Safe" risk type
      expect(body.data.data).toHaveLength(5);
    });

    it("returns empty for non-matching risk type", async () => {
      const res = await GET(makeRequest({ riskType: "Aggressive" }), { params: {} });
      const body = await parseJson(res);

      // Since all default to "Safe", Aggressive returns nothing
      expect(body.data.data).toHaveLength(0);
    });

    it("rejects invalid risk type", async () => {
      const res = await GET(makeRequest({ riskType: "InvalidType" }), { params: {} });
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ─── Compliance filter ────────────────────────────────────────────────────

  describe("minCompliance filter", () => {
    it("filters by minimum compliance score", async () => {
      const res = await GET(makeRequest({ minCompliance: "90" }), { params: {} });
      const body = await parseJson(res);

      // c2 (92) and c4 (99) qualify
      expect(body.data.data).toHaveLength(2);
      expect(body.data.data.every((c: any) => c.complianceScore >= 90)).toBe(true);
    });

    it("returns all when minCompliance is 0", async () => {
      const res = await GET(makeRequest({ minCompliance: "0" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(5);
    });

    it("returns none when minCompliance is very high", async () => {
      const res = await GET(makeRequest({ minCompliance: "100" }), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(0);
    });

    it("rejects compliance > 100", async () => {
      const res = await GET(makeRequest({ minCompliance: "101" }), { params: {} });
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it("rejects negative compliance", async () => {
      const res = await GET(makeRequest({ minCompliance: "-1" }), { params: {} });
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ─── Combined filters ─────────────────────────────────────────────────────

  describe("combined filters", () => {
    it("applies asset + status filters together", async () => {
      const res = await GET(
        makeRequest({ asset: "USDC", status: "ACTIVE" }),
        { params: {} },
      );
      const body = await parseJson(res);

      // Only c4 matches (USDC + ACTIVE)
      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].asset).toBe("USDC");
      expect(body.data.data[0].status).toBe("ACTIVE");
    });

    it("applies asset + status + minCompliance filters", async () => {
      const res = await GET(
        makeRequest({ asset: "USDC", status: "ACTIVE", minCompliance: "95" }),
        { params: {} },
      );
      const body = await parseJson(res);

      // c4: USDC, ACTIVE, complianceScore 99
      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].commitmentId).toBe("c4");
    });

    it("returns empty when combined filters match nothing", async () => {
      const res = await GET(
        makeRequest({ asset: "ETH", status: "ACTIVE" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(0);
    });
  });

  // ─── Pagination ───────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("paginates results correctly", async () => {
      const res = await GET(
        makeRequest({ page: "1", pageSize: "2" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(2);
      expect(body.data.meta.page).toBe(1);
      expect(body.data.meta.pageSize).toBe(2);
      expect(body.data.meta.total).toBe(5);
      expect(body.data.meta.totalPages).toBe(3);
      expect(body.data.meta.hasNextPage).toBe(true);
      expect(body.data.meta.hasPrevPage).toBe(false);
    });

    it("returns second page correctly", async () => {
      const res = await GET(
        makeRequest({ page: "2", pageSize: "2" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(2);
      expect(body.data.meta.page).toBe(2);
      expect(body.data.meta.hasNextPage).toBe(true);
      expect(body.data.meta.hasPrevPage).toBe(true);
    });

    it("returns last page with remaining items", async () => {
      const res = await GET(
        makeRequest({ page: "3", pageSize: "2" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(1);
      expect(body.data.meta.hasNextPage).toBe(false);
      expect(body.data.meta.hasPrevPage).toBe(true);
    });

    it("returns empty data for page beyond total", async () => {
      const res = await GET(
        makeRequest({ page: "10", pageSize: "10" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(body.data.data).toHaveLength(0);
    });

    it("rejects page < 1", async () => {
      const res = await GET(
        makeRequest({ page: "0" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(res.status).toBe(400);
    });

    it("rejects pageSize > 100", async () => {
      const res = await GET(
        makeRequest({ pageSize: "101" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(res.status).toBe(400);
    });
  });

  // ─── Sorting ──────────────────────────────────────────────────────────────

  describe("sorting", () => {
    it("sorts by createdAt desc by default", async () => {
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      const dates = body.data.data.map((c: any) => c.createdAt);
      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(
          new Date(dates[i]).getTime(),
        );
      }
    });

    it("sorts by amount ascending", async () => {
      const res = await GET(
        makeRequest({ sortBy: "amount", sortOrder: "asc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const amounts = body.data.data.map((c: any) => Number(c.amount));
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]).toBeGreaterThanOrEqual(amounts[i - 1]);
      }
    });

    it("sorts by amount descending", async () => {
      const res = await GET(
        makeRequest({ sortBy: "amount", sortOrder: "desc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const amounts = body.data.data.map((c: any) => Number(c.amount));
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
      }
    });

    it("sorts by complianceScore ascending", async () => {
      const res = await GET(
        makeRequest({ sortBy: "complianceScore", sortOrder: "asc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const scores = body.data.data.map((c: any) => c.complianceScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it("sorts by status alphabetically", async () => {
      const res = await GET(
        makeRequest({ sortBy: "status", sortOrder: "asc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const statuses = body.data.data.map((c: any) => c.status);
      const sorted = [...statuses].sort();
      expect(statuses).toEqual(sorted);
    });

    it("sorts by asset alphabetically", async () => {
      const res = await GET(
        makeRequest({ sortBy: "asset", sortOrder: "asc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const assets = body.data.data.map((c: any) => c.asset);
      for (let i = 1; i < assets.length; i++) {
        expect(assets[i].localeCompare(assets[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });

    it("rejects invalid sortBy field", async () => {
      const res = await GET(
        makeRequest({ sortBy: "invalidField" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(res.status).toBe(400);
    });

    it("rejects invalid sortOrder", async () => {
      const res = await GET(
        makeRequest({ sortOrder: "random" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(res.status).toBe(400);
    });

    it("provides stable sort (tiebreaker by commitmentId)", async () => {
      // Two commitments with the same amount
      mockGetUserCommitmentsFromChain.mockResolvedValue([
        makeCommitment({ id: "b2", amount: "1000", createdAt: "2026-01-01T00:00:00.000Z" }),
        makeCommitment({ id: "a1", amount: "1000", createdAt: "2026-01-01T00:00:00.000Z" }),
        makeCommitment({ id: "c3", amount: "1000", createdAt: "2026-01-01T00:00:00.000Z" }),
      ]);

      const res = await GET(
        makeRequest({ sortBy: "amount", sortOrder: "asc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      const ids = body.data.data.map((c: any) => c.commitmentId);
      expect(ids).toEqual(["a1", "b2", "c3"]);
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe("validation", () => {
    it("requires ownerAddress", async () => {
      const url = new URL("http://localhost:3000/api/commitments/search");
      const req = new NextRequest(url, { method: "GET" });
      const res = await GET(req, { params: {} });
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it("rejects empty ownerAddress", async () => {
      const url = new URL("http://localhost:3000/api/commitments/search");
      url.searchParams.set("ownerAddress", "");
      const req = new NextRequest(url, { method: "GET" });
      const res = await GET(req, { params: {} });

      expect(res.status).toBe(400);
    });

    it("rejects non-numeric minCompliance", async () => {
      const res = await GET(
        makeRequest({ minCompliance: "abc" }),
        { params: {} },
      );
      const body = await parseJson(res);

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ─── Caching ──────────────────────────────────────────────────────────────

  describe("caching", () => {
    it("caches search results after first call", async () => {
      await GET(makeRequest(), { params: {} });

      expect(cache.set).toHaveBeenCalledTimes(1);
      const setCall = vi.mocked(cache.set).mock.calls[0];
      expect(setCall[0]).toContain("commitlabs:commitment-search:");
      expect(setCall[2]).toBe(15); // TTL
    });

    it("returns cached data when available", async () => {
      const cachedPayload = {
        data: [makeCommitment({ id: "cached" })],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        filters: { asset: null, status: null, riskType: null, minCompliance: null, sortBy: "createdAt", sortOrder: "desc" },
      };

      vi.mocked(cache.get).mockResolvedValueOnce(cachedPayload);

      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data).toEqual(cachedPayload);
      // Chain should NOT be called when cache hit
      expect(mockGetUserCommitmentsFromChain).not.toHaveBeenCalled();
    });
  });

  // ─── Rate limiting ────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce(false);

      const res = await GET(makeRequest(), { params: {} });

      expect(res.status).toBe(429);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles commitments with bigint amounts", async () => {
      mockGetUserCommitmentsFromChain.mockResolvedValue([
        makeCommitment({ id: "big", amount: BigInt("99999999999999") }),
      ]);

      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data[0].amount).toBe("99999999999999");
    });

    it("handles commitments with bigint currentValue", async () => {
      mockGetUserCommitmentsFromChain.mockResolvedValue([
        makeCommitment({ id: "big", currentValue: BigInt("12345") }),
      ]);

      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data[0].currentValue).toBe("12345");
    });

    it("handles missing optional fields gracefully", async () => {
      mockGetUserCommitmentsFromChain.mockResolvedValue([
        {
          id: "minimal",
          ownerAddress: "GABC",
          asset: "XLM",
          amount: "100",
          status: "ACTIVE",
        },
      ]);

      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body.data.data[0].complianceScore).toBe(0);
      expect(body.data.data[0].violationCount).toBe(0);
      expect(body.data.data[0].feeEarned).toBe("0");
    });

    it("handles chain service errors via withApiHandler", async () => {
      mockGetUserCommitmentsFromChain.mockRejectedValueOnce(
        new Error("Chain unavailable"),
      );

      const res = await GET(makeRequest(), { params: {} });

      expect(res.status).toBe(500);
    });
  });

  // ─── Response shape ───────────────────────────────────────────────────────

  describe("response shape", () => {
    it("returns standard envelope structure", async () => {
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("data");
      expect(body.data).toHaveProperty("meta");
      expect(body.data).toHaveProperty("filters");
    });

    it("meta contains all pagination fields", async () => {
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      const { meta } = body.data;
      expect(meta).toHaveProperty("page");
      expect(meta).toHaveProperty("pageSize");
      expect(meta).toHaveProperty("total");
      expect(meta).toHaveProperty("totalPages");
      expect(meta).toHaveProperty("hasNextPage");
      expect(meta).toHaveProperty("hasPrevPage");
    });

    it("each item has all expected fields", async () => {
      const res = await GET(makeRequest(), { params: {} });
      const body = await parseJson(res);

      const item = body.data.data[0];
      const requiredFields = [
        "commitmentId",
        "ownerAddress",
        "asset",
        "amount",
        "status",
        "riskType",
        "complianceScore",
        "currentValue",
        "feeEarned",
        "violationCount",
        "createdAt",
        "expiresAt",
      ];

      for (const field of requiredFields) {
        expect(item).toHaveProperty(field);
      }
    });
  });
});
