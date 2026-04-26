/**
 * Tests for the caching layer wrapped around the contracts service.
 *
 * Strategy:
 *  - vi.mock the cache factory so every test controls cache hit/miss explicitly.
 *  - vi.mock @stellar/stellar-sdk so no real Soroban calls are made.
 *  - vi.mock the backend config so contract addresses are non-empty.
 *  - Set SOROBAN_SOURCE_ACCOUNT to satisfy getSourcePublicKey().
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CacheKey } from "@/lib/backend/cache/index";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHAIN_COMMITMENT = {
  id: "CMT-001",
  ownerAddress: "GOWNER123456789",
  asset: "USDC",
  amount: "1000",
  status: "ACTIVE",
  complianceScore: 90,
  currentValue: "1000",
  feeEarned: "0",
  violationCount: 0,
  createdAt: "2024-01-01T00:00:00Z",
  expiresAt: "2025-01-01T00:00:00Z",
};

const CHAIN_COMMITMENT_LIST = [CHAIN_COMMITMENT];

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Use explicit `as` cast so mockResolvedValue / mockResolvedValueOnce remain
// typeable without needing the deprecated two-arg vi.fn generic form.
const mockCache = {
  get: vi.fn() as ReturnType<typeof vi.fn<() => Promise<unknown>>>,
  set: vi.fn() as ReturnType<typeof vi.fn<() => Promise<void>>>,
  delete: vi.fn() as ReturnType<typeof vi.fn<() => Promise<void>>>,
  invalidate: vi.fn() as ReturnType<typeof vi.fn<() => Promise<void>>>,
};

vi.mock("@/lib/backend/cache/factory", () => ({ cache: mockCache }));

vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: () => ({
    sorobanRpcUrl: "http://test-rpc",
    networkPassphrase: "Test Network",
    contractAddresses: {
      commitmentNFT: "CNFT",
      commitmentCore: "CCORE",
      attestationEngine: "CATTEST",
    },
    environment: "development",
    chainWritesEnabled: false,
  }),
}));

// scValToNative is identity so simulation.result.retval passes through as-is.
const mockSimulateTransaction = vi.fn();
const mockGetAccount = vi.fn();
const mockPrepareTransaction = vi.fn();
const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();

vi.mock("@stellar/stellar-sdk", () => ({
  BASE_FEE: "100",
  nativeToScVal: vi.fn((v: unknown) => v),
  scValToNative: vi.fn((v: unknown) => v),
  // Must use regular functions (not arrow functions) for anything called with `new`.
  Account: vi.fn(function () {
    /* noop */
  }),
  Contract: vi.fn(function () {
    return { call: vi.fn().mockReturnValue("mock-op") };
  }),
  TransactionBuilder: vi.fn(function () {
    return {
      addOperation: vi.fn().mockReturnThis(),
      setTimeout: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({ sign: vi.fn() }),
    };
  }),
  Address: vi.fn(function (value: string) {
    return { toScVal: vi.fn().mockReturnValue(value) };
  }),
  Keypair: {
    fromSecret: vi.fn().mockReturnValue({
      publicKey: vi.fn().mockReturnValue("GPUBKEY"),
      sign: vi.fn(),
    }),
  },
  SorobanRpc: {
    Server: vi.fn(function () {
      return {
        simulateTransaction: mockSimulateTransaction,
        getAccount: mockGetAccount,
        prepareTransaction: mockPrepareTransaction,
        sendTransaction: mockSendTransaction,
        getTransaction: mockGetTransaction,
      };
    }),
    Api: {
      isSimulationError: vi.fn().mockReturnValue(false),
      GetTransactionStatus: { SUCCESS: "SUCCESS", FAILED: "FAILED" },
    },
  },
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SOROBAN_SOURCE_ACCOUNT = "GPUBKEY";
  // Write tests need a secret key so getSourceKeypair() returns non-null.
  // The actual value doesn't matter because Keypair.fromSecret is mocked.
  process.env.SOROBAN_SERVER_SECRET_KEY =
    "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  // Default: chain returns CHAIN_COMMITMENT on read.
  mockSimulateTransaction.mockResolvedValue({
    result: { retval: CHAIN_COMMITMENT },
  });
  mockGetAccount.mockResolvedValue({});
  mockPrepareTransaction.mockResolvedValue({ sign: vi.fn() });
  mockSendTransaction.mockResolvedValue({ hash: "tx-hash-123" });
  mockGetTransaction.mockResolvedValue({
    status: "SUCCESS",
    returnValue: null,
  });

  // Default cache behaviour: miss (returns null).
  mockCache.get.mockResolvedValue(null);
  mockCache.set.mockResolvedValue(undefined);
  mockCache.delete.mockResolvedValue(undefined);
  mockCache.invalidate.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.SOROBAN_SOURCE_ACCOUNT;
  delete process.env.SOROBAN_SERVER_SECRET_KEY;
});

