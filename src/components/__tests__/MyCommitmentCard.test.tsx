// @vitest-environment happy-dom

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MyCommitmentCard from "@/components/MyCommitmentCard";
import { type Commitment, CommitmentType, CommitmentStatus } from "@/types/commitment";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement("a", { href, className }, children),
}));

// Mock RelistPriceEditor since it's referenced but not imported in the component
vi.mock("@/components/marketplace/RelistPriceEditor", () => ({
  default: () => React.createElement("div", { "data-testid": "relist-price-editor" }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createCommitment = (
  overrides: Partial<Commitment> = {}
): Commitment => ({
  id: "CMT-001",
  type: "Safe",
  status: "Active",
  asset: "XLM",
  amount: "1000",
  currentValue: "1050",
  changePercent: 5.0,
  durationProgress: 50,
  daysRemaining: 15,
  complianceScore: 85,
  maxLoss: "2%",
  currentDrawdown: "1%",
  createdDate: "2024-01-01",
  expiryDate: "2024-02-01",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(
  commitment: Commitment,
  callbacks: {
    onDetails?: (id: string) => void;
    onAttestations?: (id: string) => void;
    onEarlyExit?: (id: string) => void;
    onListForSale?: (id: string) => void;
  } = {}
) {
  return render(<MyCommitmentCard commitment={commitment} {...callbacks} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MyCommitmentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Type-icon mapping ──────────────────────────────────────────────────────

  describe("type-icon mapping", () => {
    it("renders Safe icon for Safe type", () => {
      const commitment = createCommitment({ type: "Safe" });
      const { container } = renderCard(commitment);
      
      expect(screen.getByText("Safe")).toBeInTheDocument();
      // Verify the type badge has Safe-specific styling
      const typeBadge = screen.getByText("Safe").closest("div");
      expect(typeBadge?.className).toContain("border-[rgba(16,185,129,0.5)]");
      expect(typeBadge?.className).toContain("text-[#05DF72]");
    });

    it("renders Balanced icon for Balanced type", () => {
      const commitment = createCommitment({ type: "Balanced" });
      const { container } = renderCard(commitment);
      
      expect(screen.getByText("Balanced")).toBeInTheDocument();
      // Verify the type badge has Balanced-specific styling
      const typeBadge = screen.getByText("Balanced").closest("div");
      expect(typeBadge?.className).toContain("border-[rgba(59,130,246,0.5)]");
      expect(typeBadge?.className).toContain("text-[#51a2ff]");
    });

    it("renders Aggressive icon for Aggressive type", () => {
      const commitment = createCommitment({ type: "Aggressive" });
      const { container } = renderCard(commitment);
      
      expect(screen.getByText("Aggressive")).toBeInTheDocument();
      // Verify the type badge has Aggressive-specific styling
      const typeBadge = screen.getByText("Aggressive").closest("div");
      expect(typeBadge?.className).toContain("border-[rgba(245,158,11,0.5)]");
      expect(typeBadge?.className).toContain("text-[#ff8904]");
    });
  });

  // ── Gain/loss coloring ─────────────────────────────────────────────────────

  describe("gain/loss coloring", () => {
    it("applies increase styling for positive changePercent", () => {
      const commitment = createCommitment({ changePercent: 10.5 });
      renderCard(commitment);
      
      // Should show +10.50% with green color
      expect(screen.getByText("+10.50%")).toBeInTheDocument();
      const changeElement = screen.getByText("+10.50%");
      expect(changeElement.className).toContain("text-[#05DF72]");
    });

    it("applies decrease styling for negative changePercent", () => {
      const commitment = createCommitment({ changePercent: -5.25 });
      renderCard(commitment);
      
      // Should show -5.25% with red color
      expect(screen.getByText("-5.25%")).toBeInTheDocument();
      const changeElement = screen.getByText("-5.25%");
      expect(changeElement.className).toContain("text-[#EF4444]");
    });

    it("applies increase styling for zero changePercent", () => {
      const commitment = createCommitment({ changePercent: 0 });
      renderCard(commitment);
      
      // Zero is treated as positive (>= 0)
      expect(screen.getByText("+0.00%")).toBeInTheDocument();
      const changeElement = screen.getByText("+0.00%");
      expect(changeElement.className).toContain("text-[#05DF72]");
    });

    it("formats changePercent to 2 decimal places", () => {
      const commitment = createCommitment({ changePercent: 12.3456 });
      renderCard(commitment);
      
      expect(screen.getByText("+12.35%")).toBeInTheDocument();
    });
  });

  // ── Action button callbacks ─────────────────────────────────────────────────

  describe("action button callbacks", () => {
    it("calls onDetails with commitment id when Details button is clicked", () => {
      const onDetails = vi.fn();
      const commitment = createCommitment({ id: "CMT-123" });
      renderCard(commitment, { onDetails });
      
      const detailsButton = screen.getByText("Details").closest("button");
      fireEvent.click(detailsButton!);
      
      expect(onDetails).toHaveBeenCalledTimes(1);
      expect(onDetails).toHaveBeenCalledWith("CMT-123");
    });

    it("calls onAttestations with commitment id when Attestations button is clicked", () => {
      const onAttestations = vi.fn();
      const commitment = createCommitment({ id: "CMT-456" });
      renderCard(commitment, { onAttestations });
      
      const attestationsButton = screen.getByText("Attestations").closest("button");
      fireEvent.click(attestationsButton!);
      
      expect(onAttestations).toHaveBeenCalledTimes(1);
      expect(onAttestations).toHaveBeenCalledWith("CMT-456");
    });

    it("calls onEarlyExit with commitment id when Early Exit button is clicked", () => {
      const onEarlyExit = vi.fn();
      const commitment = createCommitment({ id: "CMT-789", status: "Active" });
      renderCard(commitment, { onEarlyExit });
      
      const earlyExitButton = screen.getByText("Early Exit (Penalty Applies)").closest("button");
      fireEvent.click(earlyExitButton!);
      
      expect(onEarlyExit).toHaveBeenCalledTimes(1);
      expect(onEarlyExit).toHaveBeenCalledWith("CMT-789");
    });

    it("calls onListForSale with commitment id when List for sale button is clicked", () => {
      const onListForSale = vi.fn();
      const commitment = createCommitment({ id: "CMT-999", status: "Active" });
      renderCard(commitment, { onListForSale });
      
      const listForSaleButton = screen.getByText("List for sale").closest("button");
      fireEvent.click(listForSaleButton!);
      
      expect(onListForSale).toHaveBeenCalledTimes(1);
      expect(onListForSale).toHaveBeenCalledWith("CMT-999");
    });
  });

  // ── Optional callbacks ─────────────────────────────────────────────────────

  describe("optional callbacks", () => {
    it("does not throw when onDetails is not provided", () => {
      const commitment = createCommitment({ id: "CMT-001" });
      const { container } = renderCard(commitment, {});
      
      const detailsButton = screen.getByText("Details").closest("button");
      expect(() => fireEvent.click(detailsButton!)).not.toThrow();
    });

    it("does not throw when onAttestations is not provided", () => {
      const commitment = createCommitment({ id: "CMT-002" });
      const { container } = renderCard(commitment, {});
      
      const attestationsButton = screen.getByText("Attestations").closest("button");
      expect(() => fireEvent.click(attestationsButton!)).not.toThrow();
    });

    it("does not throw when onEarlyExit is not provided", () => {
      const commitment = createCommitment({ id: "CMT-003", status: "Active" });
      const { container } = renderCard(commitment, {});
      
      const earlyExitButton = screen.getByText("Early Exit (Penalty Applies)").closest("button");
      expect(() => fireEvent.click(earlyExitButton!)).not.toThrow();
    });

    it("does not throw when onListForSale is not provided", () => {
      const commitment = createCommitment({ id: "CMT-004", status: "Active" });
      const { container } = renderCard(commitment, {});
      
      const listForSaleButton = screen.getByText("List for sale").closest("button");
      expect(() => fireEvent.click(listForSaleButton!)).not.toThrow();
    });
  });

  // ── Status-based button visibility ──────────────────────────────────────────

  describe("status-based button visibility", () => {
    it("shows List for sale and Early Exit buttons when status is Active", () => {
      const commitment = createCommitment({ status: "Active" });
      renderCard(commitment);
      
      expect(screen.getByText("List for sale")).toBeInTheDocument();
      expect(screen.getByText("Early Exit (Penalty Applies)")).toBeInTheDocument();
    });

    it("does not show List for sale and Early Exit buttons when status is Settled", () => {
      const commitment = createCommitment({ status: "Settled" });
      renderCard(commitment);
      
      expect(screen.queryByText("List for sale")).not.toBeInTheDocument();
      expect(screen.queryByText("Early Exit (Penalty Applies)")).not.toBeInTheDocument();
    });

    it("does not show List for sale and Early Exit buttons when status is Violated", () => {
      const commitment = createCommitment({ status: "Violated" });
      renderCard(commitment);
      
      expect(screen.queryByText("List for sale")).not.toBeInTheDocument();
      expect(screen.queryByText("Early Exit (Penalty Applies)")).not.toBeInTheDocument();
    });

    it("does not show List for sale and Early Exit buttons when status is Early Exit", () => {
      const commitment = createCommitment({ status: "Early Exit" });
      renderCard(commitment);
      
      expect(screen.queryByText("List for sale")).not.toBeInTheDocument();
      expect(screen.queryByText("Early Exit (Penalty Applies)")).not.toBeInTheDocument();
    });
  });

  // ── Status badge styling ───────────────────────────────────────────────────

  describe("status badge styling", () => {
    it("applies Active status styling", () => {
      const commitment = createCommitment({ status: "Active" });
      renderCard(commitment);
      
      const statusBadge = screen.getByText("Active");
      expect(statusBadge.className).toContain("bg-[rgba(16,185,129,0.1)]");
      expect(statusBadge.className).toContain("text-[#05DF72]");
    });

    it("applies Settled status styling", () => {
      const commitment = createCommitment({ status: "Settled" });
      renderCard(commitment);
      
      const statusBadge = screen.getByText("Settled");
      expect(statusBadge.className).toContain("bg-[rgba(59,130,246,0.1)]");
      expect(statusBadge.className).toContain("text-[#51a2ff]");
    });

    it("applies Early Exit status styling", () => {
      const commitment = createCommitment({ status: "Early Exit" });
      renderCard(commitment);
      
      const statusBadge = screen.getByText("Early Exit");
      expect(statusBadge.className).toContain("bg-[rgba(245,158,11,0.1)]");
      expect(statusBadge.className).toContain("text-[#ff8904]");
    });

    it("applies Violated status styling", () => {
      const commitment = createCommitment({ status: "Violated" });
      renderCard(commitment);
      
      const statusBadge = screen.getByText("Violated");
      expect(statusBadge.className).toContain("bg-[rgba(239,68,68,0.1)]");
      expect(statusBadge.className).toContain("text-[#ef4444]");
    });
  });

  // ── Data fields display ────────────────────────────────────────────────────

  describe("data fields display", () => {
    it("displays commitment id as a link", () => {
      const commitment = createCommitment({ id: "CMT-XYZ" });
      renderCard(commitment);
      
      const idLink = screen.getByText("CMT-XYZ").closest("a");
      expect(idLink).toHaveAttribute("href", "/commitments/CMT-XYZ");
    });

    it("displays amount and asset", () => {
      const commitment = createCommitment({ amount: "5000", asset: "USDC" });
      renderCard(commitment);
      
      expect(screen.getByText("5000")).toBeInTheDocument();
      expect(screen.getByText("USDC")).toBeInTheDocument();
    });

    it("displays current value", () => {
      const commitment = createCommitment({ currentValue: "5250" });
      renderCard(commitment);
      
      expect(screen.getByText("5250 XLM")).toBeInTheDocument();
    });

    it("displays duration progress and days remaining", () => {
      const commitment = createCommitment({ durationProgress: 75, daysRemaining: 10 });
      renderCard(commitment);
      
      expect(screen.getByText("10 days left")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("displays compliance score", () => {
      const commitment = createCommitment({ complianceScore: 92 });
      renderCard(commitment);
      
      expect(screen.getByText("92%")).toBeInTheDocument();
    });

    it("displays max loss and current drawdown", () => {
      const commitment = createCommitment({ maxLoss: "5%", currentDrawdown: "2.5%" });
      renderCard(commitment);
      
      expect(screen.getByText("5%")).toBeInTheDocument();
      expect(screen.getByText("2.5%")).toBeInTheDocument();
    });

    it("displays created and expiry dates", () => {
      const commitment = createCommitment({
        createdDate: "2024-01-15",
        expiryDate: "2024-02-15",
      });
      renderCard(commitment);
      
      expect(screen.getByText("2024-01-15")).toBeInTheDocument();
      expect(screen.getByText("2024-02-15")).toBeInTheDocument();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("renders without crashing when all optional callbacks are omitted", () => {
      const commitment = createCommitment();
      const { container } = renderCard(commitment, {});
      
      expect(container.firstChild).toBeInTheDocument();
    });

    it("handles very small changePercent values", () => {
      const commitment = createCommitment({ changePercent: 0.001 });
      renderCard(commitment);
      
      expect(screen.getByText("+0.00%")).toBeInTheDocument();
    });

    it("handles very large changePercent values", () => {
      const commitment = createCommitment({ changePercent: 999.999 });
      renderCard(commitment);
      
      expect(screen.getByText("+1000.00%")).toBeInTheDocument();
    });

    it("handles boundary compliance score of 80", () => {
      const commitment = createCommitment({ complianceScore: 80 });
      const { container } = renderCard(commitment);
      
      // At exactly 80, should use the default gradient (not green)
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    it("handles compliance score above 80 threshold", () => {
      const commitment = createCommitment({ complianceScore: 81 });
      const { container } = renderCard(commitment);
      
      // Above 80, should use green color
      expect(screen.getByText("81%")).toBeInTheDocument();
    });
  });
});
