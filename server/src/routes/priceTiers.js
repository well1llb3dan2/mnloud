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
    body('prices').isArray({ min: 1 }).withMessage('At least one price point required'),
    body('prices.*.quantity').isNumeric().withMessage('Quantity must be a number'),
    body('prices.*.price').isNumeric().withMessage('Price must be a number'),
  ],
  handleValidation,
  createPriceTier
);

// Update tier
router.patch('/:id', updatePriceTier);

// Delete tier
router.delete('/:id', deletePriceTier);

export default router;