// ── getCommitmentFromChain ────────────────────────────────────────────────────

describe("getCommitmentFromChain", () => {
  it("cache hit: returns cached data without calling the chain", async () => {
    mockCache.get.mockResolvedValue(CHAIN_COMMITMENT);

    const { getCommitmentFromChain } = await import("./contracts");
    const result = await getCommitmentFromChain("CMT-001");

    expect(result).toEqual(CHAIN_COMMITMENT);
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
    expect(mockCache.get).toHaveBeenCalledWith(CacheKey.commitment("CMT-001"));
  });

  it("cache miss: calls chain and stores result", async () => {
    mockCache.get.mockResolvedValue(null);

    const { getCommitmentFromChain } = await import("./contracts");
    const result = await getCommitmentFromChain("CMT-001");

    expect(result.id).toBe("CMT-001");
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      CacheKey.commitment("CMT-001"),
      expect.objectContaining({ id: "CMT-001" }),
      expect.any(Number),
    );
  });

  it("TTL expiry: after cache returns null a second miss goes to chain", async () => {
    // First call: hit.
    mockCache.get.mockResolvedValueOnce(CHAIN_COMMITMENT);
    // Second call: miss (simulates TTL expiry).
    mockCache.get.mockResolvedValueOnce(null);

    const { getCommitmentFromChain } = await import("./contracts");
    await getCommitmentFromChain("CMT-001"); // hit — no chain call
    await getCommitmentFromChain("CMT-001"); // miss — chain called

    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws on empty commitmentId", async () => {
    const { getCommitmentFromChain } = await import("./contracts");
    await expect(getCommitmentFromChain("")).rejects.toThrow();
  });
});

// ── getUserCommitmentsFromChain ───────────────────────────────────────────────

describe("getUserCommitmentsFromChain", () => {
  it("cache hit: returns cached list without calling the chain", async () => {
    mockCache.get.mockResolvedValue(CHAIN_COMMITMENT_LIST);

    const { getUserCommitmentsFromChain } = await import("./contracts");
    const result = await getUserCommitmentsFromChain("GOWNER123456789");

    expect(result).toEqual(CHAIN_COMMITMENT_LIST);
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
    expect(mockCache.get).toHaveBeenCalledWith(
      CacheKey.userCommitments("GOWNER123456789"),
    );
  });

  it("cache miss: calls chain and stores result", async () => {
    mockCache.get.mockResolvedValue(null);
    // get_user_commitments returns an array.
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: CHAIN_COMMITMENT_LIST },
    });

    const { getUserCommitmentsFromChain } = await import("./contracts");
    const result = await getUserCommitmentsFromChain("GOWNER123456789");

    expect(result).toHaveLength(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      CacheKey.userCommitments("GOWNER123456789"),
      expect.any(Array),
      expect.any(Number),
    );
  });

  it("TTL expiry: second miss after TTL triggers fresh chain read", async () => {
    mockCache.get
      .mockResolvedValueOnce(CHAIN_COMMITMENT_LIST) // first call — hit
      .mockResolvedValueOnce(null); // second call — expired
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: CHAIN_COMMITMENT_LIST },
    });

    const { getUserCommitmentsFromChain } = await import("./contracts");
    await getUserCommitmentsFromChain("GOWNER123456789");
    await getUserCommitmentsFromChain("GOWNER123456789");

    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
  });

  it("throws on invalid owner address", async () => {
    const { getUserCommitmentsFromChain } = await import("./contracts");
    await expect(getUserCommitmentsFromChain("")).rejects.toThrow();
    await expect(getUserCommitmentsFromChain("abc")).rejects.toThrow();
  });
});

