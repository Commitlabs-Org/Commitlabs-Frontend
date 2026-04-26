# CommitLabs Frontend

The frontend application for the CommitLabs protocol, a decentralized platform for managing liquidity commitments on the Stellar network. Built with Next.js, TypeScript, and Tailwind CSS.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Backend API Changelog](#backend-api-changelog)
- [Contributing](#contributing)
- [API Reference](#api-reference)
- [License](#license)

## 🔭 Overview

CommitLabs allows users to create, manage, and trade liquidity commitments. These commitments are on-chain contracts that lock assets for a specified duration in exchange for yield, with specific compliance and risk parameters.

This frontend interacts with the CommitLabs Soroban smart contracts to:

1.  Create new commitments with customizable parameters (Safe, Balanced, Aggressive).
2.  Monitor the health and performance of existing commitments.
3.  Trade commitments on a secondary marketplace.

## ✨ Features

- **Commitment Creation Wizard**: Step-by-step process to configure asset, amount, duration, and risk parameters.
- **Dashboard**: Real-time visualization of commitment health, including value history, drawdown, and compliance scores.
- **Marketplace**: Browse and filter active commitments available for purchase.
- **Wallet Integration**: Connect with Stellar wallets (e.g., Freighter) to sign transactions (In Progress).
- **Responsive Design**: Optimized for both desktop and mobile devices.

## 🏗 Architecture

The application is built using the **Next.js App Router** architecture.

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS (v4) with CSS Modules for component-specific styles.
- **State Management**: React Context & Hooks (Local state for forms).
- **Blockchain Interaction**: `@stellar/stellar-sdk` and `@stellar/freighter-api` (via `src/utils/soroban.ts`).
- **Data Visualization**: `recharts` for health metrics and performance charts.

For a deep dive into the system design, modules, and data flow, please refer to [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🧪 Testing

This project uses **Vitest** for unit and integration testing of API routes.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

Tests are organized in the `tests/` directory:

```
tests/
└── api/
    ├── helpers.ts           # Test utilities and mock request helpers
    ├── health.test.ts       # Tests for /api/health route
    └── commitments.test.ts  # Tests for /api/commitments route
```

### API Routes

- **GET /api/health** - Health check endpoint returning status and version
- **GET /api/commitments** - Fetch commitments with optional filtering and pagination
- **POST /api/commitments** - Create a new commitment (mocked for now)

### Test Examples

Tests demonstrate:
- Mocking Next.js API routes without network requests
- Testing request/response handling
- Parameter validation and error handling
- Mock data without external dependencies

To add new API route tests, create a `.test.ts` file in `tests/api/` following the same pattern.

## 🔄 Backend API Changelog

Breaking backend API changes are tracked in [docs/backend-changelog.md](./docs/backend-changelog.md). Update this changelog whenever a backend change can break existing frontend integrations.

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- pnpm (recommended) or npm/yarn
- A Stellar wallet extension (e.g., Freighter) installed in your browser.

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-org/commitlabs-frontend.git
    cd commitlabs-frontend
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    # or
    npm install
    ```

3.  **Set up environment variables:**
    Copy the example environment file and configure it.

    ```bash
    cp .env.example .env
    ```

    _See [Configuration](#configuration) for details._

4.  **Run the development server:**

    ```bash
    pnpm dev
    # or
    npm run dev
    ```

5.  **Open the application:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

## ⚙️ Configuration

The application requires the following environment variables (defined in `.env`):

| Variable                                  | Description                                | Default (Testnet)                     |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`             | URL of the Soroban RPC endpoint            | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`          | Stellar network passphrase                 | `Test SDF Network ; September 2015`   |
| `NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT`     | Address of the Commitment NFT contract     | _Required_                            |
| `NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT`    | Address of the Core Logic contract         | _Required_                            |
| `NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT` | Address of the Attestation Engine contract | _Required_                            |

Note: The project also supports a versioned contract configuration via `NEXT_PUBLIC_CONTRACTS_JSON` and `NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION`. See [docs/config.md](docs/config.md) for details.

Backend API storage uses a provider-agnostic adapter. Configure
`COMMITLABS_STORAGE_PROVIDER=memory` by default and see
[docs/backend-storage.md](docs/backend-storage.md) for adapter details.

## 📂 Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── commitments/        # Dashboard & Commitment Details
│   ├── create/             # Commitment Creation Wizard
│   ├── marketplace/        # Marketplace Listing
│   └── page.tsx            # Landing Page
├── components/             # Reusable UI components
│   ├── dashboard/          # Charts and metrics components
│   ├── modals/             # Global modals (Success, Errors)
│   └── ...
├── types/                  # TypeScript interfaces and types
├── utils/                  # Utility functions (Soroban, formatting)
└── ...
```

## 🤝 Contributing

## Security Headers

This project includes a reusable helper to attach standard security headers to HTTP responses.

**Usage:**

1. Import the helper:

   ```typescript
   import { attachSecurityHeaders } from "@/utils/response";
   ```

2. Wrap your response object before returning it in a route handler:

   ```typescript
   import { NextResponse } from "next/server";
   import { attachSecurityHeaders } from "@/utils/response";

   export async function GET() {
     const response = NextResponse.json({ data: "secure content" });
     return attachSecurityHeaders(response);
   }
   ```

**Customization:**

- **Content-Security-Policy (CSP):** You can override the default CSP by passing a second argument.

  ```typescript
  return attachSecurityHeaders(response, "default-src 'none'; img-src 'self'");
  ```

- **Disabling/Modifying Headers:**
  The `attachSecurityHeaders` function returns the modified `Response` object. You can further modify headers on the returned object if needed, or update the `src/utils/response.ts` file to change default behaviors globally.

## License

We welcome contributions! Please see our [Developer Guide](./DEVELOPER_GUIDE.md) for detailed instructions on coding standards, testing procedures, and the pull request process.

## 📡 API Reference

A description of the backend endpoints exposed under `/api` can be found in:

- [docs/backend-api-reference.md](./docs/backend-api-reference.md)
- [docs/backend-storage.md](./docs/backend-storage.md)

This document includes available routes, required parameters, and example
requests/responses.  It is intended for developers building against or testing
the backend.


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
