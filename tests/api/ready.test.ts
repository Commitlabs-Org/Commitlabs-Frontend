import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest, parseResponse } from "./helpers";

const mockFetch = vi.fn();
const mockGetBackendConfig = vi.fn();
const mockSorobanServer = vi.fn(function mockServer() {
  return {};
});

vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/backend/config", () => ({
  getBackendConfig: (...args: unknown[]) => mockGetBackendConfig(...args),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  SorobanRpc: {
    Server: (...args: unknown[]) => mockSorobanServer(...args),
  },
}));

describe("/api/ready route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://rpc.example.test";

    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetBackendConfig.mockReturnValue({
      contractAddresses: {
        commitmentCore: "CDUMMYCONTRACT",
      },
    });
    mockSorobanServer.mockImplementation(function mockServer() {
      return {};
    });
  });

  async function loadRoute() {
    return import("@/app/api/ready/route");
  }

  it("returns 200 when dependencies are reachable", async () => {
    const { GET } = await loadRoute();
    const request = createMockRequest("http://localhost:3000/api/ready");
    const response = await GET(request, { params: {} }, "test-correlation-id");
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toContain("application/json");
    expect(result.data).toMatchObject({
      status: "ready",
      checks: {
        sorobanRpc: { reachable: true },
        contract: { reachable: true },
      },
    });
    expect(typeof result.data.checks.sorobanRpc.latencyMs).toBe("number");
    expect(typeof result.data.checks.contract.latencyMs).toBe("number");
  });

  it("returns 503 degraded readiness when contract probe fails", async () => {
    mockSorobanServer.mockImplementation(() => {
      throw new Error("contract probe failed");
    });

    const { GET } = await loadRoute();
    const request = createMockRequest("http://localhost:3000/api/ready");
    const response = await GET(request, { params: {} }, "test-correlation-id");
    const result = await parseResponse(response);

    expect(result.status).toBe(503);
    expect(result.data).toMatchObject({
      status: "not_ready",
      checks: {
        sorobanRpc: { reachable: true },
        contract: {
          reachable: false,
          error: "contract probe failed",
          details: "CONTRACT_UNREACHABLE",
        },
      },
    });
  });

  it("rejects unsupported methods", async () => {
    const { POST } = await loadRoute();
    const request = createMockRequest("http://localhost:3000/api/ready", {
      method: "POST",
    });
    const response = await POST(request);
    const result = await parseResponse(response);

    expect(result.status).toBe(405);
    expect(result.headers.get("allow")).toBe("GET");
    expect(result.data).toMatchObject({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
      },
    });
  });
});
