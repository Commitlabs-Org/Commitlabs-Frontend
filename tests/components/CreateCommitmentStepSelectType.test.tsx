/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CreateCommitmentStepSelectType from "../../src/components/CreateCommitmentStepSelectType";

describe("CreateCommitmentStepSelectType", () => {
  const defaultProps = {
    selectedType: null as "safe" | "balanced" | "aggressive" | null,
    onSelectType: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all risk profile choices as an accessible radio group", () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);

    expect(screen.getByRole("radiogroup", { name: "Commitment type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Safe Commitment/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: /Balanced Commitment/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: /Aggressive Commitment/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("⚠ High Risk")).toBeInTheDocument();
  });

  it("marks the selected risk profile and enables continue", () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} selectedType="balanced" />);

    expect(screen.getByRole("radio", { name: /Balanced Commitment/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: /Continue/ })).toBeEnabled();
  });

  it("emits the selected profile when a card is clicked", () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);

    fireEvent.click(screen.getByRole("radio", { name: /Aggressive Commitment/ }));

    expect(defaultProps.onSelectType).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSelectType).toHaveBeenCalledWith("aggressive");
  });

  it("supports keyboard selection with Enter and Space", () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);

    const safeCard = screen.getByRole("radio", { name: /Safe Commitment/ });
    const balancedCard = screen.getByRole("radio", { name: /Balanced Commitment/ });

    fireEvent.keyDown(safeCard, { key: "Enter" });
    fireEvent.keyDown(balancedCard, { key: " " });

    expect(defaultProps.onSelectType).toHaveBeenNthCalledWith(1, "safe");
    expect(defaultProps.onSelectType).toHaveBeenNthCalledWith(2, "balanced");
  });

  it("blocks continue until a profile is selected", () => {
    const { rerender } = render(<CreateCommitmentStepSelectType {...defaultProps} />);

    const disabledContinue = screen.getByRole("button", { name: /Continue/ });
    expect(disabledContinue).toBeDisabled();
    fireEvent.click(disabledContinue);
    expect(defaultProps.onNext).not.toHaveBeenCalled();

    rerender(<CreateCommitmentStepSelectType {...defaultProps} selectedType="safe" />);
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
    expect(defaultProps.onNext).toHaveBeenCalledWith("safe");
  });

  it("routes both back controls to onBack", () => {
    render(<CreateCommitmentStepSelectType {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Back to Home/ }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(defaultProps.onBack).toHaveBeenCalledTimes(2);
  });
});
