/**
 * Operational error carrying an HTTP status code, so the error middleware can
 * answer with something more useful than a generic 500.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const badRequest = (message, details) => new AppError(message, 400, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Unauthorized') => new AppError(message, 401, 'UNAUTHORIZED');
export const forbidden = (message = 'Forbidden') => new AppError(message, 403, 'FORBIDDEN');
export const notFoundError = (message = 'Not found') => new AppError(message, 404, 'NOT_FOUND');

export default AppError;
