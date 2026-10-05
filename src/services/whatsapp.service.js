/**
 * Thin client over the WhatsApp Cloud API (Meta Graph API).
 *
 * Every outbound message is a POST to:
 *   https://graph.facebook.com/<version>/<phone-number-id>/messages
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { normalisePhone, isValidPhone } from '../utils/phone.js';

const MESSAGING_PRODUCT = 'whatsapp';

function graphUrl(pathSuffix) {
  const { graphBaseUrl, apiVersion } = config.whatsapp;
  return `${graphBaseUrl}/${apiVersion}/${pathSuffix}`;
}

function assertCredentials() {
  const { accessToken, phoneNumberId } = config.whatsapp;
  if (!accessToken) {
    throw new AppError(
      'WHATSAPP_ACCESS_TOKEN is not set. Add it to your .env file (Meta dashboard -> WhatsApp -> API Setup).',
      500,
      'CONFIG_MISSING',
    );
  }
  if (!phoneNumberId) {
    throw new AppError(
      'WHATSAPP_PHONE_NUMBER_ID is not set. Add it to your .env file (Meta dashboard -> WhatsApp -> API Setup).',
      500,
      'CONFIG_MISSING',
    );
  }
}

/**
 * Perform a Graph API call with a timeout and normalised error handling.
 */
async function callGraph(pathSuffix, { method = 'POST', body } = {}) {
  assertCredentials();

  const url = graphUrl(pathSuffix);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response;
  let payload;

  try {
    logger.debug(`Graph ${method} ${url}`);
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError(
        `Graph API request timed out after ${config.requestTimeoutMs}ms.`,
        504,
        'GRAPH_TIMEOUT',
      );
    }
    throw new AppError(`Could not reach the Graph API: ${error.message}`, 502, 'GRAPH_UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const graphError = payload?.error ?? {};
    throw new AppError(
      graphError.message ?? `Graph API responded with HTTP ${response.status}.`,
      response.status,
      graphError.code ? `GRAPH_${graphError.code}` : 'GRAPH_ERROR',
      {
        type: graphError.type,
        code: graphError.code,
        subcode: graphError.error_subcode,
        details: graphError.error_data?.details,
        fbtrace_id: graphError.fbtrace_id,
      },
    );
  }

  return payload;
}

/**
 * Send an already-built message payload.
 * `to` is normalised and `messaging_product` injected automatically.
 */
export async function sendMessage(message) {
  const to = normalisePhone(message.to);

  if (!isValidPhone(to)) {
    throw new AppError(
      `"${message.to}" is not a valid recipient. Use the full international number, e.g. 919876543210.`,
      400,
      'INVALID_RECIPIENT',
    );
  }

  const body = { messaging_product: MESSAGING_PRODUCT, recipient_type: 'individual', ...message, to };
  const result = await callGraph(`${config.whatsapp.phoneNumberId}/messages`, { method: 'POST', body });

  const messageId = result?.messages?.[0]?.id;
  logger.info(`Sent ${message.type ?? 'message'} to +${to} (id: ${messageId ?? 'unknown'})`);

  return { ...result, messageId, to };
}

/** Plain text message. */
export function sendText(to, body, { previewUrl = false, replyTo } = {}) {
  return sendMessage({
    to,
    type: 'text',
    text: { preview_url: Boolean(previewUrl), body: String(body ?? '') },
    ...(replyTo ? { context: { message_id: replyTo } } : {}),
  });
}

/**
 * Template message - the ONLY thing you may send outside the 24h customer
 * service window. "hello_world" is pre-approved on every test number.
 */
export function sendTemplate(to, name, languageCode = 'en_US', components = []) {
  return sendMessage({
    to,
    type: 'template',
    template: {
      name,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  });
}

/** Image by public URL (`link`) or by uploaded media id (`id`). */
export function sendImage(to, { link, id, caption } = {}) {
  if (!link && !id) throw new AppError('Provide either an image "link" or a media "id".', 400, 'BAD_REQUEST');
  return sendMessage({ to, type: 'image', image: { ...(id ? { id } : { link }), ...(caption ? { caption } : {}) } });
}

/** Document by public URL (`link`) or media id (`id`). */
export function sendDocument(to, { link, id, caption, filename } = {}) {
  if (!link && !id) throw new AppError('Provide either a document "link" or a media "id".', 400, 'BAD_REQUEST');
  return sendMessage({
    to,
    type: 'document',
    document: {
      ...(id ? { id } : { link }),
      ...(caption ? { caption } : {}),
      ...(filename ? { filename } : {}),
    },
  });
}

/** Up to 3 reply buttons. `buttons` is a list of { id, title } or plain strings. */
export function sendButtons(to, bodyText, buttons = [], { header, footer } = {}) {
  const normalised = buttons.slice(0, 3).map((button, index) => ({
    type: 'reply',
    reply: {
      id: typeof button === 'string' ? `btn_${index + 1}` : String(button.id ?? `btn_${index + 1}`),
      title: String(typeof button === 'string' ? button : button.title).slice(0, 20),
    },
  }));

  if (!normalised.length) {
    throw new AppError('At least one button is required.', 400, 'BAD_REQUEST');
  }

  return sendMessage({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header ? { header: { type: 'text', text: header } } : {}),
      body: { text: String(bodyText) },
      ...(footer ? { footer: { text: footer } } : {}),
      action: { buttons: normalised },
    },
  });
}

/** React to a message with a single emoji (empty string removes the reaction). */
export function sendReaction(to, messageId, emoji) {
  return sendMessage({ to, type: 'reaction', reaction: { message_id: messageId, emoji } });
}

/** Blue ticks for an inbound message. */
export async function markAsRead(messageId) {
  const body = { messaging_product: MESSAGING_PRODUCT, status: 'read', message_id: messageId };
  const result = await callGraph(`${config.whatsapp.phoneNumberId}/messages`, { method: 'POST', body });
  logger.debug(`Marked ${messageId} as read`);
  return result;
}

/** Sanity check that the configured phone number id + token actually work. */
export function getPhoneNumberProfile() {
  return callGraph(
    `${config.whatsapp.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,platform_type`,
    { method: 'GET' },
  );
}

export default {
  sendMessage,
  sendText,
  sendTemplate,
  sendImage,
  sendDocument,
  sendButtons,
  sendReaction,
  markAsRead,
  getPhoneNumberProfile,
};
