/** Express application: two APIs, no UI. */
import express from 'express';
import { config } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import webhookRoutes from './routes/webhook.routes.js';
import messageRoutes from './routes/message.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestLogger);

  // The raw body is kept so verifySignature can HMAC the exact bytes Meta sent.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buffer) => {
        req.rawBody = buffer;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'wap-int',
        env: config.env,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Small index so hitting the root explains what exists.
  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'wap-int - WhatsApp Cloud API integration',
        endpoints: {
          health: 'GET /health',
          webhookVerify: `GET ${config.webhookPath}`,
          webhookReceive: `POST ${config.webhookPath}`,
          sendMessage: 'POST /api/messages',
          sendText: 'POST /api/messages/text',
          sendTemplate: 'POST /api/messages/template',
          sendRaw: 'POST /api/messages/raw',
          recent: 'GET /api/messages/recent',
          stats: 'GET /api/stats',
          profile: 'GET /api/profile',
        },
      },
    });
  });

  // API #1 - inbound
  app.use(config.webhookPath, webhookRoutes);

  // API #2 - outbound
  app.use('/api', messageRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
