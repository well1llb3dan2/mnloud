import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['customer', 'manager'],
    required: true,
  },
  endpoint: {
    type: String,
    required: true,
    unique: true,
  },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  portal: {
    type: String,
    enum: ['customer', 'manager'],
    required: true,
  },
  userAgent: {
    type: String,
  },
}, {
  timestamps: true,
});

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
