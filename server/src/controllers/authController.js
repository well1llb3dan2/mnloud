import { User, Invite } from '../models/index.js';
import crypto from 'crypto';
import config from '../config/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailLower = String(email || '').toLowerCase().trim();
    const emailHash = crypto.createHash('sha256').update(emailLower).digest('hex');

    let user = await User.findOne({ emailHash });
    if (!user) {
      user = await User.findOne({ email: emailLower });
      if (user && !user.emailHash) {
        user.email = emailLower;
        await user.save();
      }
    }
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    
    // Save refresh token
    user.refreshTokens.push({ token: refreshToken });
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Register (invite only)
export const register = async (req, res) => {
  try {
    const { email, password, nickname, inviteCode } = req.body;
    const emailLower = String(email || '').toLowerCase().trim();
    const emailHash = crypto.createHash('sha256').update(emailLower).digest('hex');
    const displayName = (nickname || '').trim() || emailLower.split('@')[0];

    const invite = await Invite.findOne({ code: inviteCode });

    if (!invite || !invite.isValid()) {
      return res.status(400).json({ message: 'Invalid or expired invite code' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      $or: [{ emailHash }, { email: emailLower }],
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    // Create user
    const user = new User({
      email: emailLower,
      password,
      nickname: displayName,
      firstName: displayName,
      role: invite.role,
    });
    
    await user.save();

    invite.isUsed = true;
    invite.usedBy = user._id;
    invite.usedAt = new Date();
    await invite.save();
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    
    // Save refresh token
    user.refreshTokens.push({ token: refreshToken });
    await user.save();
    
    res.status(201).json({
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Refresh token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Refresh token required' });
    }
    
    const decoded = verifyRefreshToken(token);
    
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    
    const user = await User.findOne({
      _id: decoded.userId,
      'refreshTokens.token': token,
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);
    
    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
    user.refreshTokens.push({ token: newRefreshToken });
    await user.save();
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error during token refresh' });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (token && req.user) {
      // Remove the refresh token
      req.user.refreshTokens = req.user.refreshTokens.filter(rt => rt.token !== token);
      await req.user.save();
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

// Get current user
export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, nickname, muteNotifications } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (nickname !== undefined) user.nickname = nickname;
    if (muteNotifications !== undefined) user.muteNotifications = muteNotifications;
    
    await user.save();
    
    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

// Update public key (E2EE)
export const updatePublicKey = async (req, res) => {
  try {
    const {
      publicKey,
      keyId,
      encryptedPrivateKey,
      encryptedPrivateKeyNonce,
      encryptedPrivateKeySalt,
      encryptedPrivateKeyAlgo,
    } = req.body;

    if (!publicKey || !keyId) {
      return res.status(400).json({ message: 'publicKey and keyId are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.publicKey = publicKey;
    user.publicKeyId = keyId;
    user.publicKeyUpdatedAt = new Date();
    if (encryptedPrivateKey) {
      user.encryptedPrivateKey = encryptedPrivateKey;
      user.encryptedPrivateKeyNonce = encryptedPrivateKeyNonce;
      user.encryptedPrivateKeySalt = encryptedPrivateKeySalt;
      user.encryptedPrivateKeyAlgo = encryptedPrivateKeyAlgo || 'secretbox-pbkdf2';
    }
    await user.save();

    res.json({
      userId: user._id,
      publicKey: user.publicKey,
      keyId: user.publicKeyId,
      updatedAt: user.publicKeyUpdatedAt,
    });
  } catch (error) {
    console.error('Update public key error:', error);
    res.status(500).json({ message: 'Server error updating public key' });
  }
};

// Get encrypted private key for current user
export const getPrivateKey = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      'publicKey publicKeyId encryptedPrivateKey encryptedPrivateKeyNonce encryptedPrivateKeySalt encryptedPrivateKeyAlgo'
    );

    if (!user || !user.encryptedPrivateKey) {
      return res.status(404).json({ message: 'Encrypted private key not found' });
    }

    res.json({
      userId: user._id,
      publicKey: user.publicKey,
      keyId: user.publicKeyId,
      encryptedPrivateKey: user.encryptedPrivateKey,
      encryptedPrivateKeyNonce: user.encryptedPrivateKeyNonce,
      encryptedPrivateKeySalt: user.encryptedPrivateKeySalt,
      encryptedPrivateKeyAlgo: user.encryptedPrivateKeyAlgo,
    });
  } catch (error) {
    console.error('Get private key error:', error);
    res.status(500).json({ message: 'Server error fetching private key' });
  }
};

// Get public key for a user
export const getPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('publicKey publicKeyId role');
    if (!user || !user.publicKey) {
      return res.status(404).json({ message: 'Public key not found' });
    }

    res.json({
      userId: user._id,
      publicKey: user.publicKey,
      keyId: user.publicKeyId,
      role: user.role,
    });
  } catch (error) {
    console.error('Get public key error:', error);
    res.status(500).json({ message: 'Server error fetching public key' });
  }
};

// List public keys by role
export const listPublicKeys = async (req, res) => {
  try {
    const { role } = req.query;

    const query = { publicKey: { $exists: true, $ne: null } };
    if (role) {
      query.role = role;
    }

    const users = await User.find(query).select('publicKey publicKeyId role nickname firstName lastName');

    res.json({
      keys: users.map((user) => ({
        userId: user._id,
        publicKey: user.publicKey,
        keyId: user.publicKeyId,
        role: user.role,
        displayName: user.nickname || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      })),
    });
  } catch (error) {
    console.error('List public keys error:', error);
    res.status(500).json({ message: 'Server error fetching public keys' });
  }
};

// Validate invite code (for registration form)
export const validateInvite = async (req, res) => {
  try {
    const { code } = req.params;

    const invite = await Invite.findOne({ code });

    if (!invite || !invite.isValid()) {
      return res.status(400).json({
        valid: false,
        message: 'Invalid or expired invite code',
      });
    }

    res.json({
      valid: true,
      role: invite.role,
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    res.status(500).json({ message: 'Server error validating invite' });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    // Invalidate all refresh tokens on password change
    user.refreshTokens = [];
    await user.save();
    
    // Generate new tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshTokens.push({ token: refreshToken });
    await user.save();
    
    res.json({
      message: 'Password changed successfully',
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

// Forgot password - send reset email
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const emailLower = String(email || '').toLowerCase().trim();
    const emailHash = crypto.createHash('sha256').update(emailLower).digest('hex');

    // Always return success to prevent email enumeration
    const successMsg = 'If an account with that email exists, a reset link has been sent.';

    const user = await User.findOne({ emailHash });
    if (!user || user.role !== 'customer' || !user.isActive) {
      return res.json({ message: successMsg });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Build reset URL
    const portalUrl = config.cors.customerPortalUrl || 'https://mnloud.com';
    const resetUrl = `${portalUrl}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(emailLower, resetUrl);

    res.json({ message: successMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error processing request' });
  }
};

// Reset password with token
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password' });
  }
};

