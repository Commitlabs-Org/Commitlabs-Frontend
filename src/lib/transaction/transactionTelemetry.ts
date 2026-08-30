/**
 * Transaction telemetry and diagnostics for operational visibility.
 * Exposes actionable client telemetry without leaking secrets.
 */

import type { TelemetryEvent, TransactionState, TransactionType } from './transactionTypes';

/**
 * Telemetry buffer to store events in memory
 */
class TelemetryBuffer {
  private events: TelemetryEvent[] = [];
  private maxSize: number = 100; // Maximum events to keep in memory

  add(event: TelemetryEvent): void {
    this.events.push(event);
    
    // Enforce size bound
    if (this.events.length > this.maxSize) {
      this.events.shift(); // Remove oldest event
    }
  }

  getEvents(limit?: number): TelemetryEvent[] {
    if (limit) {
      return this.events.slice(-limit);
    }
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  getEventsByTransactionId(transactionId: string): TelemetryEvent[] {
    return this.events.filter(e => e.transactionId === transactionId);
  }

  getEventsByType(type: TelemetryEvent['type']): TelemetryEvent[] {
    return this.events.filter(e => e.type === type);
  }

  getEventsByTimeRange(startTime: Date, endTime: Date): TelemetryEvent[] {
    const start = startTime.getTime();
    const end = endTime.getTime();
    return this.events.filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      return eventTime >= start && eventTime <= end;
    });
  }
}

/**
 * Global telemetry buffer instance
 */
const telemetryBuffer = new TelemetryBuffer();

/**
 * Create a telemetry event
 */
export function createTelemetryEvent(
  type: TelemetryEvent['type'],
  transactionId: string,
  transactionType: TransactionType,
  state: TransactionState,
  context?: Record<string, string | number | boolean>,
  durationMs?: number,
  errorCode?: string,
): TelemetryEvent {
  const event: TelemetryEvent = {
    type,
    transactionId,
    transactionType,
    state,
    timestamp: new Date().toISOString(),
  };
  
  if (durationMs !== undefined) {
    event.durationMs = durationMs;
  }
  if (errorCode !== undefined) {
    event.errorCode = errorCode;
  }
  if (context !== undefined) {
    event.context = sanitizeContext(context);
  }
  
  return event;
}

/**
 * Sanitize context to prevent leaking sensitive information
 */
function sanitizeContext(context: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'private', 'address', 'wallet'];
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      // Truncate long strings
      sanitized[key] = value.length > 100 ? value.slice(0, 100) + '...' : value;
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Record a telemetry event
 */
export function recordTelemetryEvent(event: TelemetryEvent): void {
  telemetryBuffer.add(event);
  
  // In development, log to console for debugging
  if (typeof window !== 'undefined' && (window as any).__DEV__) {
    console.log('[Transaction Telemetry]', event);
  }
  
  // In production, you could send to analytics service here
  // This is intentionally left as a no-op to avoid external dependencies
}

/**
 * Get telemetry events for a transaction
 */
export function getTransactionTelemetry(transactionId: string): TelemetryEvent[] {
  return telemetryBuffer.getEventsByTransactionId(transactionId);
}

/**
 * Get all telemetry events
 */
export function getAllTelemetryEvents(limit?: number): TelemetryEvent[] {
  return telemetryBuffer.getEvents(limit);
}

/**
 * Get telemetry events by type
 */
export function getTelemetryEventsByType(type: TelemetryEvent['type']): TelemetryEvent[] {
  return telemetryBuffer.getEventsByType(type);
}

/**
 * Clear telemetry buffer (for testing)
 */
export function clearTelemetry(): void {
  telemetryBuffer.clear();
}

/**
 * Calculate telemetry statistics
 */
export interface TelemetryStatistics {
  totalEvents: number;
  eventsByType: Record<TelemetryEvent['type'], number>;
  eventsByTransactionType: Record<TransactionType, number>;
  eventsByState: Record<TransactionState, number>;
  averageDurationMs: number;
  errorRate: number;
}

