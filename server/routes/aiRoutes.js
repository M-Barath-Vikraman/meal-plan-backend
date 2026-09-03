import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { handleAiChat } from '../controllers/aiController.js';

const router = Router();

// Protect AI chatbot route with authentication middleware
router.use(requireAuth);

router.post('/chat', handleAiChat);

export default router;
