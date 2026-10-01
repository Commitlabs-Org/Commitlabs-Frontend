/**
 * Application-shell navigation boundary.
 *
 * All sensitive shell actions (protected route entry, owner-scoped links,
 * numeric query params, and session snapshots used to drive the chrome)
 * must pass through these invariants. Client-side "connected" flags are
 * never treated as proof of ownership or network membership.
 */

export const SHELL_PUBLIC_ROUTES = ['/', '/marketplace'] as const;
export const SHELL_PROTECTED_ROUTES = ['/analytics', '/create', '/settings'] as const;

export const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;
export const DEFAULT_MAX_NAV_AGE_MS = 5 * 60 * 1000;

export type BoundaryErrorCode =
  | 'INVALID_ROUTE'
  | 'DISCONNECTED_WALLET'
  | 'INVALID_ADDRESS'
  | 'WRONG_NETWORK'
  | 'TAMPERED_OWNERSHIP'
  | 'REPLAYED_REQUEST'
  | 'INVALID_NUMERIC'
  | 'MALFORMED_RESPONSE';

export type CanonicalRoute = {
  pathname: string;
  protected: boolean;
  ownerHint: string | null;
  numericParams: Record<string, number>;
};

export type NormalizedAuth = {
  address: string;
  networkPassphrase: string;
};

export type ShellAuthInput = {
  address?: string | null;
  connected?: boolean;
  networkPassphrase?: string | null;
  expectedNetworkPassphrase?: string | null;
};

export type ShellRouteInput = {
  pathname?: string | null;
  search?: string | URLSearchParams | Record<string, string | string[] | undefined> | null;
};

export type NavigationIntent = {
  nonce?: string | null;
  issuedAt?: number | null;
  now?: number;
  maxAgeMs?: number;
  seenNonces?: ReadonlySet<string>;
};

export type SessionSnapshot = {
  address?: unknown;
  networkPassphrase?: unknown;
  owner?: unknown;
  ok?: unknown;
};

export type BoundaryFailure = {
  ok: false;
  code: BoundaryErrorCode;
  message: string;
  recoverable: boolean;
};

export type BoundarySuccess = {
  ok: true;
  route: CanonicalRoute;
  auth: NormalizedAuth | null;
};

export type BoundaryDecision = BoundarySuccess | BoundaryFailure;

const PROTECTED = new Set<string>(SHELL_PROTECTED_ROUTES);
const PUBLIC = new Set<string>(SHELL_PUBLIC_ROUTES);

export function normalizePathname(pathname: string | null | undefined): string | null {
  if (typeof pathname !== 'string') return null;
  const trimmed = pathname.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    /%[0-9a-fA-F]{2}/.test(trimmed)
  ) {
    return null;
  }
  if (trimmed.length > 256) return null;
  const noQuery = trimmed.split('?')[0].split('#')[0];
  const collapsed = noQuery.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

