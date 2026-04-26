import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest, parseResponse } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// Unit tests: seed module guards
// ---------------------------------------------------------------------------

describe("seed module – isSeedAllowed", () => {
  afterEach(() => {
    vi.resetModules();
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: undefined, SEED_SECRET: undefined });
  });

  it("returns false when SEED_ROUTE_ENABLED is not set", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: undefined });
    const { isSeedAllowed } = await import("@/lib/backend/seed");
    expect(isSeedAllowed()).toBe(false);
  });

  it("returns false when SEED_ROUTE_ENABLED=false", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "false" });
    const { isSeedAllowed } = await import("@/lib/backend/seed");
    expect(isSeedAllowed()).toBe(false);
  });

  it("returns false in production even with flag set", async () => {
    setEnv({ NODE_ENV: "production", SEED_ROUTE_ENABLED: "true" });
    const { isSeedAllowed } = await import("@/lib/backend/seed");
    expect(isSeedAllowed()).toBe(false);
  });

  it("returns true in development with flag set", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true" });
    const { isSeedAllowed } = await import("@/lib/backend/seed");
    expect(isSeedAllowed()).toBe(true);
  });

  it("returns true in test env with flag set", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "true" });
    const { isSeedAllowed } = await import("@/lib/backend/seed");
    expect(isSeedAllowed()).toBe(true);
  });
});

describe("seed module – isSeedSecretValid", () => {
  afterEach(() => {
    vi.resetModules();
    setEnv({ SEED_SECRET: undefined });
  });

  it("returns true when no SEED_SECRET is configured", async () => {
    setEnv({ SEED_SECRET: undefined });
    const { isSeedSecretValid } = await import("@/lib/backend/seed");
    expect(isSeedSecretValid(null)).toBe(true);
    expect(isSeedSecretValid("anything")).toBe(true);
  });

  it("returns true when supplied secret matches", async () => {
    setEnv({ SEED_SECRET: "super-secret" });
    const { isSeedSecretValid } = await import("@/lib/backend/seed");
    expect(isSeedSecretValid("super-secret")).toBe(true);
  });

  it("returns false when supplied secret does not match", async () => {
    setEnv({ SEED_SECRET: "super-secret" });
    const { isSeedSecretValid } = await import("@/lib/backend/seed");
    expect(isSeedSecretValid("wrong")).toBe(false);
  });

  it("returns false when secret is required but null is supplied", async () => {
    setEnv({ SEED_SECRET: "super-secret" });
    const { isSeedSecretValid } = await import("@/lib/backend/seed");
    expect(isSeedSecretValid(null)).toBe(false);
  });
});

describe("seed module – seedMockData", () => {
  afterEach(() => {
    vi.resetModules();
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: undefined, SEED_SECRET: undefined });
  });

  it("returns seeded:false when guard is not enabled", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "false" });
    const { seedMockData } = await import("@/lib/backend/seed");
    const result = await seedMockData(null);
    expect(result.seeded).toBe(false);
    expect(result.message).toMatch(/disabled/i);
  });

  it("returns seeded:false with invalid secret", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "true", SEED_SECRET: "abc" });
    const { seedMockData } = await import("@/lib/backend/seed");
    const result = await seedMockData("wrong");
    expect(result.seeded).toBe(false);
    expect(result.message).toMatch(/invalid seed secret/i);
  });

  it("returns seeded:true when guard passes and no secret configured", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "true", SEED_SECRET: undefined });
    // Mock setMockData so we don't touch the filesystem
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { seedMockData } = await import("@/lib/backend/seed");
    const result = await seedMockData(null);
    expect(result.seeded).toBe(true);
    expect(result.message).toMatch(/successfully/i);
  });

  it("returns seeded:true when correct secret is supplied", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "true", SEED_SECRET: "s3cr3t" });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { seedMockData } = await import("@/lib/backend/seed");
    const result = await seedMockData("s3cr3t");
    expect(result.seeded).toBe(true);
  });

  it("returns seeded:false when setMockData throws", async () => {
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: "true", SEED_SECRET: undefined });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockRejectedValue(new Error("disk full")),
      getMockData: vi.fn(),
    }));
    const { seedMockData } = await import("@/lib/backend/seed");
    const result = await seedMockData(null);
    expect(result.seeded).toBe(false);
    expect(result.message).toMatch(/disk full/);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: POST /api/seed route
// ---------------------------------------------------------------------------

describe("POST /api/seed route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    setEnv({ NODE_ENV: "test", SEED_ROUTE_ENABLED: undefined, SEED_SECRET: undefined });
  });

  it("returns 404 in production (NODE_ENV=production)", async () => {
    setEnv({ NODE_ENV: "production", SEED_ROUTE_ENABLED: "true" });
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(404);
  });

  it("returns 404 when SEED_ROUTE_ENABLED is not set", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: undefined });
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(404);
  });

  it("returns 404 when SEED_ROUTE_ENABLED=false", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "false" });
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(404);
  });

  it("returns 403 when secret is required but wrong header supplied", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true", SEED_SECRET: "correct" });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", {
      method: "POST",
      headers: { "x-seed-secret": "wrong" },
    });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(403);
  });

  it("returns 403 when secret is required but no header supplied", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true", SEED_SECRET: "correct" });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(403);
  });

  it("returns 200 in development with flag set and no secret configured", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true", SEED_SECRET: undefined });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(200);
    expect(result.data.data.message).toMatch(/successfully/i);
  });

  it("returns 200 in development with correct secret header", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true", SEED_SECRET: "s3cr3t" });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockResolvedValue(undefined),
      getMockData: vi.fn(),
    }));
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", {
      method: "POST",
      headers: { "x-seed-secret": "s3cr3t" },
    });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(200);
  });

  it("returns 500 when seeding fails internally", async () => {
    setEnv({ NODE_ENV: "development", SEED_ROUTE_ENABLED: "true", SEED_SECRET: undefined });
    vi.doMock("@/lib/backend/mockDb", () => ({
      setMockData: vi.fn().mockRejectedValue(new Error("write error")),
      getMockData: vi.fn(),
    }));
    const { POST } = await import("@/app/api/seed/route");
    const req = createMockRequest("http://localhost:3000/api/seed", { method: "POST" });
    const res = await POST(req);
    const result = await parseResponse(res);
    expect(result.status).toBe(500);
    expect(result.data.data.message).toMatch(/write error/);
  });
});
