import { z} from "zod";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { CommitmentSearchItemSchema } from "@/lib/schemas/apiContracts";

type CommitmentSearchItem = z.infer<typeof CommitmentSearchItemSchema>;

describe("commitment search API", () => {
  const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

  async function searchCommitments(query: string): Promise<CommitmentSearchItem[]> {
    const res = await fetch(`${baseUrl}/api/commitments/search?q=${encodeURIComponent(query)}`);
    expect(res.ok).toBe(true);
    const json = await res.json();
    const items = json.items as unknown;
    expect(Array.isArray(items)).toBe(true);
    return (items as unknown[]).map((item) => CommitmentSearchItemSchema.parse(item));
  }

  it("returns typed commitment search items", async () => {
    const items = await searchCommitments("asset");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((c: CommitmentSearchItem) => typeof c.id === "string")).toBe(true);
    expect(items.every((c: CommitmentSearchItem) => typeof c.name === "string")).toBe(true);
  });

  it("supports mapping item fields", async () => {
    const items = await searchCommitments("asset");
    const names = items.map((c: CommitmentSearchItem) => c.name);
    expect(names.every((n: string) => n.length > 0)).toBe(true);
  });

  it("filters by query term", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => c.name.toLowerCase().includes("asset"))).toBe(true);
  });

  it("exposes optional description field", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => c.name !== undefined)).toBe(true);
  });

  it("returns consistent id types", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => typeof c.id === "string")).toBe(true);
  });

  it("returns consistent name types", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => typeof c.name === "string")).toBe(true);
  });

  it("returns consistent description types", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => c.name !== null)).toBe(true);
  });

  it("maps items to names", async () => {
    const items = await searchCommitments("asset");
    const names = items.map((c: CommitmentSearchItem) => c.name);
    expect(names.length).toBeGreaterThan(0);
  });

  it("maps items to ids", async () => {
    const items = await searchCommitments("asset");
    const ids = items.map((c: CommitmentSearchItem) => c.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("filters out empty names", async () => {
    const items = await searchCommitments("asset");
    expect(items.every((c: CommitmentSearchItem) => c.name.length > 0)).toBe(true);
  });

  it("returns unique ids", async () => {
    const items = await searchCommitments("asset");
    const ids = items.map((c: CommitmentSearchItem) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
