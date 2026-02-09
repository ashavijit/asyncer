/**
 * @fileoverview Response helper functions for asyncer
 * @module asyncer/response
 */

import type {
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
  ApiErrorDetails,
} from './types.js';

/**
 * Creates a successful API response
 *
 * @template T - The type of the data payload
 * @param data - The response data
 * @param message - Optional success message
 * @returns Formatted success response
 *
 * @example
 * ```ts
 * return success({ id: 1, name: 'John' });
 * return success(users, 'Users retrieved successfully');
 * ```
 */
export function success<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Creates a failure API response
 *
 * @param message - Error message
 * @param details - Optional error details
 * @returns Formatted failure response
 *
 * @example
 * ```ts
 * return failure('User not found');
 * return failure('Validation failed', { field: 'email' });
 * ```
 */
export function failure(
  message: string,
  details?: ApiErrorDetails
): ApiResponse<never> {
  const response: ApiResponse<never> = {
    success: false,
    message,
  };

  if (details) {
    response.error = details;
  }

  return response;
}

/**
 * Creates a paginated API response
 *
 * @template T - The type of items in the data array
 * @param data - Array of items for the current page
 * @param pagination - Pagination metadata
 * @param message - Optional success message
 * @returns Formatted paginated response
 *
 * @example
 * ```ts
 * return paginated(users, { page: 1, limit: 10, total: 100 });
 * ```
 */
export function paginated<T>(
  data: T[],
  pagination: Pick<PaginationMeta, 'page' | 'limit' | 'total'>,
  message?: string
): PaginatedResponse<T> {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Creates a response with no content (for DELETE operations)
 *
 * @param message - Optional success message
 * @returns Formatted success response with no data
 *
 * @example
 * ```ts
 * return noContent('User deleted successfully');
 * ```
 */
export function noContent(message?: string): ApiResponse<null> {
  return success(null, message);
}

/**
 * Creates a created response (for POST operations)
 *
 * @template T - The type of the created resource
 * @param data - The created resource data
 * @param message - Optional success message
 * @returns Formatted success response
 *
 * @example
 * ```ts
 * return created(newUser, 'User created successfully');
 * ```
 */
export function created<T>(
  data: T,
  message = 'Resource created successfully'
): ApiResponse<T> {
  return success(data, message);
}

/**
 * HTTP status code constants
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Type for HTTP status codes
 */
export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];
