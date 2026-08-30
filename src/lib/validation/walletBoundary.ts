export type GateReason =
  'DISCONNECTED' | 'WRONG_NETWORK' | 'UNAUTHENTICATED' | 'TAMPERED' | 'EXPIRED';

export interface WalletGateInput {
  connected: boolean;
  address: string;
  authenticated: boolean;
  walletNetwork: string | null;
  expectedNetwork: string | null;
}

export interface GateResult {
  ok: boolean;
  reason?: GateReason;
  message?: string;
}

const MESSAGES: Record<GateReason, string> = {
  DISCONNECTED: 'Wallet is not connected. Connect your wallet to continue.',
  WRONG_NETWORK: 'Your wallet is connected to the wrong network. Switch network and try again.',
  UNAUTHENTICATED: 'Wallet is not authenticated. Please sign in.',
  TAMPERED: 'Draft data is invalid or has been tampered with.',
  EXPIRED: 'Draft has expired.',
};

export function checkWalletBoundary(input: WalletGateInput): GateResult {
  if (!input.connected || !input.address) {
    return { ok: false, reason: 'DISCONNECTED', message: MESSAGES.DISCONNECTED };
  }
  if (
    input.expectedNetwork &&
    input.walletNetwork &&
    input.walletNetwork !== input.expectedNetwork
  ) {
    return { ok: false, reason: 'WRONG_NETWORK', message: MESSAGES.WRONG_NETWORK };
  }
  // If expectedNetwork set but walletNetwork is null (could not fetch), allow but warn via separate path; here we block only on mismatch
  if (!input.authenticated) {
    return { ok: false, reason: 'UNAUTHENTICATED', message: MESSAGES.UNAUTHENTICATED };
  }
  return { ok: true };
}

export function checkNetworkOnly(
  walletNetwork: string | null,
  expectedNetwork: string | null,
): GateResult {
  if (expectedNetwork && walletNetwork && walletNetwork !== expectedNetwork) {
    return { ok: false, reason: 'WRONG_NETWORK', message: MESSAGES.WRONG_NETWORK };
  }
  return { ok: true };
}

export function isDisconnected(input: WalletGateInput): boolean {
  return !input.connected || !input.address;
}
