import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { WalletConnectButton } from "@/components/WalletConnectButton";
import { getAddress } from "@stellar/freighter-api";

vi.mock("@stellar/freighter-api", () => ({
  getAddress: vi.fn(),
}));

const mockedGetAddress = vi.mocked(getAddress);

describe("WalletConnectButton", () => {
  beforeEach(() => {
    mockedGetAddress.mockReset();
  });

  it("shows a connect button and Freighter error when Freighter is not installed", async () => {
    mockedGetAddress.mockResolvedValueOnce({
      error: "Freighter not installed",
    });

    render(<WalletConnectButton />);

    const connectButton = await screen.findByRole("button", {
      name: /connect wallet/i,
    });
    expect(connectButton).toBeEnabled();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Freighter is not available/i,
    );
  });

  it("shows connecting state while the connection request is pending", async () => {
    let resolvePromise: (value: unknown) => void = () => undefined;
    mockedGetAddress
      .mockResolvedValueOnce({ error: "Freighter not installed" })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

    render(<WalletConnectButton />);

    const connectButton = await screen.findByRole("button", {
      name: /connect wallet/i,
    });
    fireEvent.click(connectButton);

    expect(connectButton).toBeDisabled();
    expect(connectButton).toHaveTextContent(/connecting/i);

    resolvePromise({ address: "GABCD1234EFGH5678" });
    await waitFor(() =>
      expect(screen.getByText(/GABC…5678/)).toBeInTheDocument(),
    );
  });

  it("renders connected address and allows disconnecting", async () => {
    mockedGetAddress.mockResolvedValueOnce({ address: "GABCD1234EFGH5678" });

    render(<WalletConnectButton />);

    await waitFor(() =>
      expect(screen.getByText(/GABC…5678/)).toBeInTheDocument(),
    );

    const accountButton = screen.getByRole("button", {
      name: /connected wallet/i,
    });
    fireEvent.click(accountButton);

    const disconnectButton = await screen.findByRole("menuitem", {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectButton);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a recovery message when the user rejects the connection in Freighter", async () => {
    mockedGetAddress.mockResolvedValueOnce({ error: "User rejected request" });

    render(<WalletConnectButton />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Connection canceled in Freighter/i,
      ),
    );
  });
});
