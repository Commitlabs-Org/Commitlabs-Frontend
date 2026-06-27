// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import CommitmentDetailAllocationConstraints from "../CommitmentDetailAllocationConstraints";
import { Commitment } from "../../types/commitment";

const mockCommitment: Commitment = {
  id: "c1",
  type: "Safe",
  status: "Active",
  asset: "USDC",
  amount: "1000",
  currentValue: "1100",
  changePercent: 10,
  durationProgress: 50,
  daysRemaining: 30,
  complianceScore: 85,
  maxLoss: "200",
  currentDrawdown: "40",
  createdDate: "2023-01-01",
  expiryDate: "2023-12-31",
};

describe("CommitmentDetailAllocationConstraints", () => {
  it("renders headroom gauge with correct aria values", () => {
    render(
      <CommitmentDetailAllocationConstraints
        constraints={[]}
        commitment={mockCommitment}
      />
    );
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", mockCommitment.maxLoss);
    expect(progressbar).toHaveAttribute("aria-valuenow", mockCommitment.currentDrawdown);
    // Ensure numeric readout appears
    expect(screen.getByText(`${mockCommitment.currentDrawdown} / ${mockCommitment.maxLoss}`)).toBeInTheDocument();
  });
});
