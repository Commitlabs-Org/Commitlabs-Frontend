# Backend CORS Policy

This backend now applies a route-level CORS helper from `src/lib/backend/cors.ts`.
Each API method is classified as either:

- `public`: browser clients may call the route cross-origin. By default these
  responses send `Access-Control-Allow-Origin: *` and never opt into
  credentials.
- `first-party`: only trusted Commitlabs web origins may call the route from a
  browser. These responses echo the approved origin and send
  `Access-Control-Allow-Credentials: true`.

The helper also answers `OPTIONS` preflight requests and rejects disallowed
origins with `403`.

## Configuration

Set these environment variables for deployment:

- `COMMITLABS_FIRST_PARTY_ORIGINS`
  Comma-separated list of trusted application origins allowed to call
  first-party routes from the browser.
  Example: `https://app.commitlabs.com,https://staging.commitlabs.com`
- `COMMITLABS_PUBLIC_API_ORIGINS`
  Comma-separated list of allowed origins for public browser routes, or `*`.
  Default: `*`

Development defaults always include:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

The helper also folds in deployed app URLs from `APP_URL`,
`NEXT_PUBLIC_APP_URL`, `SITE_URL`, `NEXT_PUBLIC_SITE_URL`,
`VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL` when they are present.

## Security Rules

- Wildcard origin is never combined with credentials.
- First-party routes reject cross-origin browser requests unless the `Origin`
  header matches the trusted allowlist.
- Public routes stay credential-free unless they are explicitly reconfigured.
- Preflight requests validate both the requested method and the requested
  headers before returning `204`.

## Current Route Strategy

Public browser routes:

- `GET /api/health`
- `GET /api/metrics`
- `GET /api/ready`
- `GET /api/marketplace`
- `GET /api/marketplace/listings`
- `GET /api/attestations`

First-party browser routes:

- All `/api/auth/*` routes
- `POST /api/login`
- All `/api/commitments/*` routes
- `GET /api/analytics/user`
- `POST /api/attestations`
- `POST /api/marketplace`
- `POST /api/marketplace/listings`
- `DELETE /api/marketplace/listings/[id]`
- `POST /api/seed`

## Allowed Methods

Each route now exposes only its implemented methods plus `OPTIONS`. Example:

- `GET /api/health` responds with `Access-Control-Allow-Methods: GET, OPTIONS`
- `GET|POST /api/marketplace/listings` responds with
  `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `DELETE /api/marketplace/listings/[id]` responds with
  `Access-Control-Allow-Methods: DELETE, OPTIONS`
