import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DashboardPage from "./page";
import type { Commitment } from "@/lib/commitments";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const walletState = {
  address: undefined as string | undefined,
  balance: "0.0000000",
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    address: walletState.address,
    balance: walletState.balance,
    connected: walletState.connected,
    connect: walletState.connect,
    disconnect: walletState.disconnect,
  }),
}));

const now = new Date("2025-01-01T00:00:00.000Z").getTime();

function makeCommitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: "c-1",
    owner: "GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    asset: "USDC",
    amount: 1000,
    projectedYield: 100,
    createdAt: now - 1000,
    maturityAt: now + 86400000,
    status: "active",
    ...overrides,
  } as Commitment;
}

const ownerA = "GBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ownerB = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const commitments: Commitment[] = [
  makeCommitment({ id: "a-usdc", owner: ownerA, asset: "USDC", amount: 2500, projectedYield: 250 }),
  makeCommitment({ id: "a-xlm", owner: ownerA, asset: "XLM", amount: 10000, projectedYield: 1000 }),
  makeCommitment({ id: "b-usdc", owner: ownerB, asset: "USDC", amount: 7500, projectedYield: 750 }),
  makeCommitment({ id: "demo-1", owner: undefined as unknown as string, asset: "EURC", amount: 500, projectedYield: 50 }),
];

vi.mock("@/lib/commitments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commitments")>();
  return {
    ...actual,
    loadCommitments: vi.fn(async () => commitments),
  };
});

function setWallet(address?: string) {
  if (address) {
    walletState.address = address;
    walletState.connected = true;
  } else {
    walletState.address = undefined;
    walletState.connected = false;
  }
}

beforeEach(() => {
  cleanup();
  setWallet(undefined);
});

describe("Dashboard owner scoping", () => {
  it("shows only unowned demo items when disconnected", async () => {
    setWallet(undefined);
    render(<DashboardPage />);

    // Demo group visible
    expect(await screen.findByText(/demo/i)).toBeVisible();

    // Owned rows not visible
    expect(screen.queryByText(/a-usdc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/b-usdc/i)).not.toBeInTheDocument();
  });

  it("shows owner A commitments plus demo group", async () => {
    setWallet(ownerA);
    render(<DashboardPage />);

    expect(await screen.findByText(/a-usdc/i)).toBeVisible();
    expect(await screen.findByText(/a-xlm/i)).toBeVisible();
    expect(await screen.findByText(/demo/i)).toBeVisible();

    // Owner B rows not visible
    expect(screen.queryByText(/b-usdc/i)).not.toBeInTheDocument();
  });

  it("updates the list when switching to owner B", async () => {
    setWallet(ownerB);
    render(<DashboardPage />);

    expect(await screen.findByText(/b-usdc/i)).toBeVisible();
    expect(await screen.findByText(/demo/i)).toBeVisible();

    expect(screen.queryByText(/a-usdc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/a-xlm/i)).not.toBeInTheDocument();
  });

  it("never adds different assets into one total", async () => {
    setWallet(ownerA);
    render(<DashboardPage />);

    // Per-asset totals are rendered with units.
    expect(await screen.findByText(/\b2,?500\s*USDC\b/i)).toBeVisible();
    expect(await screen.findByText(/\b10,000\s*XLM\b/i)).toBeVisible();

    // The meaningless cross-asset sum must not appear.
    expect(screen.queryByText(/\b12,500\b/)).not.toBeInTheDocument();
  });

  it("always shows the Ready to settle tile", async () => {
    setWallet(undefined);
    render(<DashboardPage />);

    expect(await screen.findByText(/Ready to settle/i)).toBeVisible();
  });
});
