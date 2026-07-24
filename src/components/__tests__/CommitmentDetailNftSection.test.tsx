/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommitmentDetailNftSection } from "@/components/dashboard/CommitmentDetailNftSection";

const defaultProps = {
  tokenId: "CMT-591-ALPHA",
  ownerAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456789",
  contractAddress: "CCONTRACTADDRESS1234567890",
  mintDate: "2026-06-18",
  onCopyTokenId: vi.fn(),
  onCopyOwner: vi.fn(),
  onCopyContract: vi.fn(),
  onViewDetails: vi.fn(),
  onViewOnExplorer: vi.fn(),
  onTransfer: vi.fn(),
};

const renderNftSection = (
  overrides: Partial<typeof defaultProps> = {},
) => {
  const props = {
    ...defaultProps,
    onCopyTokenId: vi.fn(),
    onCopyOwner: vi.fn(),
    onCopyContract: vi.fn(),
    onViewDetails: vi.fn(),
    onViewOnExplorer: vi.fn(),
    onTransfer: vi.fn(),
    ...overrides,
  };

  const view = render(<CommitmentDetailNftSection {...props} />);

  return { props, ...view };
};

describe("CommitmentDetailNftSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders token metadata with accessible copy and action controls", () => {
    renderNftSection();

    expect(screen.getByRole("heading", { name: "NFT" })).toBeTruthy();
    expect(screen.getByText("Commitment NFT")).toBeTruthy();
    expect(screen.getByText("#CMT-591-ALPHA")).toBeTruthy();
    expect(screen.getAllByText("CMT-591-ALPHA")).toHaveLength(1);
    expect(screen.getByText("GABCDE...6789")).toBeTruthy();
    expect(screen.getByText("CCONTR...7890")).toBeTruthy();
    expect(screen.getByText("2026-06-18")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Copy Token ID" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Owner" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Copy Contract Address" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "View NFT Details" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "View on Explorer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Transfer NFT" })).toBeTruthy();
  });

  it("invokes each copy and action callback from the matching control", () => {
    const { props } = renderNftSection();

    fireEvent.click(screen.getByRole("button", { name: "Copy Token ID" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Owner" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Contract Address" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "View NFT Details" }));
    fireEvent.click(screen.getByRole("button", { name: "View on Explorer" }));
    fireEvent.click(screen.getByRole("button", { name: "Transfer NFT" }));

    expect(props.onCopyTokenId).toHaveBeenCalledTimes(1);
    expect(props.onCopyOwner).toHaveBeenCalledTimes(1);
    expect(props.onCopyContract).toHaveBeenCalledTimes(1);
    expect(props.onViewDetails).toHaveBeenCalledTimes(1);
    expect(props.onViewOnExplorer).toHaveBeenCalledTimes(1);
    expect(props.onTransfer).toHaveBeenCalledTimes(1);
  });

  it("leaves short metadata values untruncated", () => {
    renderNftSection({
      tokenId: "7",
      ownerAddress: "GSHORT",
      contractAddress: "CSHORT",
      mintDate: "Jun 18",
    });

    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getAllByText("7")).toHaveLength(1);
    expect(screen.getByText("GSHORT")).toBeTruthy();
    expect(screen.getByText("CSHORT")).toBeTruthy();
    expect(screen.getByText("Jun 18")).toBeTruthy();
  });

  it("keeps the mint-date row stable when the value is empty", () => {
    const { container } = renderNftSection({ mintDate: "" });
    const mintDateLabel = screen.getByText("Mint Date");
    const mintDateRow = mintDateLabel.closest("div");

    expect(mintDateRow?.textContent).toBe("Mint Date");
    expect(container.querySelectorAll("button")).toHaveLength(6);
  });

  it("allows repeated copy clicks without triggering neighboring callbacks", () => {
    const { props } = renderNftSection();

    fireEvent.click(screen.getByRole("button", { name: "Copy Owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Owner" }));

    expect(props.onCopyOwner).toHaveBeenCalledTimes(2);
    expect(props.onCopyTokenId).not.toHaveBeenCalled();
    expect(props.onCopyContract).not.toHaveBeenCalled();
    expect(props.onViewDetails).not.toHaveBeenCalled();
    expect(props.onViewOnExplorer).not.toHaveBeenCalled();
    expect(props.onTransfer).not.toHaveBeenCalled();
  });
});
