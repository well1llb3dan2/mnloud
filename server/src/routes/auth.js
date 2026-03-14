import express from 'express';
import { body } from 'express-validator';
import { handleValidation } from '../middleware/index.js';
import { authenticate } from '../middleware/auth.js';
import {
  login,
  register,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
  validateInvite,
  updatePublicKey,
  getPublicKey,
  getPrivateKey,
  listPublicKeys,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';

const router = express.Router();

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  handleValidation,
  login
);

// Register (invite only)
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('nickname').optional().trim(),
    body('inviteCode').notEmpty().withMessage('Invite code required'),
  ],
  handleValidation,
  register
);

// Validate invite code
router.get('/invite/:code', validateInvite);

// Forgot password
router.post(
  '/forgot-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  ],
  handleValidation,
  forgotPassword
);

// Reset password with token
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  resetPassword
);

// Refresh token
router.post('/refresh', refreshToken);

// Protected routes
router.use(authenticate);

// Logout
router.post('/logout', logout);

// Get current user
router.get('/me', getMe);

// Update profile
router.patch(
  '/profile',
  [
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('nickname').optional().trim(),
    body('muteNotifications').optional().isBoolean(),
  ],
  handleValidation,
  updateProfile
);

// E2EE public key management
router.put(
  '/keys',
  [
    body('publicKey').notEmpty().withMessage('publicKey is required'),
    body('keyId').notEmpty().withMessage('keyId is required'),
  ],
  handleValidation,
  updatePublicKey
);

router.get('/keys', listPublicKeys);
router.get('/keys/private', getPrivateKey);
router.get('/keys/:userId', getPublicKey);

// Change password
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  handleValidation,
  changePassword
);

export default router;
