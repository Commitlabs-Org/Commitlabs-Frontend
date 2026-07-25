/**
 * Thin adapter over @stellar/freighter-api v1.7.1.
 *
 * v1.7.1 renamed getAddress → getPublicKey, removed requestAccess entirely,
 * changed isConnected/signature return shapes, and replaced signMessage with
 * signBlob (which expects base64-encoded input).
 *
 * This module re-exposes the legacy API surface so callers don't need to
 * change.
 */
import {
  getPublicKey,
  isConnected as freighterIsConnected,
  getNetworkDetails,
  signBlob,
} from "@stellar/freighter-api";

/** Result shape matching the legacy `getAddress` / `requestAccess` callers. */
export interface FreighterAddressResult {
  address?: string;
  error?: string;
}

/** Result shape for message signing. */
export interface FreighterSignResult {
  signedMessage?: string;
  error?: string;
}

/**
 * Retrieve the user's public key without prompting (if already authorized).
 */
export async function getAddress(): Promise<FreighterAddressResult> {
  try {
    const publicKey = await getPublicKey();
    return { address: publicKey };
  } catch (err) {
    return {
      error: (err as Error)?.message ?? "Unable to read wallet address.",
    };
  }
}

/**
 * Prompt the user to authorize the dApp and return their public key.
 *
 * In v1.7.1 there is no dedicated `requestAccess` helper — `getPublicKey`
 * itself triggers the Freighter permission dialog when the origin isn't
 * already on the allow list, so this delegates to `getAddress`.
 */
export const requestAccess = getAddress;

/**
 * Check whether the Freighter extension is installed and reachable.
 */
export async function isConnected(): Promise<boolean> {
  try {
    return await freighterIsConnected();
  } catch {
    return false;
  }
}

/**
 * Sign a message using the Freighter extension.
 *
 * v1.7.1 exports `signBlob` instead of `signMessage`.  `signBlob` base64-
 * decodes its input before signing, so we encode the message first so the
 * resulting signature is over the original UTF-8 bytes.
 */
export async function signMessage(
  message: string,
  opts?: { address?: string },
): Promise<FreighterSignResult> {
  try {
    const encoded = typeof btoa !== "undefined" ? btoa(message) : message;
    const signedMessage = await signBlob(encoded, {
      accountToSign: opts?.address,
    });
    return { signedMessage };
  } catch (err) {
    return {
      error: (err as Error)?.message ?? "User rejected the signature.",
    };
  }
}

export { getNetworkDetails };
