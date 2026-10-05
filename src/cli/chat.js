#!/usr/bin/env node
/**
 * Interactive console chat.
 *
 *   npm run chat                 -> asks for the recipient, then sends every line you type
 *   npm run chat -- 919876543210 -> skips the prompt
 *
 * Commands inside the session:
 *   /to <number>       switch recipient
 *   /template <name>   send a template (default language en_US)
 *   /profile           print the sender profile
 *   /help              list commands
 *   /quit              exit
 */
import readline from 'node:readline';
import { logger } from '../utils/logger.js';
import * as whatsapp from '../services/whatsapp.service.js';
import { isValidPhone, normalisePhone, prettyPhone } from '../utils/phone.js';

const paint = logger.colour;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

let recipient = normalisePhone(process.argv[2] ?? '');

function help() {
  console.log(`
${paint('bold', 'Commands')}
  /to <number>        switch recipient
  /template <name>    send an approved template (language en_US)
  /profile            show the configured sender
  /help               this help
  /quit               exit
${paint('dim', 'Anything else you type is sent as a plain text message.')}
`);
}

async function handleCommand(line) {
  const [command, ...rest] = line.slice(1).split(' ');
  const argument = rest.join(' ').trim();

  switch (command.toLowerCase()) {
    case 'to': {
      if (!isValidPhone(argument)) {
        logger.warn('Give a full international number, e.g. /to 919876543210');
        return true;
      }
      recipient = normalisePhone(argument);
      logger.info(`Recipient is now ${prettyPhone(recipient)}`);
      return true;
    }
    case 'template': {
      if (!argument) {
        logger.warn('Usage: /template hello_world');
        return true;
      }
      const result = await whatsapp.sendTemplate(recipient, argument);
      logger.info(`Template sent (id: ${result.messageId})`);
      return true;
    }
    case 'profile': {
      const profile = await whatsapp.getPhoneNumberProfile();
      console.dir(profile, { depth: 4, colors: true });
      return true;
    }
    case 'help':
      help();
      return true;
    case 'quit':
    case 'exit':
      return false;
    default:
      logger.warn(`Unknown command "/${command}". Type /help.`);
      return true;
  }
}

async function main() {
  logger.banner('WAP_INT - interactive console chat', [
    paint('dim', 'Type a message and press Enter to send it. /help for commands, /quit to exit.'),
  ]);

  while (!isValidPhone(recipient)) {
    const answer = await ask(paint('cyan', 'Recipient number (e.g. 919876543210): '));
    if (!answer.trim()) {
      rl.close();
      return;
    }
    recipient = normalisePhone(answer);
    if (!isValidPhone(recipient)) logger.warn('That does not look like an international number. Try again.');
  }

  logger.info(`Chatting with ${prettyPhone(recipient)}`);
  logger.warn('Reminder: outside the 24h customer service window only templates are delivered.');

  for (;;) {
    const line = (await ask(paint('bold', `${prettyPhone(recipient)} > `))).trim();

    if (!line) continue;

    try {
      if (line.startsWith('/')) {
        const shouldContinue = await handleCommand(line);
        if (!shouldContinue) break;
        continue;
      }

      const result = await whatsapp.sendText(recipient, line);
      console.log(paint('dim', `  sent (id: ${result.messageId})`));
    } catch (error) {
      logger.error(error.message);
      if (error.details) console.dir(error.details, { depth: 4, colors: true });
    }
  }

  rl.close();
  logger.info('Bye.');
}

main().catch((error) => {
  logger.error(error.message);
  rl.close();
  process.exit(1);
});
