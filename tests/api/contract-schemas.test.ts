import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ─── Common mocks (shared by all imported route handlers) ──────────────────

vi.mock("ioredis", () => ({ default: class {} }));

vi.mock("@/lib/backend/cache/factory", () => ({
  cache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/backend/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/backend/cors", () => ({
  createCorsOptionsHandler: () => () => new Response(null, { status: 204 }),
  applyCorsPolicy: (_req: unknown, res: Response) => res,
  enforceCorsRequestPolicy: () => {},
  toCorsErrorResponse: () => new Response(null, { status: 403 }),
}));

vi.mock("@/lib/backend/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: () => ({
    sorobanRpcUrl: "https://example.invalid",
    networkPassphrase: "TEST",
    contractAddresses: { commitmentCore: "CORE", attestationEngine: "ENGINE" },
  }),
}));

vi.mock("@/lib/backend/counters/provider", () => ({
  getCountersAdapter: () => ({
    incrementSuccessfulActions: vi.fn(),
    incrementChainFailures: vi.fn(),
  }),
}));

// ─── Route-specific mocks ─────────────────────────────────────────────────

vi.mock("@/lib/backend/services/contracts", () => ({
  getUserCommitmentsFromChain: vi.fn(),
  getCommitmentFromChain: vi.fn(),
}));

vi.mock("@/lib/backend/services/marketplace", () => ({
  listMarketplaceListings: vi.fn(),
  getMarketplaceSortKeys: vi.fn().mockReturnValue([]),
  isMarketplaceSortBy: vi.fn().mockReturnValue(false),
  marketplaceService: { getMarketplaceStats: vi.fn() },
}));

vi.mock("@/utils/soroban", () => ({
  contractAddresses: {
    commitmentNFT: "https://nft.example.com",
  },
}));

vi.mock("@/lib/backend/validation", () => ({
  validateSupportedAsset: vi.fn(),
  validateStellarAddress: vi.fn(),
  ValidationError: class extends Error {
    constructor(message: string) { super(message); this.name = "ValidationError"; }
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import {
  HealthResponseSchema,
  CommitmentsListResponseSchema,
  CommitmentDetailResponseSchema,
  CommitmentSearchResponseSchema,
  MarketplaceListingsResponseSchema,
  ErrorBodySchema,
} from "@/lib/schemas/apiContracts";
import { GET as HealthGET } from "@/app/api/health/route";
import { GET as CommitmentsListGET } from "@/app/api/commitments/route";
import { GET as CommitmentDetailGET } from "@/app/api/commitments/[id]/route";
import { GET as CommitmentSearchGET } from "@/app/api/commitments/search/route";
import { GET as MarketplaceListingsGET } from "@/app/api/marketplace/listings/route";
import { createMockRequest } from "./helpers";
import {
  getUserCommitmentsFromChain,
  getCommitmentFromChain,
} from "@/lib/backend/services/contracts";
import { listMarketplaceListings } from "@/lib/backend/services/marketplace";

// ─── Mock data factories ──────────────────────────────────────────────────

function makeChainCommitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cm_1",
    ownerAddress: "GABCDEF1234567890123456789012345678901234567890123456",
    asset: "XLM",
    amount: "1000",
    status: "ACTIVE",
    complianceScore: 85,
    currentValue: "1050",
    feeEarned: "5",
    violationCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-06-01T00:00:00.000Z",
    contractVersion: "v1",
    ...overrides,
  };
}

function makeChainCommitmentDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: "cm_detail_1",
    ownerAddress: "GABCDEF1234567890123456789012345678901234567890123456",
    rules: { strategy: "balanced", maxLossPercent: 8 },
    amount: "100000",
    asset: "USDC",
    createdAt: "2026-01-10T00:00:00.000Z",
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    currentValue: "112500",
    status: "ACTIVE",
    drawdownPercent: 5,
    tokenId: "token_123",
    contractVersion: "v1",
    ...overrides,
  };
}

function makeMarketplaceListing(overrides: Record<string, unknown> = {}) {
  return {
    listingId: "listing_1",
    commitmentId: "cm_1",
    type: "Safe" as const,
    amount: 10000,
    remainingDays: 25,
    maxLoss: 8,
    currentYield: 5,
    complianceScore: 88,
    price: 10500,
    ...overrides,
  };
}

// ─── Route → schema mapping ────────────────────────────────────────────────

type RouteEntry = {
  name: string;
  handler: (
    req: Request,
    context: { params: Record<string, string> },
    correlationId: string,
  ) => Promise<Response>;
  schema: z.ZodTypeAny;
  setupMocks: () => void;
  makeRequest: () => Request;
  context?: { params: Record<string, string> };
};

const COMMON_CONTEXT = { params: {} };

