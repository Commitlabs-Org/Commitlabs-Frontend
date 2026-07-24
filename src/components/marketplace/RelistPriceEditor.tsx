'use client';

import React, { useState, useCallback, useId } from 'react';
import { Pencil, RotateCcw, Loader2, X, Check } from 'lucide-react';
import type { MarketplaceListing } from '@/types/marketplace';
import { useToast } from '@/components/toast/ToastProvider';

export interface MarketplaceStats {
  floorPrice: string;
  medianPrice: string;
  lastSoldPrice?: string;
  activeSellers: number;
}

interface RelistPriceEditorProps {
  listing: MarketplaceListing;
  sellerAddress: string;
  commitmentAsset: string;
  onPriceUpdated?: (newPrice: string) => void;
  marketplaceStats?: MarketplaceStats;
}

const MIN_PRICE = 0.01;
const MAX_PRICE = 1_000_000_000;

function isValidPrice(value: string): { valid: true } | { valid: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, error: 'Price is required' };
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return { valid: false, error: 'Price must be a valid number' };
  if (num <= 0) return { valid: false, error: 'Price must be positive' };
  if (num > MAX_PRICE) return { valid: false, error: `Price cannot exceed ${MAX_PRICE.toLocaleString()}` };
  return { valid: true };
}

export default function RelistPriceEditor({
  listing,
  sellerAddress,
  commitmentAsset,
  onPriceUpdated,
  marketplaceStats,
}: RelistPriceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(listing.price);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const toast = useToast();
  const inputId = useId();

  const isActive = listing.status === 'Active';
  const isCancelled = listing.status === 'Cancelled';

  const handleOpen = useCallback(() => {
    setPrice(listing.price);
    setValidationError(null);
    setIsEditing(true);
  }, [listing.price]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setValidationError(null);
    setPrice(listing.price);
  }, [listing.price]);

  const handleSubmit = useCallback(async () => {
    const validation = isValidPrice(price);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }
    setValidationError(null);
    setIsSubmitting(true);

    const previousPrice = listing.price;
    const numericPrice = Number(price.trim());

    try {
      if (isActive) {
        const cancelRes = await fetch(
          `/api/marketplace/listings/${encodeURIComponent(listing.id)}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sellerAddress}`,
            },
          },
        );

        if (!cancelRes.ok) {
          const data = await cancelRes.json().catch(() => ({}));
          throw new Error(data.message || data.error || 'Failed to cancel existing listing');
        }
      }

      const createRes = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitmentId: listing.commitmentId,
          price: numericPrice.toString(),
          currencyAsset: commitmentAsset,
          sellerAddress,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to create listing');
      }

      const formatted = numericPrice.toString();
      onPriceUpdated?.(formatted);
      toast.success({
        title: isActive ? 'Price updated' : 'Listing created',
        description: isActive
          ? `Price changed to ${formatted} ${commitmentAsset}`
          : `Commitment relisted at ${formatted} ${commitmentAsset}`,
      });
      setIsEditing(false);
    } catch (err) {
      setPrice(previousPrice);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error({
        title: 'Failed to update listing',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [price, isActive, listing.id, listing.commitmentId, commitmentAsset, sellerAddress, onPriceUpdated, toast, listing.price]);

  if (!isActive && !isCancelled) return null;

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] tracking-[0.05em] text-[#94A3B8]">
            Listing Price
          </span>
          <span className="text-[14px] font-semibold text-white">
            {listing.price} {listing.currencyAsset}
          </span>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1.5 rounded-[8px] border border-[rgba(15,240,252,0.2)] bg-[rgba(15,240,252,0.05)] px-2.5 py-1.5 text-[12px] font-semibold text-[#0FF0FC] transition-all duration-200 hover:bg-[rgba(15,240,252,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
            aria-label="Edit listing price"
          >
            <Pencil size={14} /> Edit price
          </button>
        )}
        {isCancelled && (
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1.5 rounded-[8px] border border-[rgba(5,223,114,0.3)] bg-[rgba(5,223,114,0.08)] px-2.5 py-1.5 text-[12px] font-semibold text-[#05DF72] transition-all duration-200 hover:bg-[rgba(5,223,114,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#05DF72]"
            aria-label="Relist commitment"
          >
            <RotateCcw size={14} /> Relist
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-[11px] tracking-[0.05em] text-[#94A3B8]"
      >
        {isActive ? 'Edit Price' : 'Set Price'}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setValidationError(null);
          }}
          disabled={isSubmitting}
          className="flex-1 rounded-[8px] border border-white/10 bg-[#050505] px-3 py-2 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="0.00"
          autoComplete="off"
          aria-label="Listing price"
          aria-invalid={!!validationError}
          aria-describedby={validationError ? `${inputId}-error` : undefined}
        />
        <span className="text-[12px] text-[#94A3B8] font-medium">
          {commitmentAsset}
        </span>
      </div>
      {marketplaceStats && (
        <div className="rounded-[6px] border border-white/5 bg-white/3 px-3 py-2 text-[11px] text-[#94A3B8]" aria-label="Marketplace price hints">
          <span className="mr-3">Floor: <strong className="text-white/80">{marketplaceStats.floorPrice} {commitmentAsset}</strong></span>
          <span className="mr-3">Median: <strong className="text-white/80">{marketplaceStats.medianPrice} {commitmentAsset}</strong></span>
          {marketplaceStats.lastSoldPrice && (
            <span>Last sold: <strong className="text-white/80">{marketplaceStats.lastSoldPrice} {commitmentAsset}</strong></span>
          )}
        </div>
      )}
      {validationError && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[11px] text-[#EF4444]"
        >
          {validationError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-[8px] border border-[rgba(5,223,114,0.3)] bg-[rgba(5,223,114,0.08)] px-2.5 py-1.5 text-[12px] font-semibold text-[#05DF72] transition-all duration-200 hover:bg-[rgba(5,223,114,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#05DF72] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isSubmitting ? 'Saving...' : 'Save price'}
        >
          {isSubmitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-[8px] border border-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white/80 transition-all duration-200 hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Cancel editing"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
