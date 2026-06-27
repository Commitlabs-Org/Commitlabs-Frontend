/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyCommitmentCard from "@/components/MyCommitmentCard";
import type { Commitment } from "@/types/commitment";

function buildCommitment(
  overrides: Partial<Commitment> = {},
): Commitment {
  return {
    id: "CMT-ABC123",
    type: "Safe",
    status: "Active",
    asset: "XLM",
    amount: "50,000",
    currentValue: "52,600",
    changePercent: 5.2,
    durationProgress: 75,
    daysRemaining: 15,
    complianceScore: 95,
    maxLoss: "2%",
    currentDrawdown: "0.8%",
    createdDate: "Jan 10, 2026",
    expiryDate: "Feb 9, 2026",
    ...overrides,
  };
}

describe("MyCommitmentCard", () => {
  describe("List-for-sale button", () => {
    it("renders the list-for-sale button on Active commitments", () => {
      render(
        <MyCommitmentCard
          commitment={buildCommitment({ status: "Active", id: "CMT-ABC123" })}
          onListForSale={vi.fn()}
        />,
      );

      const button = screen.getByRole("button", {
        name: /list CMT-ABC123 for sale/i,
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(/list for sale/i);
    });

    it("invokes onListForSale with the commitment id when clicked", () => {
      const onListForSale = vi.fn();
      render(
        <MyCommitmentCard
          commitment={buildCommitment({ id: "CMT-XYZ789", status: "Active" })}
          onListForSale={onListForSale}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: /list CMT-XYZ789 for sale/i,
        }),
      );

      expect(onListForSale).toHaveBeenCalledTimes(1);
      expect(onListForSale).toHaveBeenCalledWith("CMT-XYZ789");
    });

    it("does not render the button for non-Active commitments", () => {
      const onListForSale = vi.fn();
      render(
        <MyCommitmentCard
          commitment={buildCommitment({ status: "Settled" })}
          onListForSale={onListForSale}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /list .* for sale/i }),
      ).not.toBeInTheDocument();
    });

    it("does not throw when onListForSale is omitted", () => {
      render(
        <MyCommitmentCard
          commitment={buildCommitment({ status: "Active" })}
        />,
      );

      const button = screen.getByRole("button", {
        name: /list CMT-ABC123 for sale/i,
      });
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe("Existing action buttons remain wired", () => {
    it("still wires details, attestations, and early-exit callbacks", () => {
      const onDetails = vi.fn();
      const onAttestations = vi.fn();
      const onEarlyExit = vi.fn();
      const onListForSale = vi.fn();

      render(
        <MyCommitmentCard
          commitment={buildCommitment({ id: "CMT-XYZ789", status: "Active" })}
          onDetails={onDetails}
          onAttestations={onAttestations}
          onEarlyExit={onEarlyExit}
          onListForSale={onListForSale}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /details/i }));
      expect(onDetails).toHaveBeenCalledWith("CMT-XYZ789");

      fireEvent.click(screen.getByRole("button", { name: /attestations/i }));
      expect(onAttestations).toHaveBeenCalledWith("CMT-XYZ789");

      fireEvent.click(
        screen.getByRole("button", { name: /list CMT-XYZ789 for sale/i }),
      );
      expect(onListForSale).toHaveBeenCalledWith("CMT-XYZ789");

      fireEvent.click(screen.getByRole("button", { name: /early exit/i }));
      expect(onEarlyExit).toHaveBeenCalledWith("CMT-XYZ789");
    });

    it("hides the early-exit button for non-Active commitments", () => {
      render(
        <MyCommitmentCard commitment={buildCommitment({ status: "Settled" })} />,
      );

      expect(
        screen.queryByRole("button", { name: /early exit/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /list .* for sale/i }),
      ).not.toBeInTheDocument();
    });
  });
});
