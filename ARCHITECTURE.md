# System Architecture

This document details the architectural design of the CommitLabs Frontend application, including component responsibilities, data flow, and integration points.

## 🏗 High-Level Architecture


The application follows a standard **Next.js App Router** architecture, leveraging Server Components for static rendering and Client Components for interactivity.


### Component Diagram

```mermaid
graph TD
    User[User / Browser]
    NextApp[Next.js Application]
    
    subgraph "Frontend Layer"
        Page[Pages (src/app)]
        Comp[Components (src/components)]
        Hooks[React Hooks]
        Context[React Context]
    end

    
    subgraph "Integration Layer"
        ContractsService[Contracts Service (src/lib/backend/services/contracts.ts)]
        SorobanUtils[Soroban Utils (src/utils/soroban.ts) - Addresses Only]
        Wallet[Wallet Adapter (Freighter)]
    end
    
    subgraph "Blockchain Layer"
        Stellar[Stellar Network]
        Contracts[Soroban Smart Contracts]
    end
    
    
    User -->|Interacts| Page
    Page -->|Renders| Comp
    Comp -->|Uses| Hooks
    Hooks -->|Calls| ContractsService
    ContractsService -->|RPC Calls| Stellar
    ContractsService -->|Gets Addresses| SorobanUtils
    Wallet -->|Signs Tx| Stellar
    Stellar -->|Executes| Contracts
```

## 🧩 Core Modules

### 1. Commitment Management

Responsible for the lifecycle of liquidity commitments: creation, monitoring, and settlement.

-   **Creation Flow**: A wizard-style interface (`src/app/create`) guides the user through configuring asset, amount, duration, and risk parameters.
-   **Data Model**:
    -   `Commitment`: Represents a single commitment contract.
    -   `CommitmentType`: Enum (`Safe`, `Balanced`, `Aggressive`).
-   **Key Components**:
    -   `CreateCommitmentStepSelectType`: Selection of risk profile.
    -   `CreateCommitmentStepConfigure`: Detailed parameter input.
    -   `CommitmentForm`: (Legacy/Refactor target)

### 2. Dashboard & Visualization

Provides real-time insights into commitment performance.

-   **Health Metrics**: Visualizes value history, drawdown, and compliance.
-   **Key Components**:
    -   `CommitmentHealthMetrics`: Container for charts.
    -   `HealthMetricsValueHistoryChart`: Line chart of asset value.
    -   `HealthMetricsDrawdownChart`: Area chart of value drops.
    -   **Libraries**: `recharts` for rendering SVG charts.

### 3. Marketplace

A secondary market for trading active commitments.

-   **Listing**: Displays available commitments with filtering.
-   **Filtering**: `MarketplaceFilters` component allows filtering by type, price, duration, etc.
-   **Data Flow**:
    -   Currently uses mock data (`mockListings` in `src/app/marketplace/page.tsx`).
    -   Future state: Query Soroban contract for active listings.

## 🔄 Data Flow

### Commitment Creation Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as Create Page
    participant Service as Contracts Service
    participant Chain as Stellar Network

    User->>UI: Select Commitment Type
    User->>UI: Configure Amount & Duration
    User->>UI: Click "Create Commitment"
    UI->>Service: createCommitmentOnChain()
    Service->>Chain: Invoke Contract (create_commitment)
    Chain-->>Service: Transaction Hash & Result
    Service-->>UI: Success / Failure
    UI->>User: Show Success Modal
```

## 🔌 External Integrations

### Soroban Smart Contracts

The application interacts with three primary contracts:
1.  **Commitment Core**: Manages the logic of creating and settling commitments.
2.  **Commitment NFT**: Represents ownership of the commitment.
3.  **Attestation Engine**: Verifies external data (e.g., price feeds) for compliance.

### Wallet Integration

-   **Provider**: Server-side signing using configured Soroban keys
-   **Usage**: The contracts service handles transaction signing via configured server keys
-   **Implementation**: See `src/lib/backend/services/contracts.ts` for chain interaction logic
-   **Configuration**: Contract addresses are managed in `src/utils/soroban.ts`

## 🛡 Security & Performance

-   **Input Validation**: All user inputs (amount, duration) are validated client-side before submission.
-   **Error Handling**: Transaction failures are caught and displayed to the user via Modals.
-   **Optimization**: 
    -   `recharts` components are lazy-loaded where possible.
    -   Static generation is used for marketing pages (`src/app/page.tsx`).

## 🔮 Future Improvements

-   **Real-time Data**: Replace mock data with live contract queries using a generated Soroban client.
-   **Caching**: Implement `React Query` or similar for caching blockchain data.
-   **Type Safety**: Generate TypeScript definitions directly from Soroban XDR files.
