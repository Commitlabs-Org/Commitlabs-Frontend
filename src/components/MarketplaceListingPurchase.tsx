'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

interface MarketplaceListingPurchaseProps {
  listingId: string;
  price: string;
}

type PreflightResponse = {
  eligible: boolean;
  reasons: string[];
};

export function MarketplaceListingPurchase({ listingId, price }: MarketplaceListingPurchaseProps) {
  const { connected, address, connect, error: walletError, connecting } = useWallet();
  const [statusMessage, setStatusMessage] = useState<string>('Connect your wallet to check purchase eligibility.');
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<string | null>(null);

  const handleCheckEligibility = async () => {
    if (!address) {
      setStatusMessage('Connect your wallet first to verify purchase eligibility.');
      return;
    }

    setIsChecking(true);
    setStatusMessage('Checking purchase eligibility...');
    setReasons([]);

    try {
      const response = await fetch(`/api/marketplace/listings/${listingId}/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerAddress: address }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || 'Could not verify eligibility');
      }

      const result = body.data as PreflightResponse;
      setEligible(result.eligible);
      setReasons(result.reasons ?? []);
      setStatusMessage(
        result.eligible
          ? 'You are eligible to purchase this listing. Proceed when ready.'
          : 'Purchase is not currently eligible for your wallet.',
      );
    } catch (error) {
      setStatusMessage((error as Error).message || 'Unable to verify eligibility.');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setPurchaseResult(null);

    try {
      const response = await fetch(`/api/marketplace/listings/${listingId}/purchase`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message || 'Purchase failed');
      }

      setPurchaseResult('Purchase request submitted successfully. Review the transaction in your wallet or account activity.');
    } catch (error) {
      setPurchaseResult((error as Error).message || 'Purchase failed.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.26em] text-white/50">Selected listing</p>
        <p className="mt-3 text-3xl font-semibold text-white">{price}</p>
        <p className="mt-2 text-sm text-white/60">
          This listing uses the platform purchase flow to verify eligibility before completing a transaction.
        </p>
      </div>

      <div className="space-y-3 rounded-[20px] border border-white/10 bg-[#111111]/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Purchase status</p>
          {connected ? (
            <span className="rounded-full bg-[#0FF0FC14] px-3 py-1 text-[11px] font-semibold text-[#0FF0FC]">
              Wallet connected
            </span>
          ) : (
            <span className="rounded-full bg-[#ffffff0d] px-3 py-1 text-[11px] font-semibold text-white/80">
              Wallet disconnected
            </span>
          )}
        </div>

        <p className="text-sm leading-6 text-white/70">{statusMessage}</p>

        {walletError && (
          <p className="text-sm text-[#FFB085]">{walletError}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#0FF0FC] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={connected ? handleCheckEligibility : connect}
            disabled={isChecking || isPurchasing}
          >
            {connected ? (isChecking ? 'Checking...' : eligible === true ? 'Re-check eligibility' : 'Check eligibility') : connecting ? 'Connecting…' : 'Connect wallet'}
          </button>

          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-[14px] border border-[#0FF0FC] bg-[#0FF0FC0D] px-4 text-sm font-semibold text-[#0FF0FC] transition hover:bg-[#0FF0FC14] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handlePurchase}
            disabled={!eligible || isPurchasing}
          >
            {isPurchasing ? 'Submitting…' : 'Purchase now'}
          </button>
        </div>

        {reasons.length > 0 && (
          <div className="rounded-[16px] border border-[#FFB08533] bg-[#FFB0850D] p-4 text-sm text-[#FFB085]">
            <p className="font-semibold">Eligibility issues</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {purchaseResult && (
          <div className="rounded-[16px] border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {purchaseResult}
          </div>
        )}
      </div>
    </div>
  );
}
