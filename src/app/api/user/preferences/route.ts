/**
 * @file /api/user/preferences
 *
 * GET  – Returns the authenticated wallet's current preferences.
 *        Missing preferences are initialised to `DEFAULT_PREFERENCES`.
 *
 * PUT  – Partially updates the authenticated wallet's preferences.
 *        Only supplied fields are written; omitted fields retain their
 *        previous values (deep-merge semantics).
 *
 * Auth
 * ────
 * Both methods require a valid `Authorization: Bearer <sessionToken>` header.
 * Missing / invalid tokens yield 401 Unauthorized.
 *
 * Validation
 * ──────────
 * PUT bodies are validated with `userPreferencesSchema` (Zod).
 * Validation failures yield 400 with field-level error details.
 */

import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { ValidationError } from '@/lib/backend/errors';
import {
    userPreferencesSchema,
    DEFAULT_PREFERENCES,
    jsonFilePreferencesStore,
    requireWalletAuth,
    type PreferencesStore,
} from '@/lib/backend/preferences';

// Allow injection of a custom store in tests.
let _store: PreferencesStore = jsonFilePreferencesStore;
export function __setStoreForTesting(store: PreferencesStore): void {
    _store = store;
}
export function __resetStore(): void {
    _store = jsonFilePreferencesStore;
}

// ─── GET /api/user/preferences ───────────────────────────────────────────────

/**
 * @openapi
 * /api/user/preferences:
 *   get:
 *     summary: Retrieve user preferences
 *     description: >
 *       Returns display and notification preferences for the authenticated wallet.
 *       Defaults are returned when no preferences have been saved yet.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPreferences'
 *       401:
 *         description: Authentication required
 */
export const GET = withApiHandler(async (req: NextRequest) => {
    const address = requireWalletAuth(req.headers.get('authorization'));

    const stored = await _store.get(address);
    const preferences = stored ?? { ...DEFAULT_PREFERENCES };

    return ok({ address, preferences });
});

// ─── PUT /api/user/preferences ───────────────────────────────────────────────

/**
 * @openapi
 * /api/user/preferences:
 *   put:
 *     summary: Update user preferences
 *     description: >
 *       Partially updates preferences for the authenticated wallet.
 *       Only provided fields are overwritten (deep merge).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserPreferencesInput'
 *     responses:
 *       200:
 *         description: Updated preferences
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
export const PUT = withApiHandler(async (req: NextRequest) => {
    const address = requireWalletAuth(req.headers.get('authorization'));

    // Parse body
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Request body must be valid JSON.');
    }

    // Validate with Zod
    const result = userPreferencesSchema.safeParse(body);
    if (!result.success) {
        const details = result.error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        throw new ValidationError('Invalid preference data.', details);
    }

    // Guard against empty payload
    if (Object.keys(result.data).length === 0) {
        throw new ValidationError(
            'Request body must contain at least one preference field.',
        );
    }

    const preferences = await _store.upsert(address, result.data);

    return ok({ address, preferences });
});
