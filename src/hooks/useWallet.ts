import { getAddress, getNetworkDetails, signMessage } from "@stellar/freighter-api";
import { useState, useEffect, useCallback } from "react";

const STORED_TOKEN_KEYS = [
  "commitlabs.sessionToken",
  "commitlabs:sessionToken",
  "sessionToken",
];

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  for (const key of STORED_TOKEN_KEYS) {
    const val = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    if (val?.trim()) return val.trim();
  }
  // Try reading from cookies
  const cookies = document.cookie.split(";");
  for (const c of cookies) {
    const [name, val] = c.trim().split("=");
    if (name === "session" && val) return decodeURIComponent(val);
  }
  return null;
};

const getStoredAddress = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("commitlabs.authAddress") ?? window.localStorage.getItem("commitlabs.authAddress");
};

const saveSession = (token: string, addr: string) => {
  if (typeof window === "undefined") return;
  for (const key of STORED_TOKEN_KEYS) {
    window.localStorage.setItem(key, token);
    window.sessionStorage.setItem(key, token);
  }
  window.localStorage.setItem("commitlabs.authAddress", addr);
  window.sessionStorage.setItem("commitlabs.authAddress", addr);

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `session=${encodeURIComponent(token)}; path=/; SameSite=Lax${secureFlag}`;
};

const clearSession = () => {
  if (typeof window === "undefined") return;
  for (const key of STORED_TOKEN_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
  window.localStorage.removeItem("commitlabs.authAddress");
  window.sessionStorage.removeItem("commitlabs.authAddress");

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secureFlag}`;
  // Fallbacks for testing environments or strict cookie parsers
  document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = "session=; max-age=0";
};

/**
 * Hook to manage wallet connection state and message-signing authentication.
 */
export const useWallet = () => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);

  // Authentication State
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredToken());
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchAddress = useCallback(async () => {
    setConnecting(true);

    try {
      const result = await getAddress();

      if (result.error) {
        setError(result.error);
        setConnected(false);
        setAddress("");
        setWalletNetwork(null);
      } else if (result.address) {
        setAddress(result.address);
        setConnected(true);
        setError(null);
        try {
          const details = await getNetworkDetails();
          setWalletNetwork(details.networkPassphrase ?? null);
        } catch {
          setWalletNetwork(null);
        }
      }
    } catch (e) {
      setError((e as Error).message || "Unable to connect to Freighter.");
      setConnected(false);
      setAddress("");
      setWalletNetwork(null);
    } finally {
      setConnecting(false);
      setInitialCheckDone(true);
    }
  }, []);

  const connect = useCallback(() => {
    setError(null);
    fetchAddress();
  }, [fetchAddress]);

  const signOut = useCallback(async () => {
    try {
      const storedToken = getStoredToken();
      if (storedToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${storedToken}`,
          },
        }).catch(() => {});
      }
    } finally {
      clearSession();
      setSessionToken(null);
      setAuthError(null);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress("");
    setError(null);
    setConnecting(false);
    setWalletNetwork(null);
    signOut();
  }, [signOut]);

  const signIn = useCallback(async () => {
    if (authenticating) return;

    setAuthenticating(true);
    setAuthError(null);

    try {
      let currentAddress = address;
      if (!connected || !currentAddress) {
        const result = await getAddress();
        if (result.error) {
          throw new Error(result.error);
        }
        if (!result.address) {
          throw new Error("Unable to retrieve address from Freighter.");
        }
        currentAddress = result.address;
        setAddress(currentAddress);
        setConnected(true);
        setError(null);
      }

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: currentAddress }),
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to fetch authentication nonce.");
      }

      const nonceData = await nonceRes.json();
      const data = nonceData.data || nonceData;
      const message = data.message;
      if (!message) {
        throw new Error("Nonce response is missing the challenge message.");
      }

      const signResult = await signMessage(message, { address: currentAddress });
      if (!signResult) {
        throw new Error("No response received from Freighter.");
      }
      if (signResult.error) {
        throw new Error(signResult.error);
      }
      if (!signResult.signedMessage) {
        throw new Error("User rejected the signature or no signature returned.");
      }

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: currentAddress,
          signature: signResult.signedMessage,
          message: message,
        }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || errData.message || "Signature verification failed.");
      }

      const verifyData = await verifyRes.json();
      const vData = verifyData.data || verifyData;
      const { verified, sessionToken: token } = vData;

      if (!verified || !token) {
        throw new Error("Verification failed: Session token not received.");
      }

      saveSession(token, currentAddress);
      setSessionToken(token);
      setAuthError(null);
    } catch (e) {
      const msg = (e as Error).message || "Authentication handshake failed.";
      setAuthError(msg);
      clearSession();
      setSessionToken(null);
      throw e;
    } finally {
      setAuthenticating(false);
    }
  }, [address, connected, authenticating]);

  // Auto-detect on mount
  useEffect(() => {
    fetchAddress();
  }, [fetchAddress]);

  // Sync session state once connection check completes or when address/connected changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialCheckDone) return;

    const storedToken = getStoredToken();
    const storedAddress = getStoredAddress();

    if (connected && address) {
      if (storedToken && storedAddress === address) {
        setSessionToken(storedToken);
      } else {
        clearSession();
        setSessionToken(null);
      }
    } else {
      clearSession();
      setSessionToken(null);
    }
  }, [address, connected, initialCheckDone]);

  const authenticated = !!sessionToken;

  return {
    connected,
    address,
    connect,
    disconnect,
    error,
    connecting,
    sessionToken,
    authenticated,
    authenticating,
    authError,
    signIn,
    signOut,
    walletNetwork,
  };
};
