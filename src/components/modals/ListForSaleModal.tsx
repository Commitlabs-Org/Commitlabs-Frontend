"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Tag, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { CreateListingRequest } from "@/types/marketplace";

type ListingStatus = "idle" | "submitting" | "success" | "error";

interface ListForSaleModalProps {
  isOpen: boolean;
  commitmentId: string;
  asset: string;
  sellerAddress?: string;
  sessionToken?: string;
  /** Optional override for tests/staging */
  endpoint?: string;
  onClose: () => void;
  onSuccess?: (listingId: string) => void;
}

const STORED_TOKEN_KEYS = [
  "commitlabs.sessionToken",
  "commitlabs:sessionToken",
  "sessionToken",
] as const;

function getStoredSessionToken(): string | undefined {
  if (typeof window === "undefined") return undefined;

  for (const key of STORED_TOKEN_KEYS) {
    const value =
      window.sessionStorage.getItem(key) ??
      window.localStorage.getItem(key);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Coerce a partial user-entered price into a positive finite number.
 * Returns null when the value is empty, non-numeric, or not strictly positive.
 */
function parsePrice(value: string): number | null {
  const normalized = value.replace(/[,\s]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getErrorMessageForStatus(status: number): string {
  if (status === 401) {
    return "Sign in again before listing a commitment on the marketplace.";
  }
  if (status === 403) {
    return "You can only list commitments owned by the connected wallet.";
  }
  if (status === 409) {
    return "This commitment is already listed on the marketplace.";
  }
  if (status === 429) {
    return "Too many listing attempts. Wait a moment and try again.";
  }
  return "Listing failed. Try again in a moment.";
}

export default function ListForSaleModal({
  isOpen,
  commitmentId,
  asset,
  sellerAddress,
  sessionToken,
  endpoint = "/api/marketplace/listings",
  onClose,
  onSuccess,
}: ListForSaleModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [status, setStatus] = useState<ListingStatus>("idle");
  const [price, setPrice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Reset transient state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setStatus("idle");
    setErrorMessage("");
    setPrice("");
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    const normalizedAddress = sellerAddress?.trim();
    const resolvedToken = sessionToken?.trim() || getStoredSessionToken();

    if (!normalizedAddress) {
      setStatus("error");
      setErrorMessage(
        "Connect a wallet before listing a commitment on the marketplace.",
      );
      return;
    }

    if (!resolvedToken) {
      setStatus("error");
      setErrorMessage("Sign in again before listing a commitment on the marketplace.");
      return;
    }

    const parsedPrice = parsePrice(price);
    if (parsedPrice === null) {
      setStatus("error");
      setErrorMessage("Enter a positive listing price.");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    const body: CreateListingRequest = {
      commitmentId,
      price: parsedPrice.toString(),
      currencyAsset: asset,
      sellerAddress: normalizedAddress,
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolvedToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        // Try to surface the server-provided message for non-generic errors.
        const data = await response.json().catch(() => ({} as Record<string, unknown>));
        const serverMessage =
          typeof (data as { message?: unknown }).message === "string"
            ? ((data as { message?: string }).message as string)
            : undefined;
        setStatus("error");
        setErrorMessage(serverMessage ?? getErrorMessageForStatus(response.status));
        return;
      }

      const data = await response
        .json()
        .catch(() => ({} as Record<string, unknown>));
      const listingId =
        typeof (data as { listing?: { id?: unknown } }).listing?.id === "string"
          ? ((data as { listing: { id: string } }).listing.id as string)
          : "";

      setStatus("success");
      onSuccess?.(listingId);
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Check your connection and try again.");
    }
  }, [asset, commitmentId, endpoint, onSuccess, price, sellerAddress, sessionToken]);

  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";
  const parsedPrice = parsePrice(price);
  const canSubmit = !isSubmitting && parsedPrice !== null;

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeOnEscape={!isSubmitting}
      labelledById={titleId}
      describedById={descriptionId}
      backdropClassName="bg-black/70 px-4 py-6"
      className="w-full max-w-[520px] rounded-[18px] border border-[#0FF0FC33] bg-[#0A0A0A] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#0FF0FC]/30 bg-[#0FF0FC]/10">
            <Tag className="h-6 w-6 text-[#0FF0FC]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0FF0FC]">
              Marketplace listing
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-semibold leading-tight">
              List commitment for sale
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close listing dialog"
          className="rounded-full border border-white/10 p-2 text-white/70 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      <p id={descriptionId} className="mt-4 text-sm leading-6 text-white/70">
        List commitment{" "}
        <span className="font-mono text-[#0FF0FC]">{commitmentId}</span> on the
        marketplace. Buyers will pay you in{" "}
        <span className="font-semibold text-white">{asset}</span>.
      </p>

      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            void handleSubmit();
          }
        }}
      >
        <label className="flex flex-col gap-2 text-sm text-white/70">
          <span className="flex items-center justify-between">
            <span>Listing price</span>
            <span className="text-[12px] uppercase tracking-[0.16em] text-white/40">
              {asset}
            </span>
          </span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              if (status === "error") {
                setStatus("idle");
                setErrorMessage("");
              }
            }}
            placeholder="0.00"
            disabled={isSubmitting || isSuccess}
            aria-invalid={status === "error" && !parsedPrice ? "true" : undefined}
            aria-describedby={`${titleId}-help`}
            className="rounded-[12px] border border-white/10 bg-black px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p id={`${titleId}-help`} className="text-[12px] text-white/40">
            Enter a positive number. The listing becomes visible to buyers as
            soon as you confirm.
          </p>
        </label>
      </form>

      {isSuccess ? (
        <div
          role="status"
          className="mt-5 flex gap-3 rounded-[14px] border border-[#22C55E33] bg-[#22C55E12] px-4 py-3 text-sm leading-6 text-[#BBF7D0]"
        >
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <span>
            {commitmentId} is now listed on the marketplace. Buyers will see it
            in the listings grid.
          </span>
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          className="mt-5 flex gap-3 rounded-[14px] border border-[#F9737333] bg-[#F9737312] px-4 py-3 text-sm leading-6 text-[#FECACA]"
        >
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-[14px] border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSuccess ? "Close" : "Cancel"}
        </button>
        {!isSuccess && (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#0FF0FC66] bg-[#0FF0FC1A] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(15,240,252,0.22)] transition-all hover:bg-[#0FF0FC26] hover:shadow-[0_0_24px_rgba(15,240,252,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Tag size={18} />
            )}
            {isSubmitting ? "Submitting listing" : "List for sale"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
