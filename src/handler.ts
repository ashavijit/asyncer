/**
 * @fileoverview Handler abstractions for asyncer
 * @module asyncer/handler
 */

import type {
  GenericRequest,
  GenericResponse,
  NextFunction,
  AsyncHandlerFn,
  ApiHandlerFn,
  Controller,
  ApiResponse,
} from './types.js';
import { ApiError, isApiError, wrapError } from './error.js';
import { success } from './response.js';

/**
 * Wraps an async route handler to catch errors and pass them to the next middleware.
 * Framework-agnostic implementation that works with Express, Fastify, etc.
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @param fn - The async handler function
 * @returns Wrapped handler function
 *
 * @example
 * ```ts
 * app.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   res.json(user);
 * }));
 * ```
 */
export function asyncHandler<
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse
>(
  fn: (req: TReq, res: TRes, next: NextFunction) => Promise<void>
): AsyncHandlerFn<TReq, TRes> {
  return async (req: TReq, res: TRes, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Wraps an API handler that returns data, automatically formatting the response.
 * Handles errors and converts the return value to a standard API response.
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @template T - Return data type
 * @param fn - The handler function that returns data
 * @param statusCode - HTTP status code for successful responses
 * @returns Wrapped handler function
 *
 * @example
 * ```ts
 * app.get('/users/:id', apiHandler(async (req) => {
 *   const user = await User.findById(req.params.id);
 *   if (!user) throw ApiError.notFound('User not found');
 *   return user;
 * }));
 * ```
 */
export function apiHandler<
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse,
  T = unknown
>(
  fn: ApiHandlerFn<TReq, T>,
  statusCode = 200
): AsyncHandlerFn<TReq, TRes> {
  return async (req: TReq, res: TRes, next: NextFunction): Promise<void> => {
    try {
      const result = await fn(req);
      const response = success(result);

      if (res.status && res.json) {
        res.status(statusCode).json!(response);
      } else if (res.send) {
        res.send!(response);
      }
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Wraps an entire controller object, applying asyncHandler to all methods.
 *
 * @template T - Controller type
 * @param controller - The controller object
 * @returns Controller with wrapped methods
 *
 * @example
 * ```ts
 * const userController = wrapController({
 *   async getUser(req, res) { ... },
 *   async createUser(req, res) { ... }
 * });
 * ```
 */
export function wrapController<T extends Controller>(controller: T): T {
  const wrapped: Partial<T> = {};

  for (const key of Object.keys(controller) as Array<keyof T>) {
    const value = controller[key];
    if (typeof value === 'function') {
      wrapped[key] = asyncHandler(value as AsyncHandlerFn) as T[keyof T];
    } else {
      wrapped[key] = value;
    }
  }

  return wrapped as T;
}

/**
 * Creates a middleware composition function.
 * Executes middlewares in sequence, passing control with next().
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @param middlewares - Array of middleware functions
 * @returns Combined middleware function
 *
 * @example
 * ```ts
 * const authFlow = compose(
 *   validateToken,
 *   checkPermissions,
 *   logRequest
 * );
 * app.use('/api', authFlow);
 * ```
 */
export function compose<
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse
>(
  ...middlewares: Array<AsyncHandlerFn<TReq, TRes>>
): AsyncHandlerFn<TReq, TRes> {
  return async (req: TReq, res: TRes, next: NextFunction): Promise<void> => {
    let index = 0;

    const dispatch = async (i: number): Promise<void> => {
      if (i < middlewares.length) {
        const middleware = middlewares[i];
        await middleware(req, res, async (error?: Error) => {
          if (error) {
            next(error);
          } else {
            await dispatch(i + 1);
          }
        });
      } else {
        next();
      }
    };

    try {
      await dispatch(index);
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Creates an error handling middleware.
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @param options - Error handler options
 * @returns Error handling middleware
 *
 * @example
 * ```ts
 * app.use(errorHandler({
 *   logErrors: true,
 *   includeStack: process.env.NODE_ENV === 'development'
 * }));
 * ```
 */
export function errorHandler<
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse
>(options: ErrorHandlerOptions = {}): (
  error: Error,
  req: TReq,
  res: TRes,
  next: NextFunction
) => void {
  const {
    logErrors = true,
    includeStack = false,
    defaultStatusCode = 500,
    defaultMessage = 'Internal Server Error',
    onError,
  } = options;

  return (
    error: Error,
    _req: TReq,
    res: TRes,
    _next: NextFunction
  ): void => {
    if (logErrors) {
      console.error('[asyncer] Error:', error);
    }

    if (onError) {
      onError(error);
    }

    const apiError = isApiError(error)
      ? error
      : wrapError(error, defaultStatusCode);

    const response: ApiResponse<never> & { stack?: string } = {
      success: false,
      message: apiError.message || defaultMessage,
      error: apiError.details,
    };

    if (includeStack && error.stack) {
      response.stack = error.stack;
    }

    if (res.status && res.json) {
      res.status(apiError.statusCode).json!(response);
    } else if (res.send) {
      res.send!(response);
    }
  };
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Whether to log errors to console */
  logErrors?: boolean;
  /** Whether to include stack trace in response */
  includeStack?: boolean;
  /** Default status code for non-API errors */
  defaultStatusCode?: number;
  /** Default error message */
  defaultMessage?: string;
  /** Custom error callback */
  onError?: (error: Error) => void;
}

/**
 * Creates a guard middleware that checks a condition before proceeding.
 *
 * @template TReq - Request type
 * @template TRes - Response type
 * @param check - Function that returns true if the request should proceed
 * @param onFail - Error to throw or function to call when check fails
 * @returns Guard middleware
 *
 * @example
 * ```ts
 * const isAdmin = guard(
 *   (req) => req.user?.role === 'admin',
 *   ApiError.forbidden('Admin access required')
 * );
 * app.delete('/users/:id', isAdmin, deleteUser);
 * ```
 */
export function guard<
  TReq extends GenericRequest = GenericRequest,
  TRes extends GenericResponse = GenericResponse
>(
  check: (req: TReq) => boolean | Promise<boolean>,
  onFail: ApiError | ((req: TReq) => ApiError)
): AsyncHandlerFn<TReq, TRes> {
  return async (req: TReq, _res: TRes, next: NextFunction): Promise<void> => {
    try {
      const passed = await check(req);
      if (!passed) {
        const error = typeof onFail === 'function' ? onFail(req) : onFail;
        throw error;
      }
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
