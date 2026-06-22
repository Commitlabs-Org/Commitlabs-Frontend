/**
 * @vitest-environment happy-dom
 */

import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitmentDetailActions } from "../../src/components/CommitmentDetailActions";

const actionProps = {
  canEarlyExit: true,
  commitmentId: "CMT-001",
  callerAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  onEarlyExit: vi.fn(),
  onViewAttestations: vi.fn(),
  onExportData: vi.fn(),
  onReportIssue: vi.fn(),
};

describe("CommitmentDetailActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a dispute modal from the actions panel", () => {
    render(<CommitmentDetailActions {...actionProps} />);

    fireEvent.click(screen.getByRole("button", { name: /open dispute/i }));

    expect(
      screen.getByRole("dialog", { name: /open dispute/i }),
    ).toBeInTheDocument();
  });

  it("posts a categorized dispute and reflects the Disputed state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { disputeId: "DSP-001", status: "Disputed" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CommitmentDetailActions {...actionProps} />);

    fireEvent.click(screen.getByRole("button", { name: /open dispute/i }));
    fireEvent.change(screen.getByLabelText(/reason category/i), {
      target: { value: "OperationalFailure" },
    });
    fireEvent.change(screen.getByLabelText(/detail text/i), {
      target: { value: "Oracle job failed and prevented settlement." },
    });
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /open dispute/i })).getByRole(
        "button",
        { name: /^open dispute$/i },
      ),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/commitments/CMT-001/dispute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason:
              "[OperationalFailure] Oracle job failed and prevented settlement.",
            evidence: "category:OperationalFailure",
            callerAddress: actionProps.callerAddress,
          }),
        },
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      /now marked as disputed/i,
    );
    expect(
      screen.getByRole("button", { name: /commitment is disputed/i }),
    ).toBeDisabled();
  });

  it("surfaces API failures inside the modal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: { message: "Commitment is already in dispute." },
        }),
      }),
    );

    render(<CommitmentDetailActions {...actionProps} />);

    fireEvent.click(screen.getByRole("button", { name: /open dispute/i }));
    fireEvent.change(screen.getByLabelText(/detail text/i), {
      target: { value: "Duplicate dispute attempt." },
    });
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /open dispute/i })).getByRole(
        "button",
        { name: /^open dispute$/i },
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Commitment is already in dispute.",
    );
  });
});
