export type HttpErrorKind = 'timeout' | 'network' | 'http';

export type FetchJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; kind: HttpErrorKind; status?: number; error: string; data?: unknown };

export interface FetchJsonOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    return `${parsed.protocol === 'http:' && !rawUrl.startsWith('http:') ? '' : parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split('?')[0].split('#')[0];
  }
}

function logDevError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(`[fetchJson] ${message}`, error ?? '');
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<FetchJsonResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryDelayMs = 0,
    signal: externalSignal,
    ...fetchInit
  } = options;

  const maxAttempts = Math.max(1, retries + 1);
  const cleanUrl = sanitizeUrl(url);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (externalSignal?.aborted) {
      const errMessage = 'Request was cancelled';
      return { ok: false, kind: 'network', error: errMessage };
    }

    const controller = new AbortController();
    let isTimeout = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Link external abort signal if provided
    let abortListener: (() => void) | undefined;
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        abortListener = () => controller.abort(externalSignal.reason);
        externalSignal.addEventListener('abort', abortListener, { once: true });
      }
    }

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        isTimeout = true;
        controller.abort(new Error('Request timed out'));
      }, timeoutMs);
    }

    try {
      const res = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
      if (abortListener && externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }

      if (!res.ok) {
        let bodyData: unknown = undefined;
        try {
          bodyData = await res.json();
        } catch {
          // Response body was not JSON or empty
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const displayUrl = isProduction ? cleanUrl : url;
        const errMsg = `HTTP error ${res.status}: ${res.statusText || 'Request failed'} (${displayUrl})`;

        logDevError(errMsg, bodyData);

        return {
          ok: false,
          kind: 'http',
          status: res.status,
          error: errMsg,
          data: bodyData,
        };
      }

      const data = (await res.json()) as T;
      return {
        ok: true,
        data,
        status: res.status,
      };
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      if (abortListener && externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }

      // If caller externally triggered abort, exit immediately without retries
      if (externalSignal?.aborted) {
        return { ok: false, kind: 'network', error: 'Request was cancelled' };
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const displayUrl = isProduction ? cleanUrl : url;

      if (isTimeout) {
        if (attempt < maxAttempts - 1) {
          if (retryDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
          continue;
        }

        const errMsg = `Request timed out after ${timeoutMs}ms (${displayUrl})`;
        logDevError(errMsg);
        return {
          ok: false,
          kind: 'timeout',
          error: errMsg,
        };
      }

      // General network error
      if (attempt < maxAttempts - 1) {
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
        continue;
      }

      const rawMsg = err instanceof Error ? err.message : String(err);
      const errMsg = isProduction
        ? `Network request failed (${displayUrl})`
        : `Network request failed: ${rawMsg} (${displayUrl})`;

      logDevError(errMsg, err);

      return {
        ok: false,
        kind: 'network',
        error: errMsg,
      };
    }
  }

  return {
    ok: false,
    kind: 'network',
    error: `Request failed after ${maxAttempts} attempts (${cleanUrl})`,
  };
}
