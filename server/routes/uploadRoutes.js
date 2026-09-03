import { Router } from 'express';
import { getPresignedUrl } from '../controllers/uploadController.js';

const router = Router();

/**
 * File upload routes placeholder.
 * Future AWS Integration: AWS S3 Pre-signed URL generation.
 */
router.post('/presign', getPresignedUrl);

export default router;
