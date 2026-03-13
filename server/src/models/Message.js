import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['customer', 'manager'],
    required: true,
  },
  content: {
    type: String,
    trim: true,
  },
  encrypted: {
    cipherText: String,
    nonce: String,
    algo: {
      type: String,
      default: 'secretbox',
    },
  },
  encryptedKeys: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      keyId: String,
      sealedKey: String,
      nonce: String,
      epk: String,
    },
  ],
  encryptedAttachments: [
    {
      filename: String,
      mimeType: String,
      size: Number,
      cipherText: String,
      nonce: String,
      algo: {
        type: String,
        default: 'secretbox',
      },
    },
  ],
  messageType: {
    type: String,
    enum: ['text', 'order', 'system', 'image'],
    default: 'text',
  },
  // For order messages
  orderData: {
    items: [{
      productType: String, // 'bulk', 'packaged', 'concentrate', 'edible'
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      strain: String,
      weight: String,
      quantity: Number,
      priceEach: Number,
      priceTotal: Number,
    }],
    orderTotal: Number,
  },
  // Read receipts
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
  deliveredAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
messageSchema.index({ conversation: 1, createdAt: -1 });

const conversationSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One conversation per customer
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastMessageAt: {
    type: Date,
  },
  // Track unread count for managers
  unreadCount: {
    type: Number,
    default: 0,
  },
  // Track if customer has unread messages
  customerUnreadCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index for sorting by last message
conversationSchema.index({ lastMessageAt: -1 });

const Message = mongoose.model('Message', messageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

export { Message, Conversation };
