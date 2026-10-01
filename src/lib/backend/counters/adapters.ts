export interface CountersAdapter {
  incrementRateLimitBlocks(): Promise<void>;
  incrementAuthFailures(): Promise<void>;
  incrementChainFailures(): Promise<void>;
  incrementSuccessfulActions(): Promise<void>;
  getMetrics(): Promise<{
    rate_limit_blocks: number;
    auth_failures: number;
    chain_failures: number;
    successful_actions: number;
    timestamp: string;
  }>;
  reset(): Promise<void>; // For testing purposes
}
