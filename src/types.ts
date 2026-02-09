/**
 * @fileoverview Shared TypeScript types and interfaces for asyncer
 * @module asyncer/types
 */

/**
 * Details object for API errors
 */
export interface ApiErrorDetails {
  /** Field-specific errors for validation */
  field?: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Standard API response structure
 * @template T - The type of the data payload
 */
export interface ApiResponse<T = unknown> {
  /** Indicates if the request was successful */
  success: boolean;
  /** Response data payload */
  data?: T;
  /** Human-readable message */
  message?: string;
  /** Error details when success is false */
  error?: ApiErrorDetails;
}

/**
 * Paginated API response structure
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * Generic async task function type
 * @template T - The return type of the task
 */
export type AsyncTask<T> = () => Promise<T>;

/**
 * Result tuple for safe async operations (Go-style error handling)
 * @template T - The type of the success value
 * @template E - The type of the error (defaults to Error)
 */
export type SafeResult<T, E = Error> = [E, null] | [null, T];

/**
 * Configuration options for retry operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  retries: number;
  /** Base delay between retries in milliseconds */
  delay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds */
  maxDelay?: number;
  /** Function to determine if an error is retryable */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback invoked on each retry attempt */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Configuration options for timeout operations
 */
export interface TimeoutOptions {
  /** Timeout duration in milliseconds */
  ms: number;
  /** Custom error message for timeout */
  message?: string;
}

/**
 * Generic request object interface (framework-independent)
 */
export interface GenericRequest {
  /** Request parameters */
  params?: Record<string, string>;
  /** Query string parameters */
  query?: Record<string, string | string[]>;
  /** Request body */
  body?: unknown;
  /** Request headers */
  headers?: Record<string, string | string[] | undefined>;
  /** HTTP method */
  method?: string;
  /** Request URL path */
  path?: string;
}

/**
 * Generic response object interface (framework-agnostic)
 */
export interface GenericResponse {
  /** Set HTTP status code */
  status?: (code: number) => GenericResponse;
  /** Send JSON response */
  json?: (data: unknown) => void;
  /** Send response */
  send?: (data: unknown) => void;
}

/**
 * Next function type for middleware chains
 */
export type NextFunction = (error?: Error) => void;

/**
 * Async handler function signature
 * @template TReq - Request type
 * @template TRes - Response type
 */
export type AsyncHandlerFn<TReq = GenericRequest, TRes = GenericResponse> = (
  req: TReq,
  res: TRes,
  next: NextFunction
) => Promise<void>;

/**
 * API handler function signature (returns data instead of sending response)
 * @template TReq - Request type
 * @template T - Return data type
 */
export type ApiHandlerFn<TReq = GenericRequest, T = unknown> = (
  req: TReq
) => Promise<T>;

/**
 * Controller object with handler methods
 */
export interface Controller {
  [key: string]: AsyncHandlerFn | unknown;
}

/**
 * Configuration options for circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Number of failures before tripping the circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting to reset (moving to HALF_OPEN) */
  resetTimeout: number;
  /** Number of successes required in HALF_OPEN state to fully close the circuit */
  successThreshold?: number;
  /** Function to determine if an error should count towards failure threshold */
  shouldTrip?: (error: Error) => boolean;
}

/**
 * States of a circuit breaker
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuration options for bulkhead
 */
export interface BulkheadOptions {
  /** Maximum number of concurrent executions */
  concurrency: number;
  /** Maximum number of tasks waiting in queue (optional) */
  maxQueue?: number;
}

/**
 * Context store type for AsyncLocalStorage
 */
export type ContextStore = Map<string, unknown>;
