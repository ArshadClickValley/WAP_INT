import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as controller from '../controllers/message.controller.js';

const router = Router();

router.post('/messages', asyncHandler(controller.sendMessage));
router.post('/messages/text', asyncHandler(controller.sendText));
router.post('/messages/template', asyncHandler(controller.sendTemplate));
router.post('/messages/raw', asyncHandler(controller.sendRaw));

router.get('/messages/recent', controller.recentMessages);
router.get('/stats', controller.getStats);
router.get('/profile', asyncHandler(controller.getProfile));

export default router;
