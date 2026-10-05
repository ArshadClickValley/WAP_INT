/**
 * API #1 - the webhook Meta calls.
 *
 *   GET  /webhook  -> one-time verification handshake when you subscribe the URL
 *   POST /webhook  -> every inbound message and status update
 */
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { processWebhookEvent } from '../services/messageHandler.service.js';

/**
 * Verification handshake.
 * Meta calls this with hub.mode=subscribe, hub.verify_token and hub.challenge.
 * Answer with the raw challenge as plain text, or the subscription fails.
 */
export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!mode && !token) {
    // Someone opened the URL in a browser - be helpful rather than cryptic.
    return res.status(200).json({
      success: true,
      message: 'WAP_INT webhook is alive. Meta will call this endpoint with hub.* query parameters.',
      expects: ['hub.mode=subscribe', 'hub.verify_token=<your WHATSAPP_VERIFY_TOKEN>', 'hub.challenge=<random>'],
    });
  }

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info(logger.colour('green', 'Webhook verification succeeded - Meta accepted the callback URL.'));
    return res.status(200).type('text/plain').send(String(challenge ?? ''));
  }

  logger.warn(
    `Webhook verification FAILED (mode="${mode}"). The token Meta sent does not match WHATSAPP_VERIFY_TOKEN in .env.`,
  );
  return res.sendStatus(403);
}

/**
 * Inbound events.
 * Meta retries anything that is not answered quickly with 200, so acknowledge
 * first and process afterwards.
 */
export function receiveWebhook(req, res) {
  res.sendStatus(200);

  logger.json('Raw webhook payload', req.body);

  Promise.resolve(processWebhookEvent(req.body)).catch((error) => {
    logger.error(`Unhandled webhook processing error: ${error.message}`);
  });
}

export default { verifyWebhook, receiveWebhook };
