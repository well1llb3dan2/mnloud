import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productType: {
    type: String,
    enum: ['flower', 'disposable', 'concentrate', 'edible'],
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  brand: String,
  strain: String,
  strainType: String,
  weight: String,
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  priceEach: {
    type: Number,
    required: true,
  },
  priceTotal: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  notes: {
    type: String,
    trim: true,
  },
  // Link to the message that contains this order
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
}, {
  timestamps: true,
});

// Index for customer order history
orderSchema.index({ customer: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
