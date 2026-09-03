import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = Router();

/**
 * @route GET /api/health
 * @desc  System health check endpoint for AWS Application Load Balancer (ALB) Target Group.
 */
router.get('/', getHealthStatus);

export default router;
