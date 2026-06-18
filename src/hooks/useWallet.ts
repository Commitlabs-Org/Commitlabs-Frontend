import { getAddress } from "@stellar/freighter-api";
import { useState, useEffect, useCallback } from "react";

/**
 * Hook to manage wallet connection state using Freighter.
 * Returns connection status, address, and actions to connect/disconnect.
 */
export const useWallet = () => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchAddress = useCallback(async () => {
    setConnecting(true);

    try {
      const result = await getAddress();

      if (result.error) {
        setError(result.error);
        setConnected(false);
        setAddress("");
      } else if (result.address) {
        setAddress(result.address);
        setConnected(true);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message || "Unable to connect to Freighter.");
      setConnected(false);
      setAddress("");
    } finally {
      setConnecting(false);
    }
  }, []);

  const connect = useCallback(() => {
    setError(null);
    fetchAddress();
  }, [fetchAddress]);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress("");
    setError(null);
    setConnecting(false);
  }, []);

  // Auto-detect on mount (e.g., if already connected)
  useEffect(() => {
    fetchAddress();
  }, [fetchAddress]);

  return { connected, address, connect, disconnect, error, connecting };
};
