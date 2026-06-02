/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CommitmentDetailsModal } from "../../src/components/modals/CommitmentDetailsModal";

const DummyTypeIcon = ({
  type,
}: {
  type: "Safe" | "Balanced" | "Aggressive";
}) => <span data-testid="type-icon">{type}</span>;

const defaultProps = {
  commitmentId: "commitment-123",
  isOpen: true,
  onClose: vi.fn(),
  typeLabel: "Balanced Commitment",
  typeVariant: "balanced" as const,
  statusLabel: "Live",
  currentPrice: "$62.12",
  amountCommitted: "$12,500",
  remainingDuration: "42 days",
  currentYield: "11.7%",
  maxLoss: "3.2%",
  complianceItems: [
    {
      id: "volatility",
      label: "Volatility Exposure",
      statusLabel: "Within limits",
      statusVariant: "ok",
    },
    {
      id: "fee",
      label: "Fee Generation",
      statusLabel: "On track",
      statusVariant: "ok",
    },
  ],
  onSelectComplianceItem: vi.fn(),
  TypeIcon: DummyTypeIcon,
};

describe("CommitmentDetailsModal", () => {
  it("renders a scannable quick-view with a full details link", () => {
    render(<CommitmentDetailsModal {...defaultProps} />);

    expect(screen.getByText(/quick view/i)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.currentPrice)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.amountCommitted)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.currentYield)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.maxLoss)).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /view full details/i }),
    ).toHaveAttribute("href", "/commitments/commitment-123");
  });

  it("closes when Escape is pressed and cycles focus inside the modal", () => {
    const onClose = vi.fn();
    render(
      <CommitmentDetailsModal
        {...defaultProps}
        isOpen={true}
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    const viewDetailsLink = screen.getByRole("link", {
      name: /view full details/i,
    });
    const doneButton = screen.getByRole("button", { name: /done/i });

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(viewDetailsLink);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(doneButton);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("restores focus to the previously focused element when the modal closes", () => {
    const onClose = vi.fn();
    const restoreButton = document.createElement("button");
    restoreButton.textContent = "Restore focus";
    document.body.appendChild(restoreButton);
    restoreButton.focus();

    const { rerender } = render(
      <CommitmentDetailsModal
        {...defaultProps}
        isOpen={true}
        onClose={onClose}
      />,
    );

    rerender(
      <CommitmentDetailsModal
        {...defaultProps}
        isOpen={false}
        onClose={onClose}
      />,
    );

    expect(document.activeElement).toBe(restoreButton);

    document.body.removeChild(restoreButton);
  });
});
