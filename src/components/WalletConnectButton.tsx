"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";

const truncateAddress = (address: string) =>
  address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "";

const walletErrorMessage = (error: string | null) => {
  if (!error) return "";

  const normalized = error.toLowerCase();

  if (
    normalized.includes("freighter") ||
    normalized.includes("not installed") ||
    normalized.includes("not found")
  ) {
    return "Freighter is not available. Install it from freighter.app and refresh to continue.";
  }

  if (
    normalized.includes("reject") ||
    normalized.includes("denied") ||
    normalized.includes("cancel")
  ) {
    return "Connection canceled in Freighter. Try again when you are ready.";
  }

  return "Unable to connect your wallet. Try again or check Freighter in your browser.";
};

export const WalletConnectButton: React.FC = () => {
  const { connected, address, connect, disconnect, error, connecting } =
    useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const errorMessage = walletErrorMessage(error);

  return (
    <div className="relative inline-flex flex-col items-end gap-2 max-w-[240px]">
      {connected ? (
        <div ref={containerRef} className="relative inline-block text-left">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] px-4 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Connected wallet ${truncateAddress(address)}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>{truncateAddress(address)}</span>
            <svg
              className="ml-2 h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="origin-top-right absolute right-0 mt-2 w-48 rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] shadow-[0_0_22px_rgba(0,0,0,0.45)] ring-1 ring-white ring-opacity-10"
              role="menu"
              aria-label="Wallet account menu"
            >
              <div className="py-1">
                <button
                  type="button"
                  className="block w-full rounded-[14px] px-4 py-2 text-left text-sm text-white transition-colors duration-200 ease-[ease] hover:bg-[rgba(0,212,255,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  role="menuitem"
                  onClick={() => {
                    disconnect();
                    setMenuOpen(false);
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] px-6 py-2 text-sm font-medium text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={connect}
          disabled={connecting}
          aria-live="polite"
        >
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
      )}

      {errorMessage ? (
        <p
          role="alert"
          className="max-w-[240px] text-left text-[13px] leading-5 text-[#F8C3C3]"
          aria-live="polite"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
