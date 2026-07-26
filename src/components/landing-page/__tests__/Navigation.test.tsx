// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
        screen.getAllByRole("button", { name: /connect wallet/i }).length,
      ).toBeGreaterThan(0),
    );
  });

  describe("mobile menu accessibility (F-01-02 / F-01-04)", () => {
    it("nav is inert when the menu is closed so hidden links are not focusable", () => {
      render(<Navigation />);
      const nav = document.getElementById("primary-navigation");
      expect(nav).not.toBeNull();
      // inert attribute must be present when the menu is closed
      expect(nav!.hasAttribute("inert")).toBe(true);
    });

    it("removes inert and moves focus to the first nav link when the menu opens", async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const toggle = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      await user.click(toggle);

      const nav = document.getElementById("primary-navigation");
      expect(nav!.hasAttribute("inert")).toBe(false);

      // First focusable element inside the nav should receive focus
      const firstLink = nav!.querySelector<HTMLElement>(
        "a, button, [tabindex]:not([tabindex='-1'])",
      );
      expect(firstLink).not.toBeNull();
      expect(document.activeElement).toBe(firstLink);
    });

    it("restores focus to the toggle button when the menu is closed via the toggle", async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const toggle = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      // Open…
      await user.click(toggle);
      // …then close
      const closeToggle = screen.getByRole("button", {
        name: /close navigation menu/i,
      });
      await user.click(closeToggle);

      expect(document.activeElement).toBe(closeToggle);
    });

    it("closes the menu and restores focus to the toggle when Escape is pressed", async () => {
      const user = userEvent.setup();
      render(<Navigation />);

      const toggle = screen.getByRole("button", {
        name: /open navigation menu/i,
      });
      await user.click(toggle);

      await user.keyboard("{Escape}");

      const nav = document.getElementById("primary-navigation");
      expect(nav!.hasAttribute("inert")).toBe(true);
      expect(document.activeElement).toBe(toggle);
    });
  });
});
