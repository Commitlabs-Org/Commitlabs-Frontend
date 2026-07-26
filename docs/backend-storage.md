# Backend Storage Adapter

This project uses a small backend storage abstraction in
`src/lib/backend/storage.ts` so API code is not coupled to a single Redis/KV
provider.

## Interface

The adapter exposes the minimal operations currently needed by the codebase:

- `get(key)`
- `set(key, value, { ttlMs? })`
- `delete(key)`
- `increment(key, { amount?, ttlMs? })`

TTL values are expressed in milliseconds at the adapter boundary.

## Current Providers

- `MemoryStorageAdapter`
  - Default for development and tests
  - Safe fallback when no external provider is configured
- `KeyValueStorageAdapter`
  - Wraps an injected Redis/KV-like client
  - Not wired to a concrete dependency in this repository yet

Because this repo does not currently ship a Redis/KV client dependency or
provider-specific configuration, `getStorageAdapter()` resolves to memory
storage by default.

## Current Usage

The adapter now backs:

- auth nonces with TTL
- placeholder auth session records with TTL
- marketplace listing persistence
- marketplace listing ID counters

The same interface is intended for future idempotency keys and request counters.

## Environment

Use `COMMITLABS_STORAGE_PROVIDER` to select a provider.

```env
COMMITLABS_STORAGE_PROVIDER=memory
```

Supported values in this repo today:

- `memory`

If `redis` or `kv` is requested without an injected client, the factory falls
back to memory storage and logs a warning.

## Extending to Redis/KV

When the repo adopts a concrete provider, wrap the client with
`KeyValueStorageAdapter` and inject it through `createStorageAdapter(...)` or
the cached `getStorageAdapter()` initialization path.

This keeps business logic in auth, marketplace, and future idempotency/session
flows provider-agnostic.
