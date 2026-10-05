import { Router } from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/webhook.controller.js';
import { verifySignature } from '../middlewares/verifySignature.js';

const router = Router();

// Meta's subscription handshake.
router.get('/', verifyWebhook);

// Inbound messages + delivery statuses (signature-checked).
router.post('/', verifySignature, receiveWebhook);

export default router;
