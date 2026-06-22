/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DisputeModal } from "../../src/components/dispute/DisputeModal";

const defaultProps = {
  commitmentId: "CMT-001",
  isOpen: true,
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
};

describe("DisputeModal", () => {
  it("renders the category selector and reason input", () => {
    render(<DisputeModal {...defaultProps} />);

    expect(
      screen.getByRole("dialog", { name: /open dispute/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/reason category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/detail text/i)).toBeInTheDocument();
    expect(screen.getByText(/commitment CMT-001/i)).toBeInTheDocument();
  });

  it("requires detail text before submitting", () => {
    const onSubmit = vi.fn();
    render(<DisputeModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /^open dispute$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/add detail text/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits category and trimmed detail text", () => {
    const onSubmit = vi.fn();
    render(<DisputeModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/reason category/i), {
      target: { value: "FraudSuspicion" },
    });
    fireEvent.change(screen.getByLabelText(/detail text/i), {
      target: { value: "  Seller submitted contradictory evidence.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^open dispute$/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      category: "FraudSuspicion",
      reasonText: "Seller submitted contradictory evidence.",
    });
  });

  it("shows success and API error messages", () => {
    const { rerender } = render(
      <DisputeModal {...defaultProps} successMessage="Dispute opened." />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Dispute opened.");

    rerender(
      <DisputeModal {...defaultProps} errorMessage="Already disputed." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Already disputed.");
  });
});
