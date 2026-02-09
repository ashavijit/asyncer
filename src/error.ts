/**
 * @fileoverview Error handling system for asyncer
 * @module asyncer/error
 */

import type { ApiErrorDetails } from './types.js';

/**
 * Custom API error class for standardized error handling.
 * Extends the native Error class with additional properties for API responses.
 *
 * @example
 * ```ts
 * throw new ApiError(404, 'User not found');
 * throw new ApiError(400, 'Validation failed', { field: 'email' });
 * throw ApiError.notFound('Resource not found');
 * ```
 */
export class ApiError extends Error {
  /**
   * HTTP status code for the error response
   */
  public readonly statusCode: number;

  /**
   * Additional error details
   */
  public readonly details?: ApiErrorDetails;

  /**
   * Indicates if this is an operational error (expected) vs programming error
   */
  public readonly isOperational: boolean;

  /**
   * Timestamp when the error was created
   */
  public readonly timestamp: Date;

  /**
   * Creates a new ApiError instance
   *
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param details - Additional error details
   * @param isOperational - Whether this is an operational error
   */
  constructor(
    statusCode: number,
    message: string,
    details?: ApiErrorDetails,
    isOperational = true
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts the error to a plain object for JSON serialization
   *
   * @returns Plain object representation of the error
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Creates a 400 Bad Request error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static badRequest(
    message = 'Bad Request',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(400, message, details);
  }

  /**
   * Creates a 401 Unauthorized error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static unauthorized(
    message = 'Unauthorized',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(401, message, details);
  }

  /**
   * Creates a 403 Forbidden error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static forbidden(
    message = 'Forbidden',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(403, message, details);
  }

  /**
   * Creates a 404 Not Found error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static notFound(
    message = 'Not Found',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(404, message, details);
  }

  /**
   * Creates a 409 Conflict error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static conflict(
    message = 'Conflict',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(409, message, details);
  }

  /**
   * Creates a 422 Unprocessable Entity error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static unprocessable(
    message = 'Unprocessable Entity',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(422, message, details);
  }

  /**
   * Creates a 429 Too Many Requests error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static tooManyRequests(
    message = 'Too Many Requests',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(429, message, details);
  }

  /**
   * Creates a 500 Internal Server Error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static internal(
    message = 'Internal Server Error',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(500, message, details, false);
  }

  /**
   * Creates a 503 Service Unavailable error
   *
   * @param message - Error message
   * @param details - Additional error details
   * @returns ApiError instance
   */
  public static serviceUnavailable(
    message = 'Service Unavailable',
    details?: ApiErrorDetails
  ): ApiError {
    return new ApiError(503, message, details);
  }
}

/**
 * Type guard to check if an error is an ApiError
 *
 * @param error - The error to check
 * @returns True if the error is an ApiError instance
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (err) {
 *   if (isApiError(err)) {
 *     console.log(err.statusCode);
 *   }
 * }
 * ```
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Wraps an unknown error into an ApiError
 *
 * @param error - The error to wrap
 * @param defaultStatusCode - Default status code if not an ApiError
 * @returns ApiError instance
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (err) {
 *   throw wrapError(err, 500);
 * }
 * ```
 */
export function wrapError(error: unknown, defaultStatusCode = 500): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(defaultStatusCode, error.message, undefined, false);
  }

  return new ApiError(
    defaultStatusCode,
    String(error),
    undefined,
    false
  );
}

/**
 * Assertion helper that throws an ApiError if the condition is falsy
 *
 * @param condition - The condition to assert
 * @param message - Error message if assertion fails
 * @param statusCode - HTTP status code for the error
 * @throws ApiError if condition is falsy
 *
 * @example
 * ```ts
 * assert(req.params.id, 'Missing user ID', 400);
 * assert(user, 'User not found', 404);
 * ```
 */
export function assert(
  condition: unknown,
  message: string,
  statusCode = 400
): asserts condition {
  if (!condition) {
    throw new ApiError(statusCode, message);
  }
}

/**
 * Assertion helper that throws an ApiError if the value is null or undefined
 *
 * @param value - The value to check
 * @param message - Error message if value is nullish
 * @param statusCode - HTTP status code for the error
 * @returns The value if it exists
 * @throws ApiError if value is null or undefined
 *
 * @example
 * ```ts
 * const user = assertExists(await User.findById(id), 'User not found', 404);
 * ```
 */
export function assertExists<T>(
  value: T | null | undefined,
  message: string,
  statusCode = 404
): T {
  if (value === null || value === undefined) {
    throw new ApiError(statusCode, message);
  }
  return value;
}
