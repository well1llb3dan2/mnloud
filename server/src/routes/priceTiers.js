import express from 'express';
import { body } from 'express-validator';
import { authenticate, managerOnly, handleValidation } from '../middleware/index.js';
import {
  getPriceTiers,
  getAllPriceTiers,
  createPriceTier,
  updatePriceTier,
  deletePriceTier,
} from '../controllers/priceTierController.js';

const router = express.Router();

// Public route - get active tiers
router.get('/', getPriceTiers);

// Protected routes (manager only)
router.use(authenticate, managerOnly);

// Get all tiers including inactive
router.get('/all', getAllPriceTiers);

// Create tier
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tier name required'),
    body('prices.3.5g').isNumeric().withMessage('Price for 3.5g required'),
    body('prices.7g').isNumeric().withMessage('Price for 7g required'),
    body('prices.14g').isNumeric().withMessage('Price for 14g required'),
    body('prices.28g').isNumeric().withMessage('Price for 28g required'),
  ],
  handleValidation,
  createPriceTier
);

// Update tier
router.patch('/:id', updatePriceTier);

// Delete tier
router.delete('/:id', deletePriceTier);

export default router;