// ── createCommitmentOnChain invalidation ─────────────────────────────────────

describe("createCommitmentOnChain — cache invalidation", () => {
  it("invalidates user-commitments list after successful create", async () => {
    // create_commitment is a write; mock the full write path.
    mockGetAccount.mockResolvedValue({});
    mockPrepareTransaction.mockResolvedValue({ sign: vi.fn() });
    mockSendTransaction.mockResolvedValue({ hash: "tx-create" });
    // waitForTransactionResult uses getTransaction's returnValue.
    // A string value triggers the "string = commitmentId" path in
    // parseCreateCommitmentResult, avoiding the need for a full object.
    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: "CMT-NEW",
    });
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: "CMT-NEW" },
    });

    const { createCommitmentOnChain } = await import("./contracts");
    await createCommitmentOnChain({
      ownerAddress: "GOWNER123456789",
      asset: "USDC",
      amount: "500",
      durationDays: 30,
      maxLossBps: 200,
    });

    expect(mockCache.delete).toHaveBeenCalledWith(
      CacheKey.userCommitments("GOWNER123456789"),
    );
  });
});

// ── recordAttestationOnChain invalidation ────────────────────────────────────

describe("recordAttestationOnChain — cache invalidation", () => {
  it("invalidates commitment detail after attestation; also list when owner is cached", async () => {
    // Pre-warm cache with the commitment so ownerAddress is available.
    mockCache.get.mockResolvedValue(CHAIN_COMMITMENT);

    const attestationResult = {
      attestationId: "ATT-001",
      commitmentId: "CMT-001",
      complianceScore: 85,
      violation: false,
      feeEarned: "0",
      recordedAt: "2024-01-01T00:00:00Z",
    };
    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: attestationResult,
    });
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: attestationResult },
    });

    const { recordAttestationOnChain } = await import("./contracts");
    await recordAttestationOnChain({
      commitmentId: "CMT-001",
      attestorAddress: "GATTEST",
      complianceScore: 85,
      violation: false,
    });

    expect(mockCache.delete).toHaveBeenCalledWith(
      CacheKey.commitment("CMT-001"),
    );
    expect(mockCache.delete).toHaveBeenCalledWith(
      CacheKey.userCommitments(CHAIN_COMMITMENT.ownerAddress),
    );
  });
});

// ── settleCommitmentOnChain invalidation ─────────────────────────────────────

