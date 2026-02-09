/**
 * @fileoverview Concurrency utilities for asyncer
 * @module asyncer/concurrency
 */

import type { AsyncTask, SafeResult } from './types.js';
import { safeAsync } from './async.js';

/**
 * Executes multiple async tasks in parallel.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @returns Array of results in the same order as input tasks
 *
 * @example
 * ```ts
 * const [user, posts, comments] = await parallel([
 *   () => User.findById(id),
 *   () => Post.findByUser(id),
 *   () => Comment.findByUser(id)
 * ]);
 * ```
 */
export async function parallel<T>(tasks: AsyncTask<T>[]): Promise<T[]> {
  return Promise.all(tasks.map((task) => task()));
}

/**
 * Executes multiple async tasks in sequence.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @returns Array of results in the same order as input tasks
 *
 * @example
 * ```ts
 * const results = await sequence([
 *   () => createUser(data),
 *   () => sendWelcomeEmail(),
 *   () => logActivity()
 * ]);
 * ```
 */
export async function sequence<T>(tasks: AsyncTask<T>[]): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    const result = await task();
    results.push(result);
  }

  return results;
}

/**
 * Executes async tasks in parallel with a concurrency limit.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @param limit - Maximum number of concurrent tasks
 * @returns Array of results in the same order as input tasks
 *
 * @example
 * ```ts
 * const results = await parallelLimit(
 *   urls.map(url => () => fetch(url)),
 *   5 // Max 5 concurrent requests
 * );
 * ```
 */
export async function parallelLimit<T>(
  tasks: AsyncTask<T>[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function runNext(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      const task = tasks[index];
      results[index] = await task();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => runNext()
  );

  await Promise.all(workers);
  return results;
}

/**
 * Executes all tasks and returns results for successful ones.
 * Ignores failures and returns only successful results.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @returns Array of successful results
 *
 * @example
 * ```ts
 * const validUsers = await parallelSafe([
 *   () => fetchUser(1),
 *   () => fetchUser(2), // might fail
 *   () => fetchUser(3)
 * ]);
 * ```
 */
export async function parallelSafe<T>(tasks: AsyncTask<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(tasks.map((task) => task()));

  const fulfilled: T[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      fulfilled.push(result.value as T);
    }
  }
  return fulfilled;
}

/**
 * Executes all tasks and returns detailed results including errors.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @returns Array of SafeResult tuples
 *
 * @example
 * ```ts
 * const results = await parallelSettled([
 *   () => fetchUser(1),
 *   () => fetchUser(2)
 * ]);
 *
 * results.forEach(([error, value]) => {
 *   if (error) console.error(error);
 *   else console.log(value);
 * });
 * ```
 */
export async function parallelSettled<T>(
  tasks: AsyncTask<T>[]
): Promise<SafeResult<T>[]> {
  return Promise.all(tasks.map((task) => safeAsync(task())));
}

/**
 * Races multiple tasks and returns the first successful result.
 * Continues racing until one succeeds or all fail.
 *
 * @template T - The return type of the tasks
 * @param tasks - Array of async task functions
 * @returns The first successful result
 * @throws AggregateError if all tasks fail
 *
 * @example
 * ```ts
 * const data = await raceSuccess([
 *   () => fetchFromPrimary(),
 *   () => fetchFromBackup(),
 *   () => fetchFromCache()
 * ]);
 * ```
 */
export async function raceSuccess<T>(tasks: AsyncTask<T>[]): Promise<T> {
  const errors: Error[] = [];

  return new Promise((resolve, reject) => {
    let remaining = tasks.length;

    if (remaining === 0) {
      reject(new Error('No tasks provided'));
      return;
    }

    tasks.forEach((task, index) => {
      task()
        .then(resolve)
        .catch((error: Error) => {
          errors[index] = error;
          remaining--;
          if (remaining === 0) {
            const aggregateError = new Error('All tasks failed') as Error & { errors: Error[] };
            aggregateError.errors = errors;
            reject(aggregateError);
          }
        });
    });
  });
}

/**
 * Executes tasks with a pipeline pattern.
 * Each task receives the result of the previous task.
 *
 * @template T - The input/output type
 * @param input - Initial input value
 * @param tasks - Array of async transform functions
 * @returns Final transformed value
 *
 * @example
 * ```ts
 * const result = await pipeline(rawData, [
 *   async (data) => validate(data),
 *   async (data) => transform(data),
 *   async (data) => save(data)
 * ]);
 * ```
 */
export async function pipeline<T>(
  input: T,
  tasks: Array<(input: T) => Promise<T>>
): Promise<T> {
  let result = input;

  for (const task of tasks) {
    result = await task(result);
  }

  return result;
}

/**
 * Creates a batch processor that groups items and processes them together.
 *
 * @template TInput - Input item type
 * @template TOutput - Output item type
 * @param batchSize - Number of items per batch
 * @param processor - Function to process a batch of items
 * @returns Batch processor function
 *
 * @example
 * ```ts
 * const batchInsert = batch(100, async (users) => {
 *   return db.users.insertMany(users);
 * });
 *
 * const results = await batchInsert(thousandsOfUsers);
 * ```
 */
export function batch<TInput, TOutput>(
  batchSize: number,
  processor: (items: TInput[]) => Promise<TOutput[]>
): (items: TInput[]) => Promise<TOutput[]> {
  return async (items: TInput[]): Promise<TOutput[]> => {
    const results: TOutput[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
    }

    return results;
  };
}

/**
 * Creates a semaphore for controlling concurrent access.
 *
 * @param limit - Maximum concurrent acquisitions
 * @returns Semaphore object with acquire and release methods
 *
 * @example
 * ```ts
 * const sem = semaphore(3);
 *
 * async function limitedOperation() {
 *   await sem.acquire();
 *   try {
 *     await doWork();
 *   } finally {
 *     sem.release();
 *   }
 * }
 * ```
 */
export function semaphore(limit: number): Semaphore {
  let count = 0;
  const queue: Array<() => void> = [];

  return {
    acquire(): Promise<void> {
      return new Promise((resolve) => {
        if (count < limit) {
          count++;
          resolve();
        } else {
          queue.push(resolve);
        }
      });
    },

    release(): void {
      const next = queue.shift();
      if (next) {
        next();
      } else {
        count--;
      }
    },

    get available(): number {
      return limit - count;
    },

    get pending(): number {
      return queue.length;
    },
  };
}

/**
 * Semaphore interface for controlling concurrent access
 */
export interface Semaphore {
  /** Acquire a slot (waits if at limit) */
  acquire(): Promise<void>;
  /** Release a slot */
  release(): void;
  /** Number of available slots */
  readonly available: number;
  /** Number of pending acquisitions */
  readonly pending: number;
}

/**
 * Creates a mutex (semaphore with limit of 1).
 *
 * @returns Mutex object
 *
 * @example
 * ```ts
 * const lock = mutex();
 *
 * async function criticalSection() {
 *   await lock.acquire();
 *   try {
 *     await exclusiveOperation();
 *   } finally {
 *     lock.release();
 *   }
 * }
 * ```
 */
export function mutex(): Semaphore {
  return semaphore(1);
}
