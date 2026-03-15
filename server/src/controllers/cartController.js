import Cart from '../models/Cart.js';
import {
  Flower,
  ConcentrateBase,
  ConcentrateStrain,
  DisposableBase,
  DisposableStrain,
  Edible,
} from '../models/index.js';
import PriceTier from '../models/PriceTier.js';

// Validate a single cart item against the database
const validateCartItem = async (item) => {
  const { productType, productId, strainId, variantId, weight } = item;

  if (productType === 'flower') {
    const flower = await Flower.findById(productId).populate('priceTier');
    if (!flower || !flower.isActive) return { unavailable: true, reason: 'product' };
    if (weight && flower.priceTier) {
      const tier = flower.priceTier.prices.find(
        (p) => `${p.quantity}g` === weight
      );
      if (!tier) return { unavailable: true, reason: 'tier' };
      return { unavailable: false, priceEach: tier.price };
    }
    return { unavailable: false };
  }

  if (productType === 'concentrate') {
    const base = await ConcentrateBase.findById(productId);
    if (!base || !base.isActive) return { unavailable: true, reason: 'product' };
    if (strainId) {
      const strain = await ConcentrateStrain.findById(strainId);
      if (!strain || !strain.isActive) return { unavailable: true, reason: 'variant' };
    }
    return { unavailable: false, priceEach: base.price };
  }

  if (productType === 'disposable') {
    const base = await DisposableBase.findById(productId);
    if (!base || !base.isActive) return { unavailable: true, reason: 'product' };
    if (strainId) {
      const strain = await DisposableStrain.findById(strainId);
      if (!strain || !strain.isActive) return { unavailable: true, reason: 'variant' };
    }
    return { unavailable: false, priceEach: base.price };
  }

  if (productType === 'edible') {
    const edible = await Edible.findById(productId);
    if (!edible || !edible.isActive) return { unavailable: true, reason: 'product' };
    if (variantId) {
      const variant = edible.variants.id(variantId);
      if (!variant || variant.isActive === false) return { unavailable: true, reason: 'variant' };
    }
    return { unavailable: false, priceEach: edible.price };
  }

  return { unavailable: true, reason: 'unknown' };
};

// GET /api/cart
export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ customer: req.user._id });
    res.json({ items: cart?.items || [] });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error fetching cart' });
  }
};

// PUT /api/cart (full sync)
export const syncCart = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items must be an array' });
    }

    const cart = await Cart.findOneAndUpdate(
      { customer: req.user._id },
      { customer: req.user._id, items },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ items: cart.items });
  } catch (error) {
    console.error('Sync cart error:', error);
    res.status(500).json({ message: 'Server error syncing cart' });
  }
};

// POST /api/cart/items
export const addCartItem = async (req, res) => {
  try {
    const item = req.body;
    if (!item.productId || !item.productType) {
      return res.status(400).json({ message: 'productId and productType are required' });
    }

    // Validate item is active
    const validation = await validateCartItem(item);
    if (validation.unavailable) {
      return res.status(409).json({
        message: 'This product or variant is currently unavailable',
        reason: validation.reason,
      });
    }

    let cart = await Cart.findOne({ customer: req.user._id });
    if (!cart) {
      cart = new Cart({ customer: req.user._id, items: [] });
    }

    // Check for duplicate (same product, strain, weight)
    const existingIndex = cart.items.findIndex(
      (i) =>
        i.productId.toString() === item.productId &&
        i.productType === item.productType &&
        (i.weight || '') === (item.weight || '') &&
        (i.strain || '') === (item.strain || '') &&
        (i.strainId?.toString() || '') === (item.strainId || '') &&
        (i.variantId?.toString() || '') === (item.variantId || '')
    );

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += item.quantity || 1;
    } else {
      cart.items.push({ ...item, quantity: item.quantity || 1, unavailable: false });
    }

    await cart.save();
    res.json({ items: cart.items });
  } catch (error) {
    console.error('Add cart item error:', error);
    res.status(500).json({ message: 'Server error adding to cart' });
  }
};

// PATCH /api/cart/items/:index
export const updateCartItem = async (req, res) => {
  try {
    const { index } = req.params;
    const { quantity } = req.body;
    const idx = parseInt(index, 10);

    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart || idx < 0 || idx >= cart.items.length) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    if (quantity < 1) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = quantity;
    }

    await cart.save();
    res.json({ items: cart.items });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ message: 'Server error updating cart item' });
  }
};

// DELETE /api/cart/items/:index
export const removeCartItem = async (req, res) => {
  try {
    const { index } = req.params;
    const idx = parseInt(index, 10);

    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart || idx < 0 || idx >= cart.items.length) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    cart.items.splice(idx, 1);
    await cart.save();
    res.json({ items: cart.items });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({ message: 'Server error removing cart item' });
  }
};

// DELETE /api/cart
export const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { customer: req.user._id },
      { items: [] }
    );
    res.json({ items: [] });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error clearing cart' });
  }
};

// POST /api/cart/validate
export const validateCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.json({ items: [], unavailableItems: [] });
    }

    const unavailableItems = [];
    let changed = false;

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const validation = await validateCartItem(item);

      if (validation.unavailable && !item.unavailable) {
        cart.items[i].unavailable = true;
        unavailableItems.push({ index: i, item: cart.items[i], reason: validation.reason });
        changed = true;
      } else if (!validation.unavailable && item.unavailable) {
        cart.items[i].unavailable = false;
        changed = true;
      }

      // Update price if it changed
      if (!validation.unavailable && validation.priceEach !== undefined && validation.priceEach !== item.priceEach) {
        cart.items[i].priceEach = validation.priceEach;
        changed = true;
      }
    }

    if (changed) {
      await cart.save();
    }

    res.json({ items: cart.items, unavailableItems });
  } catch (error) {
    console.error('Validate cart error:', error);
    res.status(500).json({ message: 'Server error validating cart' });
  }
};

export { validateCartItem };
