import { Router } from 'express';
import { getCurrentUser } from '../controllers/authController.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

/**
 * @route GET /api/auth/me
 * @desc  Fetch current verified AWS Cognito user profile.
 * @access Protected (Requires Bearer JWT token)
 */
router.get('/me', requireAuth, getCurrentUser);

export default router;
