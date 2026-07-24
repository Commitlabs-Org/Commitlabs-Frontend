// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListForSaleModal from "@/components/modals/ListForSaleModal";

function renderModal(
  props: Partial<React.ComponentProps<typeof ListForSaleModal>> = {},
) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  return {
    onClose,
    onSuccess,
    ...render(
      <ListForSaleModal
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        commitmentId="CMT-XYZ789"
        asset="USDC"
        sellerAddress="GOWNERADDRESS"
        sessionToken="session-token"
        {...props}
      />,
    ),
  };
}

function mockFetchResponse(
  body: unknown,
  init: { status: number; ok?: boolean } = { status: 200, ok: true },
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status,
    statusText: init.ok === false ? "" : "OK",
    headers: { "Content-Type": "application/json" },
  });
}

describe("ListForSaleModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("rendering and form", () => {
    it("renders with the listing form fields and accessibility wiring", () => {
      renderModal();

      expect(
        screen.getByRole("heading", { name: /list commitment for sale/i }),
      ).toBeInTheDocument();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const priceInput = screen.getByRole("textbox", {
        name: /listing price/i,
      });
      expect(priceInput).toBeInTheDocument();
      expect(priceInput).toHaveAttribute("inputMode", "decimal");

      expect(
        screen.getByRole("button", { name: /list for sale/i }),
      ).toBeDisabled();
    });

    it("enables the submit button only when the price parses to a positive number", () => {
      renderModal();

      const priceInput = screen.getByRole("textbox", {
        name: /listing price/i,
      });
      const submit = screen.getByRole("button", { name: /list for sale/i });

      fireEvent.change(priceInput, { target: { value: "0" } });
      expect(submit).toBeDisabled();

      fireEvent.change(priceInput, { target: { value: "-5" } });
      expect(submit).toBeDisabled();

      fireEvent.change(priceInput, { target: { value: "abc" } });
      expect(submit).toBeDisabled();

      fireEvent.change(priceInput, { target: { value: "12.5" } });
      expect(submit).not.toBeDisabled();
    });

    it("supports prices with commas or whitespace", () => {
      renderModal();

      const priceInput = screen.getByRole("textbox", {
        name: /listing price/i,
      });
      const submit = screen.getByRole("button", { name: /list for sale/i });

      fireEvent.change(priceInput, { target: { value: "1,250.75" } });
      expect(submit).not.toBeDisabled();
    });
  });

  describe("pre-submit validation", () => {
    it("blocks when no wallet is connected", async () => {
      renderModal({ sellerAddress: undefined });

      fireEvent.change(screen.getByRole("textbox", { name: /listing price/i }), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain(
        "Connect a wallet before listing a commitment",
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it("blocks when no session token is available", async () => {
      renderModal({ sessionToken: undefined });

      fireEvent.change(screen.getByRole("textbox", { name: /listing price/i }), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Sign in again");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("falls back to a stored session token", async () => {
      window.sessionStorage.setItem("commitlabs.sessionToken", "stored-token");
      vi.mocked(fetch).mockResolvedValue(
        mockFetchResponse({
          listing: {
            id: "listing_1",
            commitmentId: "CMT-XYZ789",
            price: "100",
            currencyAsset: "USDC",
            sellerAddress: "GOWNERADDRESS",
            status: "Active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      renderModal({ sessionToken: undefined });

      fireEvent.change(screen.getByRole("textbox", { name: /listing price/i }), {
        target: { value: "100" },
      });
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/marketplace/listings",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer stored-token",
            }),
          }),
        );
      });
    });
  });

  describe("successful submission", () => {
    it("POSTs the listing with the parsed price and shows a success message", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockFetchResponse({
          listing: {
            id: "listing_42",
            commitmentId: "CMT-XYZ789",
            price: "1250.75",
            currencyAsset: "USDC",
            sellerAddress: "GOWNERADDRESS",
            status: "Active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      const { onSuccess, onClose } = renderModal();

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "1,250.75" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/marketplace/listings",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer session-token",
            }),
            body: JSON.stringify({
              commitmentId: "CMT-XYZ789",
              price: "1250.75",
              currencyAsset: "USDC",
              sellerAddress: "GOWNERADDRESS",
            }),
          }),
        );
      });

      expect(
        await screen.findByText(/CMT-XYZ789 is now listed on the marketplace/i),
      ).toBeInTheDocument();
      expect(onSuccess).toHaveBeenCalledWith("listing_42");
      // Submit button replaced by Close after success.
      expect(
        screen.queryByRole("button", { name: /list for sale/i }),
      ).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("clears prior errors when the user retypes a valid price", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse("conflict", { status: 409, ok: false }),
      );

      renderModal();

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "10" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      await screen.findByText(/already listed/i);

      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({
          listing: {
            id: "listing_99",
            commitmentId: "CMT-XYZ789",
            price: "10",
            currencyAsset: "USDC",
            sellerAddress: "GOWNERADDRESS",
            status: "Active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      // Re-typing should clear the error state.
      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "20" } },
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("error states", () => {
    it.each([
      [401, /sign in again/i],
      [403, /only list commitments owned/i],
      [409, /already listed/i],
      [429, /too many listing attempts/i],
      [500, /listing failed/i],
    ])(
      "maps HTTP %i to a contextual error message",
      async (status, expectedPattern) => {
        vi.mocked(fetch).mockResolvedValue(
          mockFetchResponse("err", { status, ok: false }),
        );

        renderModal();

        fireEvent.change(
          screen.getByRole("textbox", { name: /listing price/i }),
          { target: { value: "5" } },
        );
        fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toMatch(expectedPattern);
      },
    );

    it("prefers the server-provided message when it is a string", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockFetchResponse(
          { message: "Custom backend message" },
          { status: 422, ok: false },
        ),
      );

      renderModal();

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "5" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Custom backend message");
    });

    it("shows a network error when fetch rejects", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

      renderModal();

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "5" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/network error/i);
    });

    it("does not close the modal when submission fails", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockFetchResponse("err", { status: 500, ok: false }),
      );

      const { onClose } = renderModal();

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "5" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /list for sale/i }));

      await screen.findByRole("alert");
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("dialog interaction and lifecycle", () => {
    it("closes on Escape when idle", () => {
      const { onClose } = renderModal();

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("resets state when re-opened", () => {
      const { rerender } = render(
        <ListForSaleModal
          isOpen={true}
          onClose={vi.fn()}
          commitmentId="CMT-XYZ789"
          asset="USDC"
          sellerAddress="GOWNERADDRESS"
          sessionToken="session-token"
        />,
      );

      fireEvent.change(
        screen.getByRole("textbox", { name: /listing price/i }),
        { target: { value: "123" } },
      );

      rerender(
        <ListForSaleModal
          isOpen={false}
          onClose={vi.fn()}
          commitmentId="CMT-XYZ789"
          asset="USDC"
          sellerAddress="GOWNERADDRESS"
          sessionToken="session-token"
        />,
      );

      rerender(
        <ListForSaleModal
          isOpen={true}
          onClose={vi.fn()}
          commitmentId="CMT-XYZ789"
          asset="USDC"
          sellerAddress="GOWNERADDRESS"
          sessionToken="session-token"
        />,
      );

      const priceInput = screen.getByRole("textbox", {
        name: /listing price/i,
      });
      expect(priceInput).toHaveValue("");
    });

    it("renders nothing when closed", () => {
      render(
        <ListForSaleModal
          isOpen={false}
          onClose={vi.fn()}
          commitmentId="CMT-XYZ789"
          asset="USDC"
          sellerAddress="GOWNERADDRESS"
          sessionToken="session-token"
        />,
      );

      expect(
        screen.queryByRole("heading", { name: /list commitment for sale/i }),
      ).not.toBeInTheDocument();
    });
  });
});
