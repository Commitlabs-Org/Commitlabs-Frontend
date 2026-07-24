// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Navigation } from "@/components/landing-page/Navigation";
import { getAddress } from "@stellar/freighter-api";

vi.mock("@stellar/freighter-api", () => ({
  getAddress: vi.fn().mockResolvedValue({ error: "Freighter not installed" }),
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
