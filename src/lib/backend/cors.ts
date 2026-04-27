import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ForbiddenError } from './errors';

export type CorsAccess = 'public' | 'first-party';
export type CorsMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface CorsMethodPolicy {
    access: CorsAccess;
    allowCredentials?: boolean;
    allowHeaders?: readonly string[];
    exposeHeaders?: readonly string[];
    maxAgeSeconds?: number;
}

export type CorsRoutePolicy = Partial<Record<CorsMethod, CorsMethodPolicy>>;

const DEFAULT_ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'X-Requested-With'] as const;
const DEFAULT_MAX_AGE_SECONDS = 600;
const DEFAULT_FIRST_PARTY_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'] as const;
const FIRST_PARTY_ENV_KEYS = [
    'APP_URL',
    'NEXT_PUBLIC_APP_URL',
    'SITE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
] as const;

type AllowedOrigins = '*' | string[];

function normalizeOrigin(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Origin must not be empty.');
    }

    const withProtocol =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed
            : `https://${trimmed}`;

    return new URL(withProtocol).origin;
}

function splitOriginList(value: string): string[] {
    return value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map(normalizeOrigin);
}

function uniqueOrigins(origins: Iterable<string>): string[] {
    return [...new Set(origins)];
}

function getConfiguredFirstPartyOrigins(): string[] {
    const configured = process.env.COMMITLABS_FIRST_PARTY_ORIGINS?.trim();
    if (configured === '*') {
        throw new Error('COMMITLABS_FIRST_PARTY_ORIGINS cannot be "*" because first-party routes may allow credentials.');
    }

    const envOrigins = FIRST_PARTY_ENV_KEYS.flatMap((key) => {
        const value = process.env[key];
        return value ? [normalizeOrigin(value)] : [];
    });

    const configuredOrigins = configured ? splitOriginList(configured) : [];

    return uniqueOrigins([...DEFAULT_FIRST_PARTY_ORIGINS, ...envOrigins, ...configuredOrigins]);
}

function getConfiguredPublicOrigins(): AllowedOrigins {
    const configured = process.env.COMMITLABS_PUBLIC_API_ORIGINS?.trim();
    if (!configured || configured === '*') {
        return '*';
    }

    return uniqueOrigins(splitOriginList(configured));
}

function getAllowedOrigins(access: CorsAccess): AllowedOrigins {
    return access === 'first-party'
        ? getConfiguredFirstPartyOrigins()
        : getConfiguredPublicOrigins();
}

function resolveMethodPolicy(
    routePolicy: CorsRoutePolicy,
    method: string | null
): { method: CorsMethod; policy: CorsMethodPolicy } | null {
    if (!method) return null;

    const normalizedMethod = method.toUpperCase() as CorsMethod;
    const policy = routePolicy[normalizedMethod];

    if (!policy) return null;

    return {
        method: normalizedMethod,
        policy,
    };
}

function getAllowCredentials(policy: CorsMethodPolicy): boolean {
    return policy.allowCredentials ?? policy.access === 'first-party';
}

function getAllowedHeaders(policy: CorsMethodPolicy): string[] {
    return [...(policy.allowHeaders ?? DEFAULT_ALLOWED_HEADERS)];
}

function getAllowedMethods(routePolicy: CorsRoutePolicy): string[] {
    return uniqueOrigins([...Object.keys(routePolicy).sort(), 'OPTIONS']);
}

function appendVaryHeader(headers: Headers, value: string): void {
    const existing = headers.get('Vary');
    if (!existing) {
        headers.set('Vary', value);
        return;
    }

    const values = existing
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    if (!values.includes(value)) {
        values.push(value);
        headers.set('Vary', values.join(', '));
    }
}

function validatePolicyConfiguration(policy: CorsMethodPolicy, allowedOrigins: AllowedOrigins): void {
    if (allowedOrigins === '*' && getAllowCredentials(policy)) {
        throw new Error('CORS policy cannot combine wildcard origins with credentials.');
    }
}

function isOriginAllowed(origin: string, allowedOrigins: AllowedOrigins): boolean {
    return allowedOrigins === '*' || allowedOrigins.includes(origin);
}

function getRequestOrigin(request: NextRequest): string | null {
    const origin = request.headers.get('origin');
    if (!origin) return null;

    try {
        return normalizeOrigin(origin);
    } catch {
        return null;
    }
}

