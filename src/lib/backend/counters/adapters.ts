export interface CountersAdapter {
  incrementRateLimitBlocks(): void;
  incrementAuthFailures(): void;
  incrementChainFailures(): void;
  incrementSuccessfulActions(): void;
  getMetrics(): Promise<{
    rate_limit_blocks: number;
    auth_failures: number;
    chain_failures: number;
    successful_actions: number;
    timestamp: string;
  }>;
  reset(): void; // For testing purposes
}