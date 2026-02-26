# Backend Architecture & Guidelines

This document outlines the architectural patterns and contribution guidelines for the CommitLabs backend, which is implemented as a set of **Next.js API Routes**.

## 🏗 Directory Structure

The backend code is organized into two main directories:

1.  **`src/app/api`**: Contains the route handlers (controllers).
2.  **`src/lib/backend`**: Contains the core business logic, services, and utilities.

```
src/
├── app/
│   └── api/                  # Route Handlers (Controllers)
│       ├── commitments/      # /api/commitments
│       ├── attestations/     # /api/attestations
│       ├── marketplace/      # /api/marketplace
│       └── ...
└── lib/
    └── backend/              # Core Logic
        ├── services/         # Domain Services (Business Logic)
        ├── config.ts         # Environment & Contract Config
        ├── errors.ts         # Standard Error Classes
        ├── response.ts       # JSON Response Helpers (ok, fail)
        ├── withApiHandler.ts # HOF for Error Handling
        └── ...
```

## 📐 Architectural Patterns

### 1. Route Handlers (Controllers)
- **Location**: `src/app/api/**/route.ts`
- **Responsibility**:
    - Parse request inputs (query params, body).
    - Validate inputs (using Zod or manual checks).
    - Call the appropriate **Service** method.
    - Return a standardized JSON response using `ok()` or `fail()`.
- **Constraint**: Route handlers should contain **minimal logic**. They are strictly for I/O handling.
- **Pattern**: Always wrap handlers with `withApiHandler` to ensure consistent error handling.

**Example:**
```typescript
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/response';
import { commitmentService } from '@/lib/backend/services/commitment';

export const GET = withApiHandler(async (req) => {
    const data = await commitmentService.getAll();
    return ok(data);
});
```

### 2. Services (Business Logic)
- **Location**: `src/lib/backend/services/*.ts`
- **Responsibility**:
    - Contain the core business rules.
    - Interact with the database (or mocks) and blockchain.
    - Throw typed errors (e.g., `NotFoundError`, `ValidationError`) which are caught by the route handler.
- **Naming**: `[domain].ts` (e.g., `marketplace.ts`, `contracts.ts`).

### 3. Standard Response Format
All API responses must follow the [Standard JSON Format](./api-response-format.md).
- Use `ok(data, status?)` for success.
- Use `fail(code, message, details?, status?)` for errors.

### 4. Configuration
- **Location**: `src/lib/backend/config.ts`
- **Usage**: Use `getBackendConfig()` or `loadContractsConfig()` to access environment variables. **Do not use `process.env` directly** in application code.

## 🤝 Contribution Guidelines

### Creating a New Endpoint
1.  **Design the Route**: Choose a RESTful path (e.g., `/api/commitments/[id]/settle`).
2.  **Create the Service Method**: Implement the logic in the relevant service file (e.g., `src/lib/backend/services/commitment.ts`).
3.  **Create the Route Handler**: Create `src/app/api/.../route.ts` and call the service.
4.  **Error Handling**: Throw specific errors from `src/lib/backend/errors.ts`. Do not return 400/500 responses manually unless necessary.

### Modifying Shared Utilities
- Files like `withApiHandler.ts`, `response.ts`, and `errors.ts` are used globally.
- **Avoid changing them** unless you are fixing a critical bug or introducing a widely agreed-upon feature.
- If you add a new error code, update `docs/api-response-format.md`.

### Naming Conventions
- **Routes**: Kebab-case folders (e.g., `early-exit`).
- **Services**: CamelCase instances, PascalCase classes.
- **DTOs**: PascalCase interfaces in `src/lib/types/domain.ts`.

## 🧪 Testing
- Write unit tests for Services using Vitest.
- Mock external dependencies (blockchain calls) when testing business logic.
