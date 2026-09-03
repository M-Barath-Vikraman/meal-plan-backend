import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { getFoods, createFood, updateFood, deleteFood } from '../controllers/foodController.js';

const router = Router();

// Protect all food routes with authentication middleware
router.use(requireAuth);

router.get('/', getFoods);
router.post('/', createFood);
router.put('/:id', updateFood);
router.delete('/:id', deleteFood);

export default router;