function validateRequestedHeaders(
    request: NextRequest,
    allowedHeaders: string[]
): string[] {
    const requestedHeaders = request.headers
        .get('access-control-request-headers')
        ?.split(',')
        .map((header) => header.trim())
        .filter(Boolean) ?? [];

    if (requestedHeaders.length === 0) {
        return allowedHeaders;
    }

    const allowedLookup = new Set(allowedHeaders.map((header) => header.toLowerCase()));
    const invalidHeader = requestedHeaders.find(
        (header) => !allowedLookup.has(header.toLowerCase())
    );

    if (invalidHeader) {
        throw new ForbiddenError(`Header "${invalidHeader}" is not allowed by this CORS policy.`, {
            header: invalidHeader,
        });
    }

    return requestedHeaders;
}

function setCorsHeaders(
    request: NextRequest,
    response: Response,
    routePolicy: CorsRoutePolicy,
    methodPolicy: CorsMethodPolicy
): Response {
    const headers = response.headers;
    const allowedOrigins = getAllowedOrigins(methodPolicy.access);
    const origin = getRequestOrigin(request);
    const allowCredentials = getAllowCredentials(methodPolicy);

    validatePolicyConfiguration(methodPolicy, allowedOrigins);

    headers.set('Access-Control-Allow-Methods', getAllowedMethods(routePolicy).join(', '));
    headers.set('Access-Control-Allow-Headers', getAllowedHeaders(methodPolicy).join(', '));
    appendVaryHeader(headers, 'Origin');

    if (methodPolicy.exposeHeaders && methodPolicy.exposeHeaders.length > 0) {
        headers.set('Access-Control-Expose-Headers', methodPolicy.exposeHeaders.join(', '));
    }

    if (allowedOrigins === '*') {
        headers.set('Access-Control-Allow-Origin', '*');
    } else if (origin && isOriginAllowed(origin, allowedOrigins)) {
        headers.set('Access-Control-Allow-Origin', origin);
    }

    if (allowCredentials) {
        headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;
}

export function enforceCorsRequestPolicy(
    request: NextRequest,
    routePolicy: CorsRoutePolicy,
    method = request.method
): void {
    const resolved = resolveMethodPolicy(routePolicy, method);
    if (!resolved) return;

    const origin = getRequestOrigin(request);
    if (!origin) return;

    const allowedOrigins = getAllowedOrigins(resolved.policy.access);
    validatePolicyConfiguration(resolved.policy, allowedOrigins);

    if (!isOriginAllowed(origin, allowedOrigins)) {
        throw new ForbiddenError('Origin is not allowed by this CORS policy.', {
            origin,
            method: resolved.method,
        });
    }
}

export function applyCorsPolicy(
    request: NextRequest,
    response: Response,
    routePolicy: CorsRoutePolicy,
    method = request.method
): Response {
    const resolved = resolveMethodPolicy(routePolicy, method);
    if (!resolved) {
        return response;
    }

    return setCorsHeaders(request, response, routePolicy, resolved.policy);
}

export function toCorsErrorResponse(error: unknown): NextResponse {
    if (error instanceof ApiError) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    ...(error.details !== undefined ? { details: error.details } : {}),
                },
            },
            { status: error.statusCode }
        );
    }

    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred while processing CORS headers.',
            },
        },
        { status: 500 }
    );
}

export function createCorsOptionsHandler(routePolicy: CorsRoutePolicy) {
    return async function OPTIONS(request: NextRequest): Promise<NextResponse> {
        try {
            const requestedMethod = request.headers.get('access-control-request-method');
            const resolved = resolveMethodPolicy(routePolicy, requestedMethod);

            if (!resolved) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'METHOD_NOT_ALLOWED',
                            message: 'Requested method is not allowed for this route.',
                        },
                    },
                    { status: 405 }
                );
            }

            enforceCorsRequestPolicy(request, routePolicy, resolved.method);

            const response = new NextResponse(null, { status: 204 });
            const allowedHeaders = validateRequestedHeaders(
                request,
                getAllowedHeaders(resolved.policy)
            );

            response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
            response.headers.set(
                'Access-Control-Max-Age',
                String(resolved.policy.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS)
            );

            return applyCorsPolicy(request, response, routePolicy, resolved.method) as NextResponse;
        } catch (error) {
            return toCorsErrorResponse(error);
        }
    };
}
