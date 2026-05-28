import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackendError } from "@/lib/backend/errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePendingPromise<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ── Mock implementations ──────────────────────────────────────────────────────

const mockSimulateTransaction = vi.fn();
const mockGetAccount = vi.fn();
const mockPrepareTransaction = vi.fn();
const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();

vi.mock("@stellar/stellar-sdk", () => {
  function FakeAccount(
    this: { publicKey: string; sequence: string },
    pk: string,
    seq: string,
  ) {
    this.publicKey = pk;
    this.sequence = seq;
  }

  function FakeContract(this: object) {}
  FakeContract.prototype.call = function () {
    return {};
  };

  function FakeTransactionBuilder(this: object) {}
  FakeTransactionBuilder.prototype.addOperation = function () {
    return this;
  };
  FakeTransactionBuilder.prototype.setTimeout = function () {
    return this;
  };
  FakeTransactionBuilder.prototype.build = function () {
    return { sign: vi.fn() };
  };

  function FakeSorobanServer(this: {
    simulateTransaction: typeof mockSimulateTransaction;
    getAccount: typeof mockGetAccount;
    prepareTransaction: typeof mockPrepareTransaction;
    sendTransaction: typeof mockSendTransaction;
    getTransaction: typeof mockGetTransaction;
  }) {
    this.simulateTransaction = mockSimulateTransaction;
    this.getAccount = mockGetAccount;
    this.prepareTransaction = mockPrepareTransaction;
    this.sendTransaction = mockSendTransaction;
    this.getTransaction = mockGetTransaction;
  }

  const SorobanRpc = {
    Server: FakeSorobanServer,
    Api: {
      isSimulationError: vi.fn().mockReturnValue(false),
      GetTransactionStatus: {
        SUCCESS: "SUCCESS",
        FAILED: "FAILED",
        NOT_FOUND: "NOT_FOUND",
      },
    },
  };

  return {
    Account: FakeAccount,
    Address: function FakeAddress(
      this: { addr: string; toScVal: () => string },
      addr: string,
    ) {
      this.addr = addr;
      this.toScVal = () => addr;
    },
    BASE_FEE: 100,
    Contract: FakeContract,
    Keypair: {
      fromSecret: vi.fn().mockReturnValue({
        publicKey: () => "GPUBLIC",
      }),
    },
    SorobanRpc,
    TransactionBuilder: FakeTransactionBuilder,
    nativeToScVal: vi.fn().mockImplementation((v: unknown) => v),
    scValToNative: vi.fn().mockImplementation((v: unknown) => v),
  };
});

vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: vi.fn().mockReturnValue({
    sorobanRpcUrl: "https://rpc.example.com",
    networkPassphrase: "Test SDF Network ; September 2015",
    contractAddresses: {
      commitmentCore: "CCORE",
      attestationEngine: "CATTEST",
      commitmentNFT: "CNFT",
    },
    environment: "test",
    chainWritesEnabled: false,
  }),
}));

vi.mock("@/lib/backend/cache/factory", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/backend/cache/index", () => ({
  CacheKey: {
    commitment: (id: string) => `commitment:${id}`,
    userCommitments: (addr: string) => `user:${addr}`,
  },
  CacheTTL: { COMMITMENT_DETAIL: 60, USER_COMMITMENTS: 30 },
}));

vi.mock("@/lib/backend/counters/provider", () => ({
  getCountersAdapter: vi.fn().mockReturnValue({
    incrementSuccessfulActions: vi.fn().mockResolvedValue(undefined),
    incrementChainFailures: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/backend/logger", () => ({
  logInfo: vi.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Soroban RPC abort/timeout handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.SOROBAN_SERVER_SECRET_KEY = "SABCDEF";
    process.env.SOROBAN_SOURCE_ACCOUNT = "GPUBLIC";
    process.env.SOROBAN_RPC_TIMEOUT_MS = "500";
    mockSimulateTransaction.mockReset();
    mockGetAccount.mockReset();
    mockPrepareTransaction.mockReset();
    mockSendTransaction.mockReset();
    mockGetTransaction.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SOROBAN_RPC_TIMEOUT_MS;
    delete process.env.SOROBAN_SERVER_SECRET_KEY;
    delete process.env.SOROBAN_SOURCE_ACCOUNT;
  });

  it("maps a hanging simulateTransaction to GATEWAY_TIMEOUT on read", async () => {
    const { promise: hangingSimulation } = makePendingPromise<never>();
    mockSimulateTransaction.mockReturnValue(hangingSimulation);

    const { getCommitmentFromChain } = await import(
      "@/lib/backend/services/contracts"
    );

    // Attach .catch() immediately so the rejection is never unhandled
    const settled = getCommitmentFromChain("commitment-read-hang").catch(
      (e: unknown) => e,
    );

    await vi.advanceTimersByTimeAsync(600);
    const err = await settled;

    expect(err).toBeInstanceOf(BackendError);
    expect((err as BackendError).status).toBe(504);
    expect((err as BackendError).code).toBe("GATEWAY_TIMEOUT");
    expect(
      ((err as BackendError).details as Record<string, unknown>).retryable,
    ).toBe(true);
  });

  it("maps a hanging getAccount to GATEWAY_TIMEOUT on write", async () => {
    const { promise: hangingGetAccount } = makePendingPromise<never>();
    mockGetAccount.mockReturnValue(hangingGetAccount);

    const { createCommitmentOnChain } = await import(
      "@/lib/backend/services/contracts"
    );

    const settled = createCommitmentOnChain({
      ownerAddress: "GPUBLIC_OWNER",
      asset: "USDC",
      amount: "1000",
      durationDays: 30,
      maxLossBps: 500,
    }).catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(600);
    const err = await settled;

    expect(err).toBeInstanceOf(BackendError);
    expect((err as BackendError).status).toBe(504);
    expect((err as BackendError).code).toBe("GATEWAY_TIMEOUT");
    expect(
      ((err as BackendError).details as Record<string, unknown>).retryable,
    ).toBe(true);
  });

  it("includes methodName and timeoutMs in timeout error details", async () => {
    const { promise: hangingSimulation } = makePendingPromise<never>();
    mockSimulateTransaction.mockReturnValue(hangingSimulation);

    const { getCommitmentFromChain } = await import(
      "@/lib/backend/services/contracts"
    );

    const settled = getCommitmentFromChain("cid-detail-check").catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(600);
    const err = await settled;

    expect(err).toBeInstanceOf(BackendError);
    const details = (err as BackendError).details as Record<string, unknown>;
    expect(typeof details.methodName).toBe("string");
    expect(typeof details.timeoutMs).toBe("number");
    expect(details.timeoutMs).toBe(500);
  });

  it("resolves normally when RPC completes before the deadline", async () => {
    const fakeCommitment = {
      id: "cid-fast",
      ownerAddress: "GOWNER",
      asset: "USDC",
      amount: "500",
      status: "ACTIVE",
      complianceScore: 100,
      currentValue: "500",
      feeEarned: "0",
      violationCount: 0,
    };

    mockSimulateTransaction.mockResolvedValue({
      result: { retval: fakeCommitment },
    });

    const { getCommitmentFromChain } = await import(
      "@/lib/backend/services/contracts"
    );

    const settled = getCommitmentFromChain("cid-fast").catch((e: unknown) => e);
    // Advance only 100 ms — well within the 500 ms deadline
    await vi.advanceTimersByTimeAsync(100);

    const result = await settled;
    expect(result).not.toBeInstanceOf(BackendError);
    expect((result as { id: string }).id).toBe("cid-fast");
  });
});
