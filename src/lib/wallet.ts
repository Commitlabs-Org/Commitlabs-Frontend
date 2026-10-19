import { HORIZON_URL, friendbotAccountUrl } from './config';
import { fetchJson, type HttpErrorKind } from './http';

export type XlmBalanceResult =
  | { status: 'success'; balance: string }
  | { status: 'unfunded'; message: string; friendbotUrl: string }
  | { status: 'error'; message: string; kind: HttpErrorKind; canRetry: boolean };

export interface FetchXlmBalanceOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
}

export interface WalletState {
  status: 'idle' | 'connecting' | 'connected' | 'unavailable' | 'error';
  address: string | null;
  message: string | null;
}

/* Freighter is optional: any failure resolves to a readable fallback message. */
export async function connectFreighter(): Promise<WalletState> {
  try {
    const f = await import('@stellar/freighter-api');
    const connected = await f.isConnected();
    if (!connected) {
      return {
        status: 'unavailable',
        address: null,
        message: 'Freighter extension not detected. Install it from freighter.app to connect.',
      };
    }
    const address = await f.getPublicKey();
    if (!address) {
      return { status: 'error', address: null, message: 'Wallet access was not granted.' };
    }
    return { status: 'connected', address, message: null };
  } catch {
    return {
      status: 'unavailable',
      address: null,
      message: 'Wallet could not be reached. You can keep using the app in demo mode.',
    };
  }
}

export async function fetchXlmBalance(
  address: string,
  options?: FetchXlmBalanceOptions,
): Promise<XlmBalanceResult> {
  const result = await fetchJson<{
    balances?: Array<{ asset_type: string; balance: string }>;
  }>(`${HORIZON_URL}/accounts/${address}`, {
    signal: options?.signal,
    timeoutMs: options?.timeoutMs,
    retries: options?.retries,
  });

  if (result.ok) {
    const native = result.data.balances?.find((b) => b.asset_type === 'native')?.balance ?? '0';
    return { status: 'success', balance: native };
  }

  if (result.kind === 'http' && result.status === 404) {
    return {
      status: 'unfunded',
      message: 'Account not funded on testnet',
      friendbotUrl: friendbotAccountUrl(address),
    };
  }

  const message =
    result.kind === 'timeout'
      ? "Couldn't load balance: request timed out"
      : result.kind === 'network'
        ? "Couldn't load balance: network error"
        : `Couldn't load balance (status ${result.status})`;

  return {
    status: 'error',
    message,
    kind: result.kind,
    canRetry: true,
  };
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}
