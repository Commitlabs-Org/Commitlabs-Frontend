import { getAddress, getNetworkDetails, signMessage } from "@stellar/freighter-api";
import { useState, useEffect, useCallback, useRef } from "react";

const WALLET_TIMEOUT_MS = 10000;

const getExpectedWalletNetwork = (): string | null => {
  if (typeof process !== "undefined") {
    const envPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    if (envPassphrase?.trim()) {
      return envPassphrase.trim();
    }
  }
  return null;
};

const normalizeWalletError = (message: unknown): string => {
  const rawMessage =
    typeof message === "string"
      ? message
      : message instanceof Error
        ? message.message
        : "";
  const normalized = rawMessage.trim().toLowerCase();

  if (!normalized) {
    return "Unable to connect to Freighter. Please try again.";
  }

  if (
    normalized.includes("not installed") ||
    normalized.includes("not available") ||
    normalized.includes("extension unavailable") ||
    normalized.includes("freighter is not") ||
    normalized.includes("not found")
  ) {
    return "Freighter is not installed or unavailable. Install it from freighter.app and refresh to continue.";
  }

  if (
    normalized.includes("reject") ||
    normalized.includes("denied") ||
    normalized.includes("cancel") ||
    normalized.includes("user cancelled")
  ) {
    return "Wallet prompt was rejected. Please try again if you want to continue.";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "Freighter request timed out. Please try again.";
  }

  if (normalized.includes("network") || normalized.includes("passphrase")) {
    return "Your wallet is connected to the wrong network. Switch Freighter to the correct network and try again.";
  }

  if (normalized.includes("freighter") || normalized.includes("locked") || normalized.includes("unavailable")) {
    return "Freighter is unavailable right now. Please unlock or reopen Freighter and try again.";
  }

  return "Unable to connect to Freighter. Please try again.";
};

const withWalletTimeout = async <T,>(promise: Promise<T>, fallbackMessage: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return await new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(fallbackMessage)), WALLET_TIMEOUT_MS);

    promise.then(resolve, reject).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  });
};

interface SessionCheckResult {
  authenticated: boolean;
  address?: string;
}

/**
 * Asks the server whether the HttpOnly session cookie (set by
 * /api/auth/verify) is still valid. The session token itself is never
 * readable from client-side JavaScript.
 */
