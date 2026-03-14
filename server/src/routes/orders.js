import express from 'express';
import { body } from 'express-validator';
import { authenticate, managerOnly, handleValidation } from '../middleware/index.js';
import {
  getCustomerOrders,
  getAllOrders,
  getOrder,
  getOrderByMessage,
  updateOrderStatus,
} from '../controllers/orderController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.get('/my-orders', getCustomerOrders);

// Manager: Get order by message id
router.get('/by-message/:messageId', managerOnly, getOrderByMessage);

// Get single order (customer can view own, manager can view all)
router.get('/:id', getOrder);

// Manager routes
router.get('/', managerOnly, getAllOrders);

router.patch(
  '/:id',
  managerOnly,
  [
    body('status')
      .optional()
      .isIn(['pending', 'completed'])
      .withMessage('Invalid status'),
  ],
  handleValidation,
  updateOrderStatus
);

export default router;
