import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import {
  getGoogleAuthUrl,
  getGoogleStatus,
  handleGoogleCallback,
  syncShopping,
} from '../controllers/googleController.js';

const router = Router();

// Protect all Google API routes with authentication middleware
router.use(requireAuth);

router.get('/auth-url', getGoogleAuthUrl);
router.get('/status', getGoogleStatus);
router.post('/callback', handleGoogleCallback);
router.post('/sync-shopping', syncShopping);

export default router;
