import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const getEmailKey = () => {
  const secret = process.env.EMAIL_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('EMAIL_ENCRYPTION_KEY is required for email encryption');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const hashEmail = (email) =>
  crypto.createHash('sha256').update(email).digest('hex');

const encryptEmail = (email) => {
  const key = getEmailKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(email, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return `enc:${iv.toString('base64')}:${tag}:${encrypted}`;
};

const isEncryptedEmail = (value) => typeof value === 'string' && value.startsWith('enc:');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  emailHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  nickname: {
    type: String,
    trim: true,
  },
  publicKey: {
    type: String,
  },
  publicKeyId: {
    type: String,
  },
  publicKeyUpdatedAt: {
    type: Date,
  },
  encryptedPrivateKey: {
    type: String,
  },
  encryptedPrivateKeyNonce: {
    type: String,
  },
  encryptedPrivateKeySalt: {
    type: String,
  },
  encryptedPrivateKeyAlgo: {
    type: String,
  },
  role: {
    type: String,
    enum: ['customer', 'manager'],
    default: 'customer',
  },
  firstName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  telegramUsername: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 7 * 24 * 60 * 60, // 7 days
    },
  }],
  lastLogin: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Normalize + encrypt email before validation
userSchema.pre('validate', function(next) {
  const shouldUpdateEmail =
    this.isModified('email') ||
    (!this.emailHash && this.email && !isEncryptedEmail(this.email));

  if (shouldUpdateEmail) {
    const rawEmail = String(this.email || '').toLowerCase().trim();
    if (!rawEmail) {
      return next(new Error('Email is required'));
    }
    if (!this.nickname) {
      this.nickname = rawEmail.split('@')[0];
    }
    this.emailHash = hashEmail(rawEmail);
    if (!isEncryptedEmail(this.email)) {
      try {
        this.email = encryptEmail(rawEmail);
      } catch (error) {
        return next(error);
      }
    }
  }

  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.refreshTokens;
  delete user.email;
  delete user.emailHash;
  return user;
};

const User = mongoose.model('User', userSchema);

export default User;