describe("settleCommitmentOnChain — cache invalidation", () => {
  it("invalidates commitment detail and user-commitments list after settle", async () => {
    // First call to getCommitmentFromChain (cache miss → chain).
    mockCache.get.mockResolvedValue(null);
    // Commitment is ACTIVE and already expired.
    const expiredCommitment = {
      ...CHAIN_COMMITMENT,
      status: "ACTIVE",
      expiresAt: "2020-01-01T00:00:00Z", // past
    };
    mockSimulateTransaction
      .mockResolvedValueOnce({ result: { retval: expiredCommitment } }) // get_commitment
      .mockResolvedValueOnce({ result: { retval: {} } }); // settle_commitment sim

    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: null,
    });

    const { settleCommitmentOnChain } = await import("./contracts");
    await settleCommitmentOnChain({ commitmentId: "CMT-001" });

    expect(mockCache.delete).toHaveBeenCalledWith(
      CacheKey.commitment("CMT-001"),
    );
    expect(mockCache.delete).toHaveBeenCalledWith(
      CacheKey.userCommitments(expiredCommitment.ownerAddress),
    );
  });

  it("does NOT invalidate unrelated commitment keys", async () => {
    mockCache.get.mockResolvedValue(null);
    const expiredCommitment = {
      ...CHAIN_COMMITMENT,
      id: "CMT-001",
      status: "ACTIVE",
      expiresAt: "2020-01-01T00:00:00Z",
    };
    mockSimulateTransaction
      .mockResolvedValueOnce({ result: { retval: expiredCommitment } })
      .mockResolvedValueOnce({ result: { retval: {} } });
    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: null,
    });

    const { settleCommitmentOnChain } = await import("./contracts");
    await settleCommitmentOnChain({ commitmentId: "CMT-001" });

    const deletedKeys: string[] = mockCache.delete.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(deletedKeys).not.toContain(CacheKey.commitment("CMT-999"));
  });
});

// ── marketplace — listMarketplaceListings ─────────────────────────────────────

describe("listMarketplaceListings", () => {
  it("cache hit: returns cached listings without running filter logic again", async () => {
    const cachedListings = [{ listingId: "LST-001" }];
    mockCache.get.mockResolvedValue(cachedListings);

    const { listMarketplaceListings } = await import("./marketplace");
    const result = await listMarketplaceListings({ type: "Safe" });

    expect(result).toEqual(cachedListings);
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it("cache miss: stores filtered results", async () => {
    mockCache.get.mockResolvedValue(null);

    const { listMarketplaceListings } = await import("./marketplace");
    const result = await listMarketplaceListings({ type: "Safe" });

    expect(result.every((l) => l.type === "Safe")).toBe(true);
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining("commitlabs:marketplace:listings:"),
      expect.any(Array),
      expect.any(Number),
    );
  });

  it("TTL expiry: second miss refreshes from source", async () => {
    mockCache.get
      .mockResolvedValueOnce([{ listingId: "cached" }])
      .mockResolvedValueOnce(null);

    const { listMarketplaceListings } = await import("./marketplace");
    const first = await listMarketplaceListings({});
    expect(first).toEqual([{ listingId: "cached" }]);

    const second = await listMarketplaceListings({});
    expect(second).not.toEqual([{ listingId: "cached" }]);
    expect(mockCache.set).toHaveBeenCalledTimes(1);
  });
});

// ── marketplace — createListing invalidation ──────────────────────────────────

describe("marketplaceService.createListing — cache invalidation", () => {
  it("invalidates all marketplace listing cache keys after create", async () => {
    const { marketplaceService } = await import("./marketplace");
    await marketplaceService.createListing({
      commitmentId: "CMT-INV-001",
      price: "500",
      currencyAsset: "USDC",
      sellerAddress: "GSELLER",
    });

    expect(mockCache.invalidate).toHaveBeenCalledWith(
      "commitlabs:marketplace:listings:",
    );
  });
});

// ── marketplace — cancelListing invalidation ──────────────────────────────────

describe("marketplaceService.cancelListing — cache invalidation", () => {
  it("invalidates all marketplace listing cache keys after cancel", async () => {
    const { marketplaceService } = await import("./marketplace");

    const listing = await marketplaceService.createListing({
      commitmentId: "CMT-CANCEL-001",
      price: "750",
      currencyAsset: "USDC",
      sellerAddress: "GSELLER2",
    });

    vi.clearAllMocks();
    mockCache.invalidate.mockResolvedValue(undefined);

    await marketplaceService.cancelListing(listing.id, "GSELLER2");

    expect(mockCache.invalidate).toHaveBeenCalledWith(
      "commitlabs:marketplace:listings:",
    );
  });
});