const routeSchemaMap: RouteEntry[] = [
  {
    name: "GET /api/health",
    handler: HealthGET,
    schema: HealthResponseSchema,
    setupMocks: () => {},
    makeRequest: () => createMockRequest("http://localhost:3000/api/health"),
  },
  {
    name: "GET /api/commitments",
    handler: CommitmentsListGET,
    schema: CommitmentsListResponseSchema,
    setupMocks: () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
        makeChainCommitment({
          id: "cm_1",
          asset: "XLM",
          amount: "1000",
          status: "ACTIVE",
        }),
        makeChainCommitment({
          id: "cm_2",
          asset: "USDC",
          amount: "5000",
          status: "SETTLED",
        }),
      ]);
    },
    makeRequest: () =>
      createMockRequest(
        "http://localhost:3000/api/commitments?ownerAddress=GABC123",
      ),
  },
  {
    name: "GET /api/commitments/[id]",
    handler: CommitmentDetailGET,
    schema: CommitmentDetailResponseSchema,
    setupMocks: () => {
      vi.mocked(getCommitmentFromChain).mockResolvedValue(
        makeChainCommitmentDetail(),
      );
    },
    makeRequest: () =>
      createMockRequest("http://localhost:3000/api/commitments/cm_detail_1"),
    context: { params: { id: "cm_detail_1" } },
  },
  {
    name: "GET /api/commitments/search",
    handler: CommitmentSearchGET,
    schema: CommitmentSearchResponseSchema,
    setupMocks: () => {
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
        makeChainCommitment({
          id: "c1",
          asset: "XLM",
          status: "ACTIVE",
          complianceScore: 85,
        }),
        makeChainCommitment({
          id: "c2",
          asset: "USDC",
          status: "SETTLED",
          complianceScore: 92,
        }),
      ]);
    },
    makeRequest: () =>
      createMockRequest(
        "http://localhost:3000/api/commitments/search?ownerAddress=GABC123",
      ),
  },
  {
    name: "GET /api/marketplace/listings",
    handler: MarketplaceListingsGET,
    schema: MarketplaceListingsResponseSchema,
    setupMocks: () => {
      vi.mocked(listMarketplaceListings).mockResolvedValue([
        makeMarketplaceListing(),
        makeMarketplaceListing({
          listingId: "listing_2",
          type: "Balanced" as const,
          amount: 25000,
          price: 26000,
        }),
      ]);
    },
    makeRequest: () =>
      createMockRequest("http://localhost:3000/api/marketplace/listings"),
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("API contract schemas — handler response validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each(routeSchemaMap)("$name", (entry) => {
    const {
      name,
      handler,
      schema,
      setupMocks,
      makeRequest,
      context,
    } = entry;

    it("returns a response that matches the declared apiContracts schema", async () => {
      expect.assertions(4);
      setupMocks();
      const req = makeRequest();
      const res = await handler(
        req as any,
        context ?? COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");

      const parsed = schema.safeParse(body);
      expect(parsed.success).toBe(true);
    });
  });

  // ─── Empty collections ────────────────────────────────────────────────────

  describe("empty collections", () => {
    it("GET /api/commitments — empty items array passes schema", async () => {
      expect.assertions(3);
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
      const req = createMockRequest(
        "http://localhost:3000/api/commitments?ownerAddress=GABC123",
      );
      const res = await CommitmentsListGET(
        req,
        COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();
      const parsed = CommitmentsListResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.total).toBe(0);
    });

    it("GET /api/commitments/search — empty data array passes schema", async () => {
      expect.assertions(3);
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([]);
      const req = createMockRequest(
        "http://localhost:3000/api/commitments/search?ownerAddress=GABC123",
      );
      const res = await CommitmentSearchGET(
        req,
        COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();
      const parsed = CommitmentSearchResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      expect(body.data.data).toEqual([]);
      expect(body.data.meta.total).toBe(0);
    });

    it("GET /api/marketplace/listings — empty listings array passes schema", async () => {
      expect.assertions(4);
      vi.mocked(listMarketplaceListings).mockResolvedValue([]);
      const req = createMockRequest(
        "http://localhost:3000/api/marketplace/listings",
      );
      const res = await MarketplaceListingsGET(
        req,
        COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();
      const parsed = MarketplaceListingsResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
      expect(body.data.listings).toEqual([]);
      expect(body.data.cards).toEqual([]);
      expect(body.data.total).toBe(0);
    });
  });

  // ─── Optional / nullable fields ───────────────────────────────────────────

  describe("optional and nullable fields", () => {
    it("GET /api/commitments — items with missing optional fields pass schema", async () => {
      expect.assertions(1);
      vi.mocked(getUserCommitmentsFromChain).mockResolvedValue([
        makeChainCommitment({
          complianceScore: undefined,
          currentValue: undefined,
          feeEarned: undefined,
          violationCount: undefined,
          contractVersion: undefined,
        }),
      ]);
      const req = createMockRequest(
        "http://localhost:3000/api/commitments?ownerAddress=GABC123",
      );
      const res = await CommitmentsListGET(
        req,
        COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();
      const parsed = CommitmentsListResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it("GET /api/commitments/[id] — nullable maxLossPercent and absent optional fields pass schema", async () => {
      expect.assertions(1);
      vi.mocked(getCommitmentFromChain).mockResolvedValue(
        makeChainCommitmentDetail({
          rules: { strategy: "balanced", maxLossPercent: null },
          drawdownPercent: undefined,
          tokenId: undefined,
          contractVersion: undefined,
        }),
      );
      const req = createMockRequest(
        "http://localhost:3000/api/commitments/cm_opt",
      );
      const res = await CommitmentDetailGET(
        req,
        { params: { id: "cm_opt" } },
        "test-correlation-id",
      );
      const body = await res.json();
      const parsed = CommitmentDetailResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });
  });

  // ─── Error envelope ───────────────────────────────────────────────────────

  describe("error envelope", () => {
    it("returns ErrorBodySchema for a validation failure (missing required query param)", async () => {
      expect.assertions(5);
      const req = createMockRequest("http://localhost:3000/api/commitments");
      const res = await CommitmentsListGET(
        req,
        COMMON_CONTEXT,
        "test-correlation-id",
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      const parsed = ErrorBodySchema.safeParse(body);
      expect(parsed.success).toBe(true);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBeTruthy();
    });
  });
});
