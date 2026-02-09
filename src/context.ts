/**
 * @fileoverview Request context utilities using AsyncLocalStorage
 * @module asyncer/context
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ContextStore } from './types.js';

/**
 * Global context storage using AsyncLocalStorage.
 * Provides request-scoped context that flows through async operations.
 */
const globalStorage = new AsyncLocalStorage<ContextStore>();

/**
 * Runs a function with a new context store.
 *
 * @template T - Return type of the function
 * @param fn - Function to run with context
 * @param initialContext - Optional initial context values
 * @returns Result of the function
 *
 * @example
 * ```ts
 * app.use((req, res, next) => {
 *   runWithContext(() => {
 *     setContext('requestId', uuid());
 *     setContext('userId', req.user?.id);
 *     next();
 *   });
 * });
 * ```
 */
export function runWithContext<T>(
  fn: () => T,
  initialContext?: Record<string, unknown>
): T {
  const store: ContextStore = new Map();

  if (initialContext) {
    for (const [key, value] of Object.entries(initialContext)) {
      store.set(key, value);
    }
  }

  return globalStorage.run(store, fn);
}

/**
 * Runs an async function with a new context store.
 *
 * @template T - Return type of the function
 * @param fn - Async function to run with context
 * @param initialContext - Optional initial context values
 * @returns Promise of the result
 *
 * @example
 * ```ts
 * const result = await runWithContextAsync(async () => {
 *   setContext('traceId', generateTraceId());
 *   return await processRequest();
 * });
 * ```
 */
export async function runWithContextAsync<T>(
  fn: () => Promise<T>,
  initialContext?: Record<string, unknown>
): Promise<T> {
  return runWithContext(fn, initialContext);
}

/**
 * Gets the current context store.
 *
 * @returns The current context store or undefined if not in a context
 *
 * @example
 * ```ts
 * const store = getStore();
 * if (store) {
 *   console.log('In context');
 * }
 * ```
 */
export function getStore(): ContextStore | undefined {
  return globalStorage.getStore();
}

/**
 * Gets a value from the current context.
 *
 * @template T - Expected type of the value
 * @param key - Context key
 * @returns The value or undefined
 *
 * @example
 * ```ts
 * const requestId = getContext<string>('requestId');
 * const userId = getContext<number>('userId');
 * ```
 */
export function getContext<T>(key: string): T | undefined {
  const store = globalStorage.getStore();
  return store?.get(key) as T | undefined;
}

/**
 * Gets a value from context or throws if not found.
 *
 * @template T - Expected type of the value
 * @param key - Context key
 * @param errorMessage - Custom error message
 * @returns The value
 * @throws Error if the key is not found
 *
 * @example
 * ```ts
 * const requestId = getContextOrThrow<string>('requestId');
 * ```
 */
export function getContextOrThrow<T>(key: string, errorMessage?: string): T {
  const value = getContext<T>(key);
  if (value === undefined) {
    throw new Error(errorMessage || `Context key "${key}" not found`);
  }
  return value;
}

/**
 * Sets a value in the current context.
 *
 * @template T - Type of the value
 * @param key - Context key
 * @param value - Value to set
 * @returns True if the value was set, false if not in a context
 *
 * @example
 * ```ts
 * setContext('userId', 123);
 * setContext('startTime', Date.now());
 * ```
 */
export function setContext<T>(key: string, value: T): boolean {
  const store = globalStorage.getStore();
  if (!store) {
    return false;
  }
  store.set(key, value);
  return true;
}

/**
 * Deletes a value from the current context.
 *
 * @param key - Context key to delete
 * @returns True if the key was deleted, false if not found or not in context
 *
 * @example
 * ```ts
 * deleteContext('temporaryData');
 * ```
 */
export function deleteContext(key: string): boolean {
  const store = globalStorage.getStore();
  return store?.delete(key) ?? false;
}

/**
 * Checks if a key exists in the current context.
 *
 * @param key - Context key to check
 * @returns True if the key exists
 *
 * @example
 * ```ts
 * if (hasContext('userId')) {
 *   // User is authenticated
 * }
 * ```
 */
export function hasContext(key: string): boolean {
  const store = globalStorage.getStore();
  return store?.has(key) ?? false;
}

/**
 * Gets all context key-value pairs.
 *
 * @returns Object with all context values
 *
 * @example
 * ```ts
 * const ctx = getAllContext();
 * console.log('Current context:', ctx);
 * ```
 */
export function getAllContext(): Record<string, unknown> {
  const store = globalStorage.getStore();
  if (!store) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of store.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * Clears all values from the current context.
 *
 * @returns True if the context was cleared, false if not in context
 *
 * @example
 * ```ts
 * clearContext();
 * ```
 */
export function clearContext(): boolean {
  const store = globalStorage.getStore();
  if (!store) {
    return false;
  }
  store.clear();
  return true;
}

/**
 * Creates a typed context accessor for a specific key.
 *
 * @template T - Type of the context value
 * @param key - Context key
 * @param defaultValue - Optional default value
 * @returns Object with get and set methods
 *
 * @example
 * ```ts
 * const requestId = createContextKey<string>('requestId');
 *
 * // Later in code:
 * requestId.set(uuid());
 * console.log('Request ID:', requestId.get());
 * ```
 */
export function createContextKey<T>(
  key: string,
  defaultValue?: T
): ContextAccessor<T> {
  return {
    get(): T | undefined {
      return getContext<T>(key) ?? defaultValue;
    },

    set(value: T): boolean {
      return setContext(key, value);
    },

    delete(): boolean {
      return deleteContext(key);
    },

    has(): boolean {
      return hasContext(key);
    },
  };
}

/**
 * Context accessor interface for typed context keys
 */
export interface ContextAccessor<T> {
  /** Get the context value */
  get(): T | undefined;
  /** Set the context value */
  set(value: T): boolean;
  /** Delete the context value */
  delete(): boolean;
  /** Check if the context value exists */
  has(): boolean;
}

/**
 * Creates a middleware that initializes context for each request.
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @param setup - Optional setup function to initialize context values
 * @returns Middleware function
 *
 * @example
 * ```ts
 * app.use(contextMiddleware((req) => ({
 *   requestId: uuid(),
 *   userId: req.user?.id,
 *   startTime: Date.now()
 * })));
 * ```
 */
export function contextMiddleware<TReq, TRes>(
  setup?: (req: TReq) => Record<string, unknown>
): (req: TReq, res: TRes, next: () => void) => void {
  return (req: TReq, _res: TRes, next: () => void): void => {
    const initialContext = setup ? setup(req) : undefined;
    runWithContext(() => {
      next();
    }, initialContext);
  };
}
