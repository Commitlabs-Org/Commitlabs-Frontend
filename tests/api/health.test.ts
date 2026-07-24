import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/health/route";
import { createMockRequest, parseResponse } from "./helpers";

describe("GET /api/health", () => {
  it("returns a stable 200 JSON payload", async () => {
    const request = createMockRequest("http://localhost:3000/api/health");
    const response = await GET(request, { params: {} }, "test-correlation-id");
    const result = await parseResponse(response);

    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toContain("application/json");
    expect(result.data).toMatchObject({
      success: true,
      data: {
        status: "healthy",
        version: "0.1.0",
      },
    });
    expect(typeof result.data.data.uptime).toBe("number");
    expect(result.data.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it("rejects unsupported methods", async () => {
    const request = createMockRequest("http://localhost:3000/api/health", {
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
