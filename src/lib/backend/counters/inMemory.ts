import { CountersAdapter } from './adapters';

export class InMemoryCounters implements CountersAdapter {
  private rateLimitBlocks = 0;
  private authFailures = 0;
  private chainFailures = 0;
  private successfulActions = 0;

  async incrementRateLimitBlocks(): Promise<void> {
    this.rateLimitBlocks++;
  }

  async incrementAuthFailures(): Promise<void> {
    this.authFailures++;
  }

  async incrementChainFailures(): Promise<void> {
    this.chainFailures++;
  }

  async incrementSuccessfulActions(): Promise<void> {
    this.successfulActions++;
  }

  async getMetrics(): Promise<{
    rate_limit_blocks: number;
    auth_failures: number;
    chain_failures: number;
    successful_actions: number;
    timestamp: string;
  }> {
    return {
      rate_limit_blocks: this.rateLimitBlocks,
      auth_failures: this.authFailures,
      chain_failures: this.chainFailures,
      successful_actions: this.successfulActions,
      timestamp: new Date().toISOString(),
    };
  }

  async reset(): Promise<void> {
    this.rateLimitBlocks = 0;
    this.authFailures = 0;
    this.chainFailures = 0;
    this.successfulActions = 0;
  }
}
