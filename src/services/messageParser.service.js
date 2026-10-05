/**
 * Turns a raw WhatsApp webhook payload into flat, easy-to-consume events.
 *
 * A single POST can carry several entries, each with several changes, each of
 * which may contain inbound messages, delivery statuses, or errors.
 *
 * Payload shape:
 *   { object: "whatsapp_business_account",
 *     entry: [ { id, changes: [ { field: "messages", value: { ... } } ] } ] }
 */

/** Text (or a readable placeholder) for any inbound message type. */
function describeMessage(message) {
  switch (message.type) {
    case 'text':
      return message.text?.body ?? '';
    case 'button':
      return message.button?.text ?? '[button]';
    case 'interactive': {
      const interactive = message.interactive ?? {};
      if (interactive.type === 'button_reply') return interactive.button_reply?.title ?? '[button reply]';
      if (interactive.type === 'list_reply') return interactive.list_reply?.title ?? '[list reply]';
      return '[interactive]';
    }
    case 'image':
      return message.image?.caption ?? '[image]';
    case 'video':
      return message.video?.caption ?? '[video]';
    case 'document':
      return message.document?.caption ?? `[document: ${message.document?.filename ?? 'file'}]`;
    case 'audio':
      return message.audio?.voice ? '[voice note]' : '[audio]';
    case 'sticker':
      return '[sticker]';
    case 'location': {
      const location = message.location ?? {};
      return `[location: ${location.latitude}, ${location.longitude}${location.name ? ` - ${location.name}` : ''}]`;
    }
    case 'contacts':
      return `[${message.contacts?.length ?? 0} contact(s)]`;
    case 'reaction':
      return `[reacted ${message.reaction?.emoji ?? ''} to ${message.reaction?.message_id ?? '?'}]`;
    case 'order':
      return `[order: ${message.order?.product_items?.length ?? 0} item(s)]`;
    case 'system':
      return `[system: ${message.system?.body ?? ''}]`;
    case 'unsupported':
      return '[unsupported message type]';
    default:
      return `[${message.type}]`;
  }
}

/** Media id + mime type, when the message carries an attachment. */
function extractMedia(message) {
  const media = message[message.type];
  if (!media || !media.id) return undefined;
  return {
    id: media.id,
    mimeType: media.mime_type,
    sha256: media.sha256,
    filename: media.filename,
  };
}

function normaliseMessage(message, contacts, metadata) {
  const contact = contacts.find((entry) => entry.wa_id === message.from);

  return {
    id: message.id,
    from: message.from,
    profileName: contact?.profile?.name ?? null,
    type: message.type,
    text: describeMessage(message),
    timestamp: new Date(Number(message.timestamp ?? 0) * 1000).toISOString(),
    /** Id of the message this one replies to, when the user used "reply". */
    replyToId: message.context?.id ?? null,
    /** Id the business number received the message on. */
    businessPhoneNumberId: metadata?.phone_number_id ?? null,
    displayPhoneNumber: metadata?.display_phone_number ?? null,
    media: extractMedia(message),
    interactiveReplyId:
      message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? message.button?.payload ?? null,
    raw: message,
  };
}

function normaliseStatus(status, metadata) {
  return {
    id: status.id,
    recipient: status.recipient_id,
    /** sent | delivered | read | failed */
    status: status.status,
    timestamp: new Date(Number(status.timestamp ?? 0) * 1000).toISOString(),
    conversationId: status.conversation?.id ?? null,
    category: status.conversation?.origin?.type ?? null,
    pricingModel: status.pricing?.pricing_model ?? null,
    billable: status.pricing?.billable ?? null,
    errors: status.errors ?? [],
    businessPhoneNumberId: metadata?.phone_number_id ?? null,
    raw: status,
  };
}

/**
 * @returns {{ messages: object[], statuses: object[], errors: object[] }}
 */
export function parseWebhookPayload(payload) {
  const result = { messages: [], statuses: [], errors: [] };

  if (payload?.object !== 'whatsapp_business_account') {
    return result;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const metadata = value.metadata ?? {};
      const contacts = value.contacts ?? [];

      for (const message of value.messages ?? []) {
        result.messages.push(normaliseMessage(message, contacts, metadata));
      }
      for (const status of value.statuses ?? []) {
        result.statuses.push(normaliseStatus(status, metadata));
      }
      for (const error of value.errors ?? []) {
        result.errors.push(error);
      }
    }
  }

  return result;
}

export default { parseWebhookPayload };
