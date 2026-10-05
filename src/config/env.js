/**
 * Central configuration.
 * Everything the app needs is read from process.env exactly once, here.
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of the project root. */
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

const toBool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : TRUTHY.has(String(value).trim().toLowerCase());

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(value ?? '').trim() !== '' ? parsed : fallback;
};

const toPath = (value, fallback) => {
  const raw = (value ?? '').trim() || fallback;
  return raw.startsWith('/') ? raw : `/${raw}`;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 3000),
  host: process.env.HOST ?? '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  webhookPath: toPath(process.env.WEBHOOK_PATH, '/webhook'),
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 15000),

  whatsapp: {
    graphBaseUrl: process.env.GRAPH_BASE_URL ?? 'https://graph.facebook.com',
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    verifySignature: toBool(process.env.VERIFY_SIGNATURE, true),
  },

  behaviour: {
    autoReply: toBool(process.env.AUTO_REPLY, false),
    autoReplyText: process.env.AUTO_REPLY_TEXT ?? 'Thanks! Your message was received by WAP_INT.',
    markAsRead: toBool(process.env.MARK_AS_READ, false),
  },

  tunnel: {
    provider: (process.env.TUNNEL_PROVIDER ?? 'cloudflared').toLowerCase(),
    ngrokDomain: process.env.NGROK_DOMAIN ?? '',
  },
};

/**
 * Inspect the configuration.
 * `errors` block startup, `warnings` only degrade part of the functionality.
 */
export function inspectConfig() {
  const errors = [];
  const warnings = [];
  const { whatsapp } = config;

  if (!whatsapp.verifyToken) {
    errors.push('WHATSAPP_VERIFY_TOKEN is missing - Meta cannot verify the webhook without it.');
  } else if (whatsapp.verifyToken === 'change-me-to-a-random-string') {
    warnings.push('WHATSAPP_VERIFY_TOKEN still holds the example value - replace it with a random string.');
  }

  if (!whatsapp.accessToken) {
    warnings.push('WHATSAPP_ACCESS_TOKEN is missing - inbound messages still work, sending will fail.');
  }
  if (!whatsapp.phoneNumberId) {
    warnings.push('WHATSAPP_PHONE_NUMBER_ID is missing - sending will fail.');
  }
  if (whatsapp.verifySignature && !whatsapp.appSecret) {
    warnings.push(
      'WHATSAPP_APP_SECRET is missing while VERIFY_SIGNATURE=true - inbound payloads are accepted unverified.',
    );
  }
  if (!whatsapp.verifySignature) {
    warnings.push('VERIFY_SIGNATURE=false - webhook signatures are NOT checked. Never do this in production.');
  }

  return { errors, warnings, ok: errors.length === 0 };
}

/** Values that are safe to print to the console. */
export function redactedConfig() {
  const mask = (value) =>
    value ? `${String(value).slice(0, 4)}...(${String(value).length} chars)` : '(not set)';

  return {
    env: config.env,
    port: config.port,
    webhookPath: config.webhookPath,
    apiVersion: config.whatsapp.apiVersion,
    phoneNumberId: config.whatsapp.phoneNumberId || '(not set)',
    businessAccountId: config.whatsapp.businessAccountId || '(not set)',
    accessToken: mask(config.whatsapp.accessToken),
    verifyToken: mask(config.whatsapp.verifyToken),
    appSecret: mask(config.whatsapp.appSecret),
    verifySignature: config.whatsapp.verifySignature,
    autoReply: config.behaviour.autoReply,
    markAsRead: config.behaviour.markAsRead,
  };
}

export default config;