export function calculateTelemetryStatistics(): TelemetryStatistics {
  const events = telemetryBuffer.getEvents();
  
  const stats: TelemetryStatistics = {
    totalEvents: events.length,
    eventsByType: {} as Record<TelemetryEvent['type'], number>,
    eventsByTransactionType: {} as Record<TransactionType, number>,
    eventsByState: {} as Record<TransactionState, number>,
    averageDurationMs: 0,
    errorRate: 0,
  };
  
  let totalDuration = 0;
  let durationCount = 0;
  let errorCount = 0;
  
  for (const event of events) {
    // Count by type
    stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
    
    // Count by transaction type
    stats.eventsByTransactionType[event.transactionType] = (stats.eventsByTransactionType[event.transactionType] || 0) + 1;
    
    // Count by state
    stats.eventsByState[event.state] = (stats.eventsByState[event.state] || 0) + 1;
    
    // Calculate duration
    if (event.durationMs !== undefined) {
      totalDuration += event.durationMs;
      durationCount++;
    }
    
    // Count errors
    if (event.errorCode !== undefined) {
      errorCount++;
    }
  }
  
  // Calculate average duration
  if (durationCount > 0) {
    stats.averageDurationMs = totalDuration / durationCount;
  }
  
  // Calculate error rate
  if (events.length > 0) {
    stats.errorRate = errorCount / events.length;
  }
  
  return stats;
}

/**
 * Get diagnostic information for a transaction
 */
export interface TransactionDiagnostics {
  transactionId: string;
  transactionType: TransactionType;
  currentState: TransactionState;
  eventCount: number;
  firstEventTime: string | null;
  lastEventTime: string | null;
  totalDurationMs: number;
  errorCount: number;
  lastError: string | null;
  stateTransitions: Array<{ from: TransactionState; to: TransactionState; timestamp: string }>;
}

export function getTransactionDiagnostics(transactionId: string): TransactionDiagnostics | null {
  const events = telemetryBuffer.getEventsByTransactionId(transactionId);
  
  if (events.length === 0) {
    return null;
  }
  
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  
  if (!firstEvent || !lastEvent) {
    return null;
  }
  
  const stateTransitions: TransactionDiagnostics['stateTransitions'] = [];
  let previousState: TransactionState | null = null;
  
  for (const event of sortedEvents) {
    if (event.type === 'state_transition' && previousState !== null) {
      stateTransitions.push({
        from: previousState,
        to: event.state,
        timestamp: event.timestamp,
      });
    }
    previousState = event.state;
  }
  
  const errorEvents = events.filter(e => e.errorCode !== undefined);
  const lastErrorEvent = errorEvents.length > 0 ? errorEvents[errorEvents.length - 1] : undefined;
  
  return {
    transactionId,
    transactionType: firstEvent.transactionType,
    currentState: lastEvent.state,
    eventCount: events.length,
    firstEventTime: firstEvent.timestamp,
    lastEventTime: lastEvent.timestamp,
    totalDurationMs: lastEvent.durationMs ?? 0,
    errorCount: errorEvents.length,
    lastError: lastErrorEvent?.errorCode ?? null,
    stateTransitions,
  };
}

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  averageTransactionTime: number;
  medianTransactionTime: number;
  p95TransactionTime: number;
  successRate: number;
  failureRate: number;
  timeoutRate: number;
}

export function calculatePerformanceMetrics(): PerformanceMetrics {
  const events = telemetryBuffer.getEvents();
  const completedEvents = events.filter(e => 
    e.type === 'transaction_confirmed' || e.type === 'transaction_failed'
  );
  
  if (completedEvents.length === 0) {
    return {
      averageTransactionTime: 0,
      medianTransactionTime: 0,
      p95TransactionTime: 0,
      successRate: 0,
      failureRate: 0,
      timeoutRate: 0,
    };
  }
  
  const durations = completedEvents
    .map(e => e.durationMs ?? 0)
    .filter(d => d > 0)
    .sort((a, b) => a - b);
  
  const successCount = events.filter(e => e.type === 'transaction_confirmed').length;
  const failureCount = events.filter(e => e.type === 'transaction_failed').length;
  const timeoutCount = events.filter(e => e.errorCode === 'POLLING_TIMEOUT').length;
  
  const average = durations.length > 0 
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
    : 0;
  
  const median = durations.length > 0 
    ? durations[Math.floor(durations.length / 2)] 
    : 0;
  
  const p95 = durations.length > 0 
    ? durations[Math.floor(durations.length * 0.95)] 
    : 0;
  
  return {
    averageTransactionTime: average,
    medianTransactionTime: median,
    p95TransactionTime: p95,
    successRate: successCount / completedEvents.length,
    failureRate: failureCount / completedEvents.length,
    timeoutRate: timeoutCount / completedEvents.length,
  };
}

/**
 * Export telemetry data for analysis (sanitized)
 */
export function exportTelemetryData(): string {
  const events = telemetryBuffer.getEvents();
  const stats = calculateTelemetryStatistics();
  const metrics = calculatePerformanceMetrics();
  
  const exportData = {
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    statistics: stats,
    performanceMetrics: metrics,
    events: events, // Already sanitized
  };
  
  return JSON.stringify(exportData, null, 2);
}
