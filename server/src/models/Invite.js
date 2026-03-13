import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const inviteSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },
  role: {
    type: String,
    enum: ['customer', 'manager'],
    default: 'customer',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  usedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },
}, {
  timestamps: true,
});

// Check if invite is valid
inviteSchema.methods.isValid = function() {
  return !this.isUsed && new Date() < this.expiresAt;
};

// Index for automatic expiry cleanup
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Invite = mongoose.model('Invite', inviteSchema);

export default Invite;
