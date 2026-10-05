/** One console line per HTTP request, with status and duration. */
import { logger } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const colour = res.statusCode >= 500 ? 'red' : res.statusCode >= 400 ? 'yellow' : 'green';
    const status = logger.colour(colour, String(res.statusCode));

    logger.info(`${req.method} ${req.originalUrl} ${status} ${logger.colour('dim', `${durationMs.toFixed(1)}ms`)}`);
  });

  next();
}

export default requestLogger;
