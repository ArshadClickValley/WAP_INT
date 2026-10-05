/**
 * Entry point: boot the HTTP server, print a console dashboard, shut down cleanly.
 *
 *   npm start     - run once
 *   npm run dev   - run with auto-restart on file changes
 */
import { config, inspectConfig, redactedConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';

const paint = logger.colour;

function printStartupScreen() {
  const base = `http://localhost:${config.port}`;

  logger.banner('WAP_INT - WhatsApp Cloud API integration (console mode)', [
    `${paint('bold', 'Environment')} : ${config.env}`,
    `${paint('bold', 'Listening')}   : ${base}`,
    '',
    paint('bold', 'API #1 - webhook (register this with Meta)'),
    `  GET    ${base}${config.webhookPath}      verification handshake`,
    `  POST   ${base}${config.webhookPath}      inbound messages + statuses`,
    '',
    paint('bold', 'API #2 - send messages'),
    `  POST   ${base}/api/messages           any type (text/template/image/...)`,
    `  POST   ${base}/api/messages/text      shorthand for plain text`,
    `  POST   ${base}/api/messages/template  shorthand for a template`,
    `  POST   ${base}/api/messages/raw       forward a raw Graph API payload`,
    '',
    paint('bold', 'Diagnostics'),
    `  GET    ${base}/health                 liveness`,
    `  GET    ${base}/api/stats              counters since startup`,
    `  GET    ${base}/api/messages/recent    last inbound messages`,
    `  GET    ${base}/api/profile            verify token + phone number id`,
    '',
    paint('dim', 'Expose this port with:  npm run tunnel'),
    paint('dim', 'Waiting for messages... (Ctrl+C to stop)'),
  ]);
}

function main() {
  const { errors, warnings } = inspectConfig();

  logger.json('Effective configuration', redactedConfig());

  for (const warning of warnings) logger.warn(warning);

  if (errors.length) {
    for (const error of errors) logger.error(error);
    logger.error('Startup aborted. Copy .env.example to .env and fill in the missing values.');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, printStartupScreen);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Change PORT in .env or stop the other process.`);
    } else {
      logger.error(`Server error: ${error.message}`);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received - shutting down.`);
    server.close(() => {
      logger.info('Server closed. Bye.');
      process.exit(0);
    });
    // Do not hang forever on lingering sockets.
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.message : reason}`);
  });
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.debug(error.stack);
    process.exit(1);
  });
}

main();
