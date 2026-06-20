/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CreateCommitmentStepConfigure from "../../src/components/CreateCommitmentStepConfigure";

describe("CreateCommitmentStepConfigure", () => {
  const defaultProps = {
    amount: "1000",
    asset: "XLM",
    availableBalance: "2500",
    durationDays: 60,
    maxLossPercent: 8,
    earlyExitPenalty: "30 XLM",
    estimatedFees: "0.5 XLM",
    isValid: true,
    onChangeAmount: vi.fn(),
    onChangeAsset: vi.fn(),
    onChangeDuration: vi.fn(),
    onChangeMaxLoss: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders required amount, duration, max loss, and derived value fields", () => {
    render(<CreateCommitmentStepConfigure {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Configure Parameters" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Commitment Amount/)).toHaveValue(1000);
    expect(screen.getByLabelText("Select asset")).toHaveValue("XLM");
    expect(screen.getByLabelText("Duration (days) *")).toHaveValue(60);
    expect(screen.getByRole("spinbutton", { name: /Maximum Acceptable Loss/ })).toHaveValue(8);
    expect(screen.getByText("Early Exit Penalty")).toBeInTheDocument();
    expect(screen.getByText("Estimated Fees")).toBeInTheDocument();
  });

  it("emits field updates for amount, asset, duration, and max-loss controls", () => {
    render(<CreateCommitmentStepConfigure {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Commitment Amount/), { target: { value: "1250" } });
    fireEvent.change(screen.getByLabelText("Select asset"), { target: { value: "USDC" } });
    fireEvent.change(screen.getByLabelText("Duration (days) *"), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /Maximum Acceptable Loss/ }), { target: { value: "12" } });

    expect(defaultProps.onChangeAmount).toHaveBeenLastCalledWith("1250");
    expect(defaultProps.onChangeAsset).toHaveBeenCalledWith("USDC");
    expect(defaultProps.onChangeDuration).toHaveBeenLastCalledWith(90);
    expect(defaultProps.onChangeMaxLoss).toHaveBeenLastCalledWith(12);
  });

  it("clamps typed duration and max-loss values to protocol bounds", () => {
    render(<CreateCommitmentStepConfigure {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Duration (days) *"), { target: { value: "999" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /Maximum Acceptable Loss/ }), { target: { value: "250" } });

    expect(defaultProps.onChangeDuration).toHaveBeenLastCalledWith(365);
    expect(defaultProps.onChangeMaxLoss).toHaveBeenLastCalledWith(100);
  });

  it("surfaces supplied amount errors and invalid duration or max-loss props", () => {
    render(
      <CreateCommitmentStepConfigure
        {...defaultProps}
        amountError="Amount exceeds available balance."
        durationDays={0}
        maxLossPercent={101}
      />,
    );

    expect(screen.getByText("Amount exceeds available balance.")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Minimum duration is 1 day.")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Cannot exceed 100%.")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/Commitment Amount/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Duration (days) *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("spinbutton", { name: /Maximum Acceptable Loss/ })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows high max-loss warnings without blocking valid form submission", () => {
    render(<CreateCommitmentStepConfigure {...defaultProps} maxLossPercent={85} maxLossWarning />);

    expect(screen.getByText(/Setting max loss above 80%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("disables continue and Enter submission when the form is invalid", () => {
    const { container } = render(<CreateCommitmentStepConfigure {...defaultProps} isValid={false} />);

    const continueButton = screen.getByRole("button", { name: /Continue/ });
    expect(continueButton).toBeDisabled();

    fireEvent.click(continueButton);
    fireEvent.keyDown(container.querySelector("form")!, { key: "Enter" });

    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it("preserves advanced local settings while the advanced section is collapsed and reopened", () => {
    render(<CreateCommitmentStepConfigure {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Advanced Risk Parameters" }));
    fireEvent.change(screen.getByLabelText("Slippage Tolerance (%)"), { target: { value: "3.5" } });
    fireEvent.change(screen.getByLabelText("Liquidation Buffer (%)"), { target: { value: "12" } });

    fireEvent.click(screen.getByRole("button", { name: "Advanced Risk Parameters" }));
    fireEvent.click(screen.getByRole("button", { name: "Advanced Risk Parameters" }));

    expect(screen.getByLabelText("Slippage Tolerance (%)")).toHaveValue(3.5);
    expect(screen.getByLabelText("Liquidation Buffer (%)")).toHaveValue(12);
  });

  it("routes back controls and Enter key submission when valid", () => {
    const { container } = render(<CreateCommitmentStepConfigure {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.keyDown(container.querySelector("form")!, { key: "Enter" });

    expect(defaultProps.onBack).toHaveBeenCalledTimes(2);
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });
});
