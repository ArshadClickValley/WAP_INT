/**
 * API #2 - the outbound send API.
 *
 *   POST /api/messages            -> generic sender, switches on `type`
 *   POST /api/messages/text       -> shorthand for plain text
 *   POST /api/messages/template   -> shorthand for a template
 *   POST /api/messages/raw        -> escape hatch, forwards your exact payload
 *   GET  /api/messages/recent     -> last inbound messages held in memory
 *   GET  /api/stats               -> counters since startup
 */
import { badRequest } from '../utils/AppError.js';
import * as whatsapp from '../services/whatsapp.service.js';
import { stats, getRecentMessages } from '../services/messageHandler.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

function requireFields(body, fields) {
  const missing = fields.filter((field) => body?.[field] === undefined || body[field] === '');
  if (missing.length) {
    throw badRequest(`Missing required field(s): ${missing.join(', ')}`, { required: fields });
  }
}

/** POST /api/messages - one endpoint for every message type. */
export async function sendMessage(req, res) {
  const body = req.body ?? {};
  const type = (body.type ?? 'text').toLowerCase();
  requireFields(body, ['to']);

  let result;

  switch (type) {
    case 'text': {
      requireFields(body, ['text']);
      const text = typeof body.text === 'string' ? body.text : body.text?.body;
      if (!text) throw badRequest('"text" must be a string, or an object with a "body" property.');
      result = await whatsapp.sendText(body.to, text, {
        previewUrl: body.previewUrl ?? body.preview_url,
        replyTo: body.replyTo ?? body.reply_to,
      });
      break;
    }

    case 'template': {
      requireFields(body, ['template']);
      const template = typeof body.template === 'string' ? { name: body.template } : body.template;
      if (!template?.name) throw badRequest('"template" must be a name, or an object with a "name" property.');
      result = await whatsapp.sendTemplate(
        body.to,
        template.name,
        template.language ?? template.languageCode ?? body.languageCode ?? 'en_US',
        template.components ?? [],
      );
      break;
    }

    case 'image': {
      requireFields(body, ['image']);
      const image = typeof body.image === 'string' ? { link: body.image } : body.image;
      result = await whatsapp.sendImage(body.to, image);
      break;
    }

    case 'document': {
      requireFields(body, ['document']);
      const document = typeof body.document === 'string' ? { link: body.document } : body.document;
      result = await whatsapp.sendDocument(body.to, document);
      break;
    }

    case 'buttons':
    case 'interactive': {
      requireFields(body, ['body', 'buttons']);
      result = await whatsapp.sendButtons(body.to, body.body, body.buttons, {
        header: body.header,
        footer: body.footer,
      });
      break;
    }

    case 'reaction': {
      requireFields(body, ['messageId', 'emoji']);
      result = await whatsapp.sendReaction(body.to, body.messageId, body.emoji);
      break;
    }

    default:
      throw badRequest(`Unsupported message type "${type}".`, {
        supported: ['text', 'template', 'image', 'document', 'buttons', 'reaction'],
      });
  }

  stats.sent += 1;
  return ok(res, result, 201);
}

/** POST /api/messages/text */
export async function sendText(req, res) {
  const { to, text, message, previewUrl, replyTo } = req.body ?? {};
  requireFields({ to, text: text ?? message }, ['to', 'text']);
  const result = await whatsapp.sendText(to, text ?? message, { previewUrl, replyTo });
  stats.sent += 1;
  return ok(res, result, 201);
}

/** POST /api/messages/template */
export async function sendTemplate(req, res) {
  const { to, name, template, language, languageCode, components } = req.body ?? {};
  const templateName = name ?? template;
  requireFields({ to, name: templateName }, ['to', 'name']);
  const result = await whatsapp.sendTemplate(
    to,
    templateName,
    language ?? languageCode ?? 'en_US',
    components ?? [],
  );
  stats.sent += 1;
  return ok(res, result, 201);
}

/**
 * POST /api/messages/raw
 * Forwards the body straight to the Graph API - useful for message types this
 * project has no helper for yet.
 */
export async function sendRaw(req, res) {
  requireFields(req.body, ['to', 'type']);
  const result = await whatsapp.sendMessage(req.body);
  stats.sent += 1;
  return ok(res, result, 201);
}

/** GET /api/messages/recent?limit=20 */
export function recentMessages(req, res) {
  const limit = Number(req.query.limit ?? 20);
  return ok(res, { messages: getRecentMessages(Number.isFinite(limit) ? limit : 20) });
}

/** GET /api/stats */
export function getStats(req, res) {
  return ok(res, { ...stats, uptimeSeconds: Math.round(process.uptime()) });
}

/** GET /api/profile - verifies the token + phone number id are usable. */
export async function getProfile(req, res) {
  const profile = await whatsapp.getPhoneNumberProfile();
  return ok(res, profile);
}

export default {
  sendMessage,
  sendText,
  sendTemplate,
  sendRaw,
  recentMessages,
  getStats,
  getProfile,
};
