/**
 * @fileoverview Async control utilities for asyncer
 * @module asyncer/async
 */

import type { SafeResult, RetryOptions, AsyncTask } from './types.js';
import { ApiError } from './error.js';

/**
 * Wraps a promise to return a tuple of [error, result] instead of throwing.
 * Inspired by Go-style error handling.
 *
 * @template T - The type of the success value
 * @template E - The type of the error
 * @param promise - The promise to wrap
 * @returns A tuple of [error, null] or [null, result]
 *
 * @example
 * ```ts
 * const [error, user] = await safeAsync(User.findById(id));
 * if (error) {
 *   console.error('Failed to find user:', error);
 *   return;
 * }
 * console.log('Found user:', user);
 * ```
 */
export async function safeAsync<T, E = Error>(
  promise: Promise<T>
): Promise<SafeResult<T, E>> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error as E, null];
  }
}

/**
 * Retries an async function with configurable retry logic and exponential backoff.
 *
 * @template T - The return type of the async function
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the async function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const result = await retryAsync(
 *   () => fetchExternalApi(),
 *   { retries: 3, delay: 1000, backoffMultiplier: 2 }
 * );
 * ```
 */
export async function retryAsync<T>(
  fn: AsyncTask<T>,
  options: RetryOptions
): Promise<T> {
  const {
    retries,
    delay = 1000,
    backoffMultiplier = 1,
    maxDelay = 30000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === retries || !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Shorthand for retryAsync with simple numeric options
 *
 * @template T - The return type of the async function
 * @param fn - The async function to retry
 * @param retries - Number of retry attempts
 * @param delay - Delay between retries in milliseconds
 * @returns The result of the async function
 *
 * @example
 * ```ts
 * const user = await retry(() => User.findById(id), 3, 1000);
 * ```
 */
export async function retry<T>(
  fn: AsyncTask<T>,
  retries: number,
  delay = 1000
): Promise<T> {
  return retryAsync(fn, { retries, delay });
}

/**
 * Adds a timeout to a promise. Rejects with a TimeoutError if the promise
 * doesn't resolve within the specified time.
 *
 * @template T - The type of the promise result
 * @param promise - The promise to add a timeout to
 * @param ms - Timeout duration in milliseconds
 * @param message - Custom timeout error message
 * @returns The result of the promise
 * @throws ApiError with status 408 if timeout is exceeded
 *
 * @example
 * ```ts
 * const result = await withTimeout(fetchData(), 5000);
 * const result = await withTimeout(fetchData(), 5000, 'Data fetch timed out');
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new ApiError(408, message || `Operation timed out after ${ms}ms`)
      );
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Creates a promise that resolves after the specified delay.
 *
 * @param ms - Delay duration in milliseconds
 * @returns A promise that resolves after the delay
 *
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Alias for sleep function
 */
export const delay = sleep;

/**
 * Creates a deferred promise that can be resolved or rejected externally.
 *
 * @template T - The type of the promise result
 * @returns An object with the promise and resolve/reject functions
 *
 * @example
 * ```ts
 * const { promise, resolve, reject } = deferred<string>();
 * setTimeout(() => resolve('done'), 1000);
 * const result = await promise;
 * ```
 */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Executes an async function and ignores any errors.
 * Useful for fire-and-forget operations.
 *
 * @template T - The return type of the async function
 * @param fn - The async function to execute
 * @param onError - Optional error handler
 * @returns The result or undefined if an error occurred
 *
 * @example
 * ```ts
 * await ignoreError(() => analytics.track('page_view'));
 * await ignoreError(() => sendEmail(), (err) => console.warn(err));
 * ```
 */
export async function ignoreError<T>(
  fn: AsyncTask<T>,
  onError?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    return undefined;
  }
}

/**
 * Wraps an async function to ensure it only executes once.
 * Subsequent calls return the cached result.
 *
 * @template T - The return type of the async function
 * @param fn - The async function to wrap
 * @returns A wrapped function that only executes once
 *
 * @example
 * ```ts
 * const loadConfig = once(() => readConfigFile());
 * const config1 = await loadConfig(); // Reads file
 * const config2 = await loadConfig(); // Returns cached result
 * ```
 */
export function once<T>(fn: AsyncTask<T>): AsyncTask<T> {
  let executed = false;
  let result: T;

  return async () => {
    if (!executed) {
      result = await fn();
      executed = true;
    }
    return result;
  };
}

/**
 * Creates a debounced version of an async function.
 * The function will only be called after the specified delay has passed
 * without any new calls.
 *
 * @template T - The return type of the async function
 * @param fn - The async function to debounce
 * @param ms - Debounce delay in milliseconds
 * @returns A debounced version of the function
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce((query) => search(query), 300);
 * ```
 */
export function debounce<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let pendingPromise: Promise<ReturnType<T>> | undefined;
  let pendingResolve: ((value: ReturnType<T>) => void) | undefined;
  let pendingReject: ((reason?: unknown) => void) | undefined;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!pendingPromise) {
      pendingPromise = new Promise<ReturnType<T>>((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
      });
    }

    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...args);
        pendingResolve?.(result as ReturnType<T>);
      } catch (error) {
        pendingReject?.(error);
      } finally {
        pendingPromise = undefined;
        pendingResolve = undefined;
        pendingReject = undefined;
      }
    }, ms);

    return pendingPromise;
  };
}
