import { CountersAdapter } from './adapters';
import { InMemoryCounters } from './inMemory';
import { PersistentCounters } from './persistent';

let countersInstance: CountersAdapter | null = null;

/**
 * Get the counters adapter instance based on the environment.
 * In development/test, use in-memory counters.
 * In production, use persistent counters (Redis).
 */
export function getCountersAdapter(): CountersAdapter {
  if (countersInstance) {
    return countersInstance;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // In development and test environments, use in-memory counters
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    countersInstance = new InMemoryCounters();
  } else {
    // In production, use persistent counters (Redis)
    countersInstance = new PersistentCounters();
  }
  
  return countersInstance;
}

/**
 * Set the counters instance directly (useful for testing with mocks)
 */
export function setCountersAdapter(instance: CountersAdapter): void {
  countersInstance = instance;
}

/**
 * Reset the counters instance (mainly for testing)
 */
export function resetCountersAdapter(): void {
  if (countersInstance) {
    countersInstance.reset();
  }
  countersInstance = null;
}