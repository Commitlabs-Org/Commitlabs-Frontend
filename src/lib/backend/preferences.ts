/**
 * @module preferences
 *
 * Durable off-chain storage for per-wallet user preferences.
 *
 * Storage adapter
 * ───────────────
 * The module ships with a JSON-file–backed adapter that lives in
 * `.mock-db.json` (the same file the rest of the mock layer uses).
 * The `PreferencesStore` interface is designed to be swapped for a
 * real database/KV adapter in production without touching any route code.
 *
 * Auth guard
 * ──────────
 * `requireWalletAuth` extracts and validates the `Authorization: Bearer
 * <sessionToken>` header, decodes the wallet address embedded in the
 * placeholder token, and returns it. It throws `UnauthorizedError` on
 * any failure so `withApiHandler` can surface a clean 401.
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { UnauthorizedError } from './errors';

// ─── Schema ──────────────────────────────────────────────────────────────────

/** Supported display currencies. Extend as needed. */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'XLM'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Zod schema used for both inbound PUT validation and storage serialisation.
 * All fields are optional so callers can perform partial updates.
 */
export const userPreferencesSchema = z.object({
    displayCurrency: z
        .enum(SUPPORTED_CURRENCIES, {
            errorMap: () => ({
                message: `displayCurrency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
            }),
        })
        .optional(),
    notifications: z
        .object({
            email: z.boolean().optional(),
            push: z.boolean().optional(),
            sms: z.boolean().optional(),
        })
        .optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z
        .string()
        .min(2)
        .max(10)
        .regex(/^[a-z]{2,3}(-[A-Z]{2,3})?$/, 'language must be a valid BCP-47 tag (e.g. "en", "en-US")')
        .optional(),
});

/** Shape returned/stored for a single wallet. */
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/** The defaults applied when no preferences exist yet. */
export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
    displayCurrency: 'USD',
    notifications: { email: true, push: true, sms: false },
    theme: 'system',
    language: 'en',
};

// ─── Storage Adapter Interface ───────────────────────────────────────────────

export interface PreferencesStore {
    get(address: string): Promise<UserPreferences | null>;
    upsert(address: string, prefs: UserPreferences): Promise<UserPreferences>;
}

// ─── JSON-File Adapter ───────────────────────────────────────────────────────

const mockDbPath = path.join(process.cwd(), '.mock-db.json');

/** Mutex-like write queue to avoid interleaved file writes during tests. */
let writeQueue: Promise<void> = Promise.resolve();

async function readRawDb(): Promise<Record<string, unknown>> {
    try {
        const raw = await fs.readFile(mockDbPath, 'utf8');
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}

async function writeRawDb(data: Record<string, unknown>): Promise<void> {
    await fs.writeFile(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Concrete `PreferencesStore` backed by `.mock-db.json`.
 * Preferences are stored under the top-level `"preferences"` key, keyed by
 * wallet address.
 */
export const jsonFilePreferencesStore: PreferencesStore = {
    async get(address: string): Promise<UserPreferences | null> {
        const db = await readRawDb();
        const map = (db.preferences ?? {}) as Record<string, UserPreferences>;
        return map[address] ?? null;
    },

    async upsert(address: string, prefs: UserPreferences): Promise<UserPreferences> {
        let result!: UserPreferences;
        writeQueue = writeQueue.then(async () => {
            const db = await readRawDb();
            const map = (db.preferences ?? {}) as Record<string, UserPreferences>;
            const existing = map[address] ?? {};
            const merged: UserPreferences = deepMerge(existing, prefs);
            map[address] = merged;
            db.preferences = map;
            await writeRawDb(db);
            result = merged;
        });
        await writeQueue;
        return result;
    },
};

/** Simple recursive merge (objects only; arrays are replaced). */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const out = { ...target };
    for (const key of Object.keys(source) as (keyof T)[]) {
        const sv = source[key];
        const tv = target[key];
        if (sv !== undefined) {
            if (
                isPlainObject(sv) &&
                isPlainObject(tv)
            ) {
                (out as Record<keyof T, unknown>)[key] = deepMerge(
                    tv as object,
                    sv as object,
                );
            } else {
                (out as Record<keyof T, unknown>)[key] = sv;
            }
        }
    }
    return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────

/**
 * Extracts the wallet address from the `Authorization: Bearer <token>` header.
 *
 * Current implementation supports the placeholder session tokens issued by
 * `createSessionToken` (format: `session_<address>_<timestamp>`).
 *
 * TODO: Replace with proper JWT verification once sessions are hardened.
 *
 * @throws {UnauthorizedError} if the header is absent, malformed, or the token
 *   cannot be decoded.
 */
export function requireWalletAuth(authHeader: string | null): string {
    if (!authHeader) {
        throw new UnauthorizedError('Authorization header is required.');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        throw new UnauthorizedError(
            'Authorization header must be in format: Bearer <token>',
        );
    }

    const token = parts[1];

    // Decode placeholder token: session_<address>_<timestamp>
    const match = token.match(/^session_([A-Z0-9]+)_\d+$/);
    if (!match) {
        throw new UnauthorizedError('Invalid or expired session token.');
    }

    const address = match[1];
    if (!address) {
        throw new UnauthorizedError('Could not resolve wallet address from token.');
    }

    return address;
}
