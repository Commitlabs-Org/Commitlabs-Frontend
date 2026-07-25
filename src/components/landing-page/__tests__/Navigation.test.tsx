// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Navigation } from "@/components/landing-page/Navigation";

vi.mock("@/lib/freighterAdapter", () => ({
  getAddress: vi.fn().mockResolvedValue({ error: "Freighter not installed" }),
  getNetworkDetails: vi.fn(),
  signMessage: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
}));

describe("Navigation", () => {
  it("renders the wallet connect control in the header", async () => {
    render(<Navigation />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument(),
    );
  });
});
