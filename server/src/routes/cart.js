import { Router } from 'express';
import { authenticate, customerOnly } from '../middleware/index.js';
import {
  getCart,
  syncCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
} from '../controllers/cartController.js';

const router = Router();

router.get('/', authenticate, customerOnly, getCart);
router.put('/', authenticate, customerOnly, syncCart);
router.post('/items', authenticate, customerOnly, addCartItem);
router.patch('/items/:index', authenticate, customerOnly, updateCartItem);
router.delete('/items/:index', authenticate, customerOnly, removeCartItem);
router.delete('/', authenticate, customerOnly, clearCart);
router.post('/validate', authenticate, customerOnly, validateCart);

export default router;
