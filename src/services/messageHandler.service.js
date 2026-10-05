/**
 * What the app DOES with an inbound webhook event.
 *
 * This is the file you extend: print to console today, persist to a database
 * and run business logic tomorrow (see src/db/ for the reserved folders).
 */
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { parseWebhookPayload } from './messageParser.service.js';
import { sendText, markAsRead } from './whatsapp.service.js';

const paint = logger.colour;

/** In-memory counters, printed by GET /api/stats. Replace with the DB later. */
export const stats = {
  startedAt: new Date().toISOString(),
  received: 0,
  sent: 0,
  statusUpdates: 0,
  failures: 0,
  lastMessageAt: null,
};

/** Ring buffer of the most recent inbound messages, for GET /api/messages. */
const RECENT_LIMIT = 50;
const recentMessages = [];

function remember(message) {
  recentMessages.unshift({
    id: message.id,
    from: message.from,
    profileName: message.profileName,
    type: message.type,
    text: message.text,
    timestamp: message.timestamp,
  });
  if (recentMessages.length > RECENT_LIMIT) recentMessages.length = RECENT_LIMIT;
}

export function getRecentMessages(limit = 20) {
  return recentMessages.slice(0, Math.max(1, Math.min(limit, RECENT_LIMIT)));
}

function printMessage(message) {
  const who = message.profileName ? `${message.profileName} (+${message.from})` : `+${message.from}`;

  console.log('');
  console.log(paint('green', '  INBOUND MESSAGE'));
  console.log(`  From      : ${paint('bold', who)}`);
  console.log(`  Type      : ${message.type}`);
  console.log(`  Text      : ${paint('cyan', message.text)}`);
  console.log(`  Message id: ${paint('dim', message.id)}`);
  console.log(`  Sent at   : ${paint('dim', message.timestamp)}`);
  if (message.replyToId) console.log(`  In reply to: ${paint('dim', message.replyToId)}`);
  if (message.media) console.log(`  Media     : id=${message.media.id} type=${message.media.mimeType}`);
  if (message.interactiveReplyId) console.log(`  Reply id  : ${message.interactiveReplyId}`);
  console.log('');
}

function printStatus(status) {
  const colours = { sent: 'dim', delivered: 'blue', read: 'green', failed: 'red' };
  const label = paint(colours[status.status] ?? 'dim', status.status.toUpperCase());
  logger.info(`Status ${label} for message ${paint('dim', status.id)} -> +${status.recipient}`);

  for (const error of status.errors ?? []) {
    logger.error(`  Delivery error ${error.code}: ${error.title}${error.message ? ` - ${error.message}` : ''}`);
  }
}

async function handleInboundMessage(message) {
  stats.received += 1;
  stats.lastMessageAt = message.timestamp;

  printMessage(message);
  remember(message);

  // TODO(db): persist `message` here once a database is wired up.

  if (config.behaviour.markAsRead) {
    try {
      await markAsRead(message.id);
    } catch (error) {
      logger.warn(`Could not mark ${message.id} as read: ${error.message}`);
    }
  }

  if (config.behaviour.autoReply && message.type !== 'reaction') {
    try {
      await sendText(message.from, config.behaviour.autoReplyText);
      stats.sent += 1;
    } catch (error) {
      stats.failures += 1;
      logger.error(`Auto-reply to +${message.from} failed: ${error.message}`);
    }
  }
}

/**
 * Entry point used by the webhook controller.
 * Never throws - the webhook must always answer Meta with 200.
 */
export async function processWebhookEvent(payload) {
  const { messages, statuses, errors } = parseWebhookPayload(payload);

  for (const error of errors) {
    stats.failures += 1;
    logger.error(`Webhook error ${error.code}: ${error.title ?? ''} ${error.message ?? ''}`.trim());
  }

  for (const status of statuses) {
    stats.statusUpdates += 1;
    printStatus(status);
  }

  for (const message of messages) {
    try {
      await handleInboundMessage(message);
    } catch (error) {
      stats.failures += 1;
      logger.error(`Failed to handle message ${message.id}: ${error.message}`);
    }
  }

  if (!messages.length && !statuses.length && !errors.length) {
    logger.debug('Webhook event contained no messages or statuses.');
    logger.json('Raw payload', payload);
  }

  return { messages: messages.length, statuses: statuses.length, errors: errors.length };
}

export default { processWebhookEvent, getRecentMessages, stats };
