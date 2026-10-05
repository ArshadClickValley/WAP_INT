/**
 * Validates the X-Hub-Signature-256 header Meta sends with every webhook POST.
 *
 * The signature is an HMAC-SHA256 of the RAW request body, keyed with your app
 * secret. That is why src/app.js captures `req.rawBody` in the JSON parser -
 * re-serialising the parsed object would produce a different byte string.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */
import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { forbidden } from '../utils/AppError.js';

const HEADER = 'x-hub-signature-256';
const PREFIX = 'sha256=';

export function verifySignature(req, res, next) {
  const { verifySignature: enabled, appSecret } = config.whatsapp;

  if (!enabled) {
    logger.debug('Signature verification disabled (VERIFY_SIGNATURE=false).');
    return next();
  }

  if (!appSecret) {
    logger.warn('WHATSAPP_APP_SECRET is not set - accepting the payload without verification.');
    return next();
  }

  const received = req.get(HEADER);
  if (!received || !received.startsWith(PREFIX)) {
    logger.warn(`Rejected webhook POST: missing or malformed ${HEADER} header.`);
    return next(forbidden('Missing or malformed X-Hub-Signature-256 header.'));
  }

  const rawBody = req.rawBody ?? Buffer.alloc(0);
  const expected = PREFIX + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  const matches =
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!matches) {
    logger.warn('Rejected webhook POST: signature mismatch (wrong WHATSAPP_APP_SECRET?).');
    return next(forbidden('Webhook signature verification failed.'));
  }

  logger.debug('Webhook signature verified.');
  return next();
}

export default verifySignature;
