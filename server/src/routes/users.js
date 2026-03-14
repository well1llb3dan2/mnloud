import express from 'express';
import { body } from 'express-validator';
import { authenticate, managerOnly, handleValidation } from '../middleware/index.js';
import {
  createInvite,
  getInvites,
  deleteInvite,
  getCustomers,
  getManagers,
  toggleUserStatus,
  toggleMuteNotifications,
} from '../controllers/userController.js';

const router = express.Router();

// All routes require authentication and manager role
router.use(authenticate, managerOnly);

// Invites
router.post(
  '/invites',
  [
    body('role').optional().isIn(['customer', 'manager']).withMessage('Invalid role'),
  ],
  handleValidation,
  createInvite
);

router.get('/invites', getInvites);
router.delete('/invites/:id', deleteInvite);

// Users
router.get('/customers', getCustomers);
router.get('/managers', getManagers);
router.patch('/users/:id/toggle-status', toggleUserStatus);
router.patch('/users/:id/toggle-mute', toggleMuteNotifications);

export default router;
