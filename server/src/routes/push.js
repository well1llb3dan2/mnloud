import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getVapidKey, subscribe, unsubscribe } from '../controllers/pushController.js';

const router = express.Router();

router.get('/vapid-public-key', authenticate, getVapidKey);
router.post('/subscribe', authenticate, subscribe);
router.post('/unsubscribe', authenticate, unsubscribe);

export default router;
