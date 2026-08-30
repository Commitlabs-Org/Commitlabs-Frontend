/**
 * Diagnostics service for tracking operational metrics and degraded behavior.
 * Exposes actionable telemetry for latency, failure, and recovery paths without leaking secrets.
 */

export interface DiagnosticMetric {
  operation: string;
  duration: number;
  status: 'success' | 'failure' | 'degraded';
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface OperationTelemetry {
  operationId: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: 'success' | 'failure' | 'degraded';
  failureReason?: string;
  retryCount: number;
  concurrentRequests?: number;
  cacheHit?: boolean;
  details?: Record<string, unknown>;
}

/**
 * In-memory metrics store for operational visibility.
 * Should be replaced with external observability service in production.
 */
class DiagnosticsService {
  private metrics: Map<string, OperationTelemetry> = new Map();
  private concurrentOpsCounter: Map<string, number> = new Map();
  private maxConcurrentOps: Map<string, number> = new Map();
  private maxMetricsSize = 10000; // Prevent unbounded memory growth

  /**
   * Start tracking a new operation with explicit bounds.
   */
  startOperation(operationId: string, operation: string, maxConcurrent = 100): OperationTelemetry {
    const currentCount = this.concurrentOpsCounter.get(operation) || 0;
    const newCount = currentCount + 1;

    this.concurrentOpsCounter.set(operation, newCount);

    // Track max concurrent operations
    const currentMax = this.maxConcurrentOps.get(operation) || 0;
    if (newCount > currentMax) {
      this.maxConcurrentOps.set(operation, newCount);
    }

    const telemetry: OperationTelemetry = {
      operationId,
      operation,
      startTime: Date.now(),
      retryCount: 0,
      concurrentRequests: newCount,
    };

    this.metrics.set(operationId, telemetry);

    // Cleanup old metrics if store gets too large
    if (this.metrics.size > this.maxMetricsSize) {
      this.cleanupOldMetrics();
    }

    // Check if concurrent ops exceed bounds
    if (newCount > maxConcurrent) {
      return {
        ...telemetry,
        status: 'degraded',
        failureReason: `Concurrent operations (${newCount}) exceeded bound (${maxConcurrent})`,
      };
    }

    return telemetry;
  }

  /**
   * Complete operation tracking with status and optional details.
   */
  completeOperation(
    operationId: string,
    status: 'success' | 'failure' | 'degraded',
    failureReason?: string,
    details?: Record<string, unknown>,
  ): OperationTelemetry | undefined {
    const telemetry = this.metrics.get(operationId);
    if (!telemetry) return undefined;

    const endTime = Date.now();
    telemetry.endTime = endTime;
    telemetry.duration = endTime - telemetry.startTime;
    telemetry.status = status;
    telemetry.failureReason = failureReason;
    telemetry.details = details;

    // Decrement concurrent counter
    const currentCount = this.concurrentOpsCounter.get(telemetry.operation) || 0;
    if (currentCount > 0) {
      this.concurrentOpsCounter.set(telemetry.operation, currentCount - 1);
    }

    return telemetry;
  }

  /**
   * Record a retry attempt for an operation.
   */
  recordRetry(operationId: string): OperationTelemetry | undefined {
    const telemetry = this.metrics.get(operationId);
    if (telemetry) {
      telemetry.retryCount += 1;
    }
    return telemetry;
  }

  /**
   * Get current metrics for an operation (no secrets).
   */
  getOperationTelemetry(operationId: string): OperationTelemetry | undefined {
    return this.metrics.get(operationId);
  }

  /**
   * Get aggregated statistics for an operation type.
   */
  getOperationStats(operation: string) {
    const operationMetrics = Array.from(this.metrics.values()).filter(
      (m) => m.operation === operation,
    );

    if (operationMetrics.length === 0) {
      return {
        operation,
        sampleCount: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        successCount: 0,
        failureCount: 0,
        degradedCount: 0,
        avgRetries: 0,
        maxConcurrentOps: this.maxConcurrentOps.get(operation) || 0,
      };
    }

    const completedMetrics = operationMetrics.filter((m) => m.status !== undefined);
    const successCount = completedMetrics.filter((m) => m.status === 'success').length;
    const failureCount = completedMetrics.filter((m) => m.status === 'failure').length;
    const degradedCount = completedMetrics.filter((m) => m.status === 'degraded').length;

    const durations = completedMetrics
      .filter((m) => m.duration !== undefined)
      .map((m) => m.duration!);

    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    const avgRetries =
      operationMetrics.length > 0
        ? operationMetrics.reduce((sum, m) => sum + m.retryCount, 0) / operationMetrics.length
        : 0;

    return {
      operation,
      sampleCount: operationMetrics.length,
      avgDuration: Math.round(avgDuration * 100) / 100,
      maxDuration,
      minDuration,
      successCount,
      failureCount,
      degradedCount,
      avgRetries: Math.round(avgRetries * 100) / 100,
      maxConcurrentOps: this.maxConcurrentOps.get(operation) || 0,
    };
  }

  /**
   * Check if operation is currently degraded.
   */
  isOperationDegraded(operation: string): boolean {
    const recentMetrics = Array.from(this.metrics.values())
      .filter((m) => m.operation === operation && m.endTime && Date.now() - m.endTime < 60000)
      .slice(-100); // Last 100 ops

    if (recentMetrics.length < 10) return false;

    const degradedCount = recentMetrics.filter((m) => m.status === 'degraded' || m.status === 'failure')
      .length;

    return degradedCount / recentMetrics.length > 0.25; // If >25% recent ops failed/degraded
  }

  /**
   * Clean up old metrics to prevent unbounded memory growth.
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // Keep 1 hour of metrics

    for (const [operationId, telemetry] of this.metrics.entries()) {
      if (telemetry.endTime && now - telemetry.endTime > maxAge) {
        this.metrics.delete(operationId);
      }
    }
  }

  /**
   * Clear all metrics (for testing).
   */
  clear(): void {
    this.metrics.clear();
    this.concurrentOpsCounter.clear();
    this.maxConcurrentOps.clear();
  }
}

export const diagnosticsService = new DiagnosticsService();
