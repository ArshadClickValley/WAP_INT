/** 404 + centralised error responses. Must be registered last. */
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      hint: `Try GET /health, GET ${config.webhookPath} or POST /api/messages`,
    },
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity (4 args).
export function errorHandler(error, req, res, next) {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : error.statusCode ?? 500;

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.message}`);
    if (error.stack) logger.debug(error.stack);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${error.message}`);
  }

  if (isAppError && error.details) logger.json('Error details', error.details);

  const body = isAppError
    ? error.toJSON()
    : {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: statusCode >= 500 && config.env === 'production' ? 'Internal server error' : error.message,
        },
      };

  if (config.env !== 'production' && error.stack) {
    body.error.stack = error.stack.split('\n').slice(0, 5);
  }

  res.status(statusCode).json(body);
}

export default { notFoundHandler, errorHandler };
