/**
 * @fileoverview Public API entry point for asyncer
 * @module asyncer
 *
 * Asyncer - Lightweight async API utilities for Node.js
 *
 * @example
 * ```ts
 * import {
 *   apiHandler,
 *   ApiError,
 *   success,
 *   retryAsync,
 *   withTimeout
 * } from 'asyncer';
 *
 * export const getUser = apiHandler(async (req) => {
 *   const user = await retryAsync(
 *     () => User.findById(req.params.id),
 *     { retries: 3, delay: 1000 }
 *   );
 *   if (!user) throw ApiError.notFound('User not found');
 *   return user;
 * });
 * ```
 */

// Types
export type {
  ApiErrorDetails,
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
  AsyncTask,
  SafeResult,
  RetryOptions,
  TimeoutOptions,
  GenericRequest,
  GenericResponse,
  NextFunction,
  AsyncHandlerFn,
  ApiHandlerFn,
  Controller,
  ContextStore,
} from './types.js';

// Error utilities
export {
  ApiError,
  isApiError,
  wrapError,
  assert,
  assertExists,
} from './error.js';

// Response helpers
export {
  success,
  failure,
  paginated,
  noContent,
  created,
  HttpStatus,
} from './response.js';

export type { HttpStatusCode } from './response.js';

// Async utilities
export {
  safeAsync,
  retryAsync,
  retry,
  withTimeout,
  sleep,
  delay,
  deferred,
  ignoreError,
  once,
  debounce,
} from './async.js';

// Handler utilities
export {
  asyncHandler,
  apiHandler,
  wrapController,
  compose,
  errorHandler,
  guard,
} from './handler.js';

export type { ErrorHandlerOptions } from './handler.js';

// Concurrency utilities
export {
  parallel,
  sequence,
  parallelLimit,
  parallelSafe,
  parallelSettled,
  raceSuccess,
  pipeline,
  batch,
  semaphore,
  mutex,
} from './concurrency.js';

export type { Semaphore } from './concurrency.js';

// Context utilities
export {
  runWithContext,
  runWithContextAsync,
  getStore,
  getContext,
  getContextOrThrow,
  setContext,
  deleteContext,
  hasContext,
  getAllContext,
  clearContext,
  createContextKey,
  contextMiddleware,
} from './context.js';

export type { ContextAccessor } from './context.js';