export function isProtectedPath(pathname: string): boolean {
  if (PROTECTED.has(pathname)) return true;
  for (const prefix of SHELL_PROTECTED_ROUTES) {
    if (pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isKnownPath(pathname: string): boolean {
  if (PUBLIC.has(pathname) || PROTECTED.has(pathname)) return true;
  for (const prefix of [...SHELL_PUBLIC_ROUTES, ...SHELL_PROTECTED_ROUTES]) {
    if (prefix !== '/' && pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isValidStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && STELLAR_ADDRESS_PATTERN.test(value);
}

export function parseSearch(search: ShellRouteInput['search']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!search) return out;

  if (typeof search === 'string') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    params.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  if (typeof URLSearchParams !== 'undefined' && search instanceof URLSearchParams) {
    search.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  if (typeof search === 'object') {
    for (const [key, raw] of Object.entries(search)) {
      if (typeof raw === 'string') out[key] = raw;
      else if (Array.isArray(raw) && typeof raw[0] === 'string') out[key] = raw[0];
    }
  }

  return out;
}

const NUMERIC_KEYS = ['page', 'limit', 'amount', 'step', 'offset'] as const;

export function parseNumericParams(params: Record<string, string>):
  | {
      ok: true;
      values: Record<string, number>;
    }
  | {
      ok: false;
      key: string;
    } {
  const values: Record<string, number> = {};
  for (const key of NUMERIC_KEYS) {
    if (!(key in params)) continue;
    const raw = params[key];
    if (!/^[0-9]+$/.test(raw)) return { ok: false, key };
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000) {
      return { ok: false, key };
    }
    values[key] = parsed;
  }
  return { ok: true, values };
}

function fail(code: BoundaryErrorCode, message: string, recoverable: boolean): BoundaryFailure {
  return { ok: false, code, message, recoverable };
}

export function evaluateNavigationBoundary(
  routeInput: ShellRouteInput,
  authInput: ShellAuthInput,
  intent: NavigationIntent = {},
): BoundaryDecision {
  const pathname = normalizePathname(routeInput.pathname);
  if (!pathname || !isKnownPath(pathname)) {
    return fail('INVALID_ROUTE', 'Route is missing or not a recognized shell path.', true);
  }

  const params = parseSearch(routeInput.search);
  const numeric = parseNumericParams(params);
  if (!numeric.ok) {
    return fail(
      'INVALID_NUMERIC',
      `Numeric query parameter "${numeric.key}" is not a safe integer.`,
      true,
    );
  }

  const ownerHint = params.owner ?? params.address ?? params.wallet ?? null;
  if (ownerHint && !isValidStellarAddress(ownerHint)) {
    return fail('INVALID_ADDRESS', 'Owner hint in the route is not a valid Stellar address.', true);
  }

  const route: CanonicalRoute = {
    pathname,
    protected: isProtectedPath(pathname),
    ownerHint,
    numericParams: numeric.values,
  };

  if (!route.protected && !ownerHint) {
    return { ok: true, route, auth: null };
  }

  const claimedAddress = typeof authInput.address === 'string' ? authInput.address.trim() : '';
  const connectedFlag = authInput.connected === true;

  // Ownership and connection are checked from the presented identity, not the flag.
  if (!claimedAddress || !isValidStellarAddress(claimedAddress)) {
    return fail(
      'DISCONNECTED_WALLET',
      'A connected wallet with a valid address is required for this navigation.',
      true,
    );
  }

  if (!connectedFlag) {
    return fail(
      'DISCONNECTED_WALLET',
      'Wallet is disconnected. Reconnect before opening a protected page.',
      true,
    );
  }

  const network = authInput.networkPassphrase?.trim() ?? '';
  const expected = authInput.expectedNetworkPassphrase?.trim() ?? '';
  if (expected && network !== expected) {
    return fail(
      'WRONG_NETWORK',
      'Wallet is on the wrong network. Switch Freighter to the expected network.',
      true,
    );
  }
  if (!network) {
    return fail('WRONG_NETWORK', 'Wallet network could not be verified.', true);
  }

  if (ownerHint && ownerHint !== claimedAddress) {
    return fail(
      'TAMPERED_OWNERSHIP',
      'Route owner does not match the connected wallet identity.',
      false,
    );
  }

  const now = intent.now ?? Date.now();
  const maxAge = intent.maxAgeMs ?? DEFAULT_MAX_NAV_AGE_MS;
  if (intent.issuedAt != null) {
    if (!Number.isFinite(intent.issuedAt) || intent.issuedAt > now + 1000) {
      return fail('REPLAYED_REQUEST', 'Navigation timestamp is invalid or from the future.', false);
    }
    if (now - intent.issuedAt > maxAge) {
      return fail('REPLAYED_REQUEST', 'Navigation request has expired.', true);
    }
  }
  if (intent.nonce) {
    if (intent.seenNonces?.has(intent.nonce)) {
      return fail('REPLAYED_REQUEST', 'Navigation nonce has already been used.', false);
    }
  }

  return {
    ok: true,
    route,
    auth: {
      address: claimedAddress,
      networkPassphrase: network,
    },
  };
}

export function validateSessionSnapshot(
  payload: unknown,
  expectedAddress?: string | null,
): BoundaryDecision {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('MALFORMED_RESPONSE', 'Session snapshot is not an object.', true);
  }

  const snapshot = payload as SessionSnapshot;
  if (snapshot.ok === false) {
    return fail('MALFORMED_RESPONSE', 'Session snapshot reported failure.', true);
  }

  const address = snapshot.address ?? snapshot.owner;
  if (address != null && !isValidStellarAddress(address)) {
    return fail('MALFORMED_RESPONSE', 'Session snapshot address is malformed.', false);
  }

  if (expectedAddress && typeof address === 'string' && address !== expectedAddress) {
    return fail('TAMPERED_OWNERSHIP', 'Session snapshot owner does not match the wallet.', false);
  }

  const network =
    typeof snapshot.networkPassphrase === 'string' ? snapshot.networkPassphrase.trim() : '';
  if (typeof address === 'string' && !network) {
    return fail('MALFORMED_RESPONSE', 'Session snapshot is missing network membership.', true);
  }

  const pathname = '/';
  return {
    ok: true,
    route: { pathname, protected: false, ownerHint: null, numericParams: {} },
    auth: typeof address === 'string' ? { address, networkPassphrase: network } : null,
  };
}

export function canActivateNavItem(href: string, authInput: ShellAuthInput): BoundaryDecision {
  return evaluateNavigationBoundary({ pathname: href }, authInput);
}
