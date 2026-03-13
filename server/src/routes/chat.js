import express from 'express';
import { authenticate } from '../middleware/index.js';
import {
  getOrCreateConversation,
  getConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
} from '../controllers/chatController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer: Get or create their conversation
router.get('/my-conversation', getOrCreateConversation);

// Manager: Get all conversations
router.get('/conversations', getConversations);

// Get single conversation by ID
router.get('/conversations/:conversationId', getConversation);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send message (REST fallback)
router.post('/conversations/:conversationId/messages', sendMessage);

// Mark messages as read
router.post('/conversations/:conversationId/read', markAsRead);

export default router;
