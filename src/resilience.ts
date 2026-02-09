import type { AsyncTask, Bulkhead, BulkheadOptions, CircuitBreakerOptions, CircuitBreakerState } from './types.js';
import { ApiError } from './error.js';

/**
 * Executes a task and returns a fallback value or executes a fallback function if it fails.
 */
export async function fallback<T>(
  task: AsyncTask<T>,
  fallbackValueOrFn: T | ((error: Error) => T | Promise<T>)
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (typeof fallbackValueOrFn === 'function') {
      return (fallbackValueOrFn as (error: Error) => T | Promise<T>)(error as Error);
    }
    return fallbackValueOrFn;
  }
}

/**
 * Bulkhead implementation to limit concurrent executions of a task.
 */
export function bulkhead<T>(options: BulkheadOptions): Bulkhead<T> {
  const { concurrency, maxQueue = Infinity } = options;
  let activeCount = 0;
  const queue: Array<{ resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: any) => void; task: AsyncTask<T> }> = [];

  const processQueue = async () => {
    if (activeCount >= concurrency || queue.length === 0) {
      return;
    }

    const { resolve, reject, task } = queue.shift()!;
    activeCount++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      activeCount--;
      processQueue();
    }
  };

  return async (task: AsyncTask<T>): Promise<T> => {
    if (activeCount < concurrency) {
      activeCount++;
      try {
        return await task();
      } finally {
        activeCount--;
        processQueue();
      }
    }

    if (queue.length >= maxQueue) {
      throw new ApiError(429, 'Bulkhead queue limit reached');
    }

    return new Promise<T>((resolve, reject) => {
      queue.push({ resolve, reject, task });
    });
  };
}

/**
 * Circuit Breaker implementation to protect against cascading failures.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      successThreshold: 2,
      shouldTrip: () => true,
      ...options,
    };
  }

  async execute<T>(task: AsyncTask<T>): Promise<T> {
    this.updateState();

    if (this.state === 'OPEN') {
      throw new ApiError(503, 'Circuit breaker is OPEN', {
        code: 'CIRCUIT_BREAKER_OPEN',
        lastFailure: new Date(this.lastFailureTime).toISOString()
      });
    }

    try {
      const result = await task();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    this.updateState();
    return this.state;
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onFailure(error: Error): void {
    if (!this.options.shouldTrip(error)) return;

    if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.options.failureThreshold) {
        this.trip();
      }
    } else if (this.state === 'HALF_OPEN') {
      this.trip();
    }
  }

  private updateState(): void {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
  }

  private trip(): void {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }
}
