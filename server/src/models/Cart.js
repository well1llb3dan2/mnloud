import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
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
  strainId: mongoose.Schema.Types.ObjectId,
  strainType: String,
  strain2: String,
  strainType2: String,
  variant: String,
  variantId: mongoose.Schema.Types.ObjectId,
  weight: String,
  priceTierId: mongoose.Schema.Types.ObjectId,
  priceEach: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  unavailable: {
    type: Boolean,
    default: false,
  },
});

const cartSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [cartItemSchema],
}, {
  timestamps: true,
});

cartSchema.index({ customer: 1 });

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
