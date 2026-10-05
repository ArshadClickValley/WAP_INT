#!/usr/bin/env node
/**
 * Console sender - talks to the Cloud API directly, no running server needed.
 *
 *   npm run send -- --to 919876543210 --text "Hello from WAP_INT"
 *   npm run send -- --to 919876543210 --template hello_world --lang en_US
 *   npm run send -- --to 919876543210 --image https://example.com/cat.png --caption "Hi"
 *   npm run send -- --to 919876543210 --buttons "Yes,No,Later" --text "Coming?"
 *   npm run send -- --profile
 */
import { logger } from '../utils/logger.js';
import * as whatsapp from '../services/whatsapp.service.js';
import { prettyPhone } from '../utils/phone.js';

const paint = logger.colour;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`
${paint('bold', 'Usage')}: npm run send -- --to <number> [options]

${paint('bold', 'Options')}
  --to <number>        Recipient in international format, e.g. 919876543210   ${paint('dim', '(required)')}
  --text <message>     Plain text body
  --template <name>    Template name (e.g. hello_world)
  --lang <code>        Template language code                       ${paint('dim', 'default: en_US')}
  --image <url>        Public image URL
  --document <url>     Public document URL
  --caption <text>     Caption for image/document
  --buttons "a,b,c"    Up to 3 reply buttons (needs --text as the body)
  --preview            Enable link preview for text messages
  --reply-to <id>      Quote an earlier message by id
  --profile            Print the sender profile and exit (credential check)
  --help               Show this help

${paint('bold', 'Examples')}
  npm run send -- --to 919876543210 --text "Hello there"
  npm run send -- --to 919876543210 --template hello_world
  npm run send -- --profile
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    usage();
    process.exit(0);
  }

  if (args.profile) {
    const profile = await whatsapp.getPhoneNumberProfile();
    logger.info('Sender profile:');
    console.dir(profile, { depth: 4, colors: true });
    return;
  }

  if (!args.to) {
    logger.error('--to is required.');
    usage();
    process.exit(1);
  }

  let result;

  if (args.template) {
    result = await whatsapp.sendTemplate(args.to, String(args.template), String(args.lang ?? 'en_US'));
  } else if (args.image) {
    result = await whatsapp.sendImage(args.to, { link: String(args.image), caption: args.caption });
  } else if (args.document) {
    result = await whatsapp.sendDocument(args.to, { link: String(args.document), caption: args.caption });
  } else if (args.buttons) {
    if (!args.text) throw new Error('--buttons also needs --text for the message body.');
    const buttons = String(args.buttons)
      .split(',')
      .map((title) => title.trim())
      .filter(Boolean);
    result = await whatsapp.sendButtons(args.to, String(args.text), buttons);
  } else if (args.text) {
    result = await whatsapp.sendText(args.to, String(args.text), {
      previewUrl: Boolean(args.preview),
      replyTo: args['reply-to'],
    });
  } else {
    logger.error('Nothing to send. Pass --text, --template, --image, --document or --buttons.');
    usage();
    process.exit(1);
  }

  console.log('');
  console.log(paint('green', '  MESSAGE ACCEPTED BY WHATSAPP'));
  console.log(`  To         : ${prettyPhone(result.to)}`);
  console.log(`  Message id : ${result.messageId}`);
  console.log(paint('dim', '  (delivery status arrives on the webhook, if the server is running)'));
  console.log('');
}

main().catch((error) => {
  logger.error(error.message);
  if (error.details) console.dir(error.details, { depth: 4, colors: true });
  if (error.code === 'CONFIG_MISSING') {
    logger.info('Fill WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your .env file.');
  }
  process.exit(1);
});