const checkSession = async (): Promise<SessionCheckResult> => {
  try {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return { authenticated: false };
    const json = await res.json();
    const data = json.data || json;
    if (data.authenticated && data.address) {
      return { authenticated: true, address: data.address };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
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
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // signIn() sometimes has to set `address`/`connected` itself (when it
  // starts without an already-connected wallet), which would otherwise
  // re-trigger the "sync auth state with server" effect below concurrently
  // with signIn's own in-progress nonce/verify flow - racing its
  // checkSession() call against signIn's own setAuthenticated(true) once it
  // completes. signIn is authoritative for its own outcome, so it flips this
  // flag to tell that effect to skip the redundant round-trip once.
  const skipNextAuthSyncRef = useRef(false);

  const fetchAddress = useCallback(async () => {
    setConnecting(true);

    try {
      const result = await withWalletTimeout(getAddress(), "Freighter request timed out while checking your wallet.");

      if (result.error) {
        const message = normalizeWalletError(result.error);
        setError(message);
        setConnected(false);
        setAddress("");
        setWalletNetwork(null);
      } else if (result.address) {
        const expectedNetwork = getExpectedWalletNetwork();
        setAddress(result.address);
        setConnected(true);
        setError(null);

        try {
          const details = await withWalletTimeout(getNetworkDetails(), "Freighter request timed out while checking the wallet network.");
          const networkPassphrase = details.networkPassphrase ?? null;
          setWalletNetwork(networkPassphrase);

          if (expectedNetwork && networkPassphrase && networkPassphrase !== expectedNetwork) {
            setError("Your wallet is connected to the wrong network. Switch Freighter to the correct network and try again.");
          }
        } catch {
          setWalletNetwork(null);
        }
      }
    } catch (e) {
      const message = normalizeWalletError(e);
      setError(message);
      setConnected(false);
      setAddress("");
      setWalletNetwork(null);
    } finally {
      setConnecting(false);
      setInitialCheckDone(true);
    }
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    await fetchAddress();
  }, [fetchAddress]);

  const signOut = useCallback(async () => {
    try {
      // The HttpOnly session cookie is sent automatically; the server reads
      // it to know which session to revoke.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } finally {
      setAuthenticated(false);
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
        const result = await withWalletTimeout(getAddress(), "Freighter request timed out while preparing authentication.");
        if (result.error) {
          throw new Error(normalizeWalletError(result.error));
        }
        if (!result.address) {
          throw new Error("Unable to retrieve address from Freighter.");
        }
        currentAddress = result.address;
        skipNextAuthSyncRef.current = true;
        setAddress(currentAddress);
        setConnected(true);
        setError(null);
      }

      const nonceRes = await withWalletTimeout(
        fetch("/api/auth/nonce", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: currentAddress }),
        }),
        "Authentication timed out while fetching the nonce."
      );

      if (!nonceRes.ok) {
        throw new Error("Failed to fetch authentication nonce.");
      }

      const nonceData = await nonceRes.json();
      const data = nonceData.data || nonceData;
      const message = data.message;
      if (!message) {
        throw new Error("Nonce response is missing the challenge message.");
      }

      const signResult = await withWalletTimeout(
        signMessage(message, { address: currentAddress }),
        "Authentication timed out while requesting a signature."
      );
      if (!signResult) {
        throw new Error("No response received from Freighter.");
      }
      if (signResult.error) {
        throw new Error(signResult.error);
      }
      if (!signResult.signedMessage) {
        throw new Error("User rejected the signature or no signature returned.");
      }

      const verifyRes = await withWalletTimeout(
        fetch("/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: currentAddress,
            signature: signResult.signedMessage,
            message: message,
          }),
        }),
        "Authentication timed out while verifying your signature."
      );

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error?.message || errData.message || "Signature verification failed.");
      }

      const verifyData = await verifyRes.json();
      const vData = verifyData.data || verifyData;
      const { verified } = vData;

      if (!verified) {
        throw new Error("Verification failed.");
      }

      // The server has set the HttpOnly session cookie on this response;
      // there is no token for the client to hold onto.
      setAuthenticated(true);
      setAuthError(null);
      setError(null);
    } catch (e) {
      const msg = (e as Error).message || "Authentication handshake failed.";
      setAuthError(msg);
      setError(msg);
      setAuthenticated(false);
      setConnected(false);
      setAddress("");
      setWalletNetwork(null);
      throw e;
    } finally {
      setAuthenticating(false);
    }
  }, [address, connected, authenticating]);

  // Auto-detect on mount
  useEffect(() => {
    fetchAddress();
  }, [fetchAddress]);

  // Sync auth state with the server once the Freighter connection check
  // completes, or whenever the connected address changes. The session lives
  // exclusively in the HttpOnly cookie, so the only way to know if it's
  // still valid is to ask the server.
  //
  // Skipped once when signIn() itself just set `connected`/`address` (see
  // skipNextAuthSyncRef above) - signIn already determines the authoritative
  // outcome via its own nonce/verify flow, so a redundant checkSession() call
  // here would race against signIn's own setAuthenticated(true) and could
  // clobber it depending on which one resolves last.
  useEffect(() => {
    if (!initialCheckDone) return;
    if (skipNextAuthSyncRef.current) {
      skipNextAuthSyncRef.current = false;
      return;
    }
    let cancelled = false;

    (async () => {
      if (!connected || !address) {
        if (!cancelled) setAuthenticated(false);
        return;
      }

      const session = await checkSession();
      if (cancelled) return;

      if (session.authenticated && session.address === address) {
        setAuthenticated(true);
      } else if (session.authenticated) {
        // The authenticated session belongs to a different address than the
        // one Freighter now reports (e.g. the user switched accounts) -
        // drop the stale session rather than trust it.
        await signOut();
      } else {
        setAuthenticated(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, connected, initialCheckDone, signOut]);

  return {
    connected,
    address,
    connect,
    disconnect,
    error,
    connecting,
    authenticated,
    authenticating,
    authError,
    signIn,
    signOut,
    walletNetwork,
  };
};
