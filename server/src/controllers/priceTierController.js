import { PriceTier } from '../models/index.js';

// Get all price tiers
export const getPriceTiers = async (req, res) => {
  try {
    const tiers = await PriceTier.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json({ tiers });
  } catch (error) {
    console.error('Get price tiers error:', error);
    res.status(500).json({ message: 'Server error fetching price tiers' });
  }
};

// Get all price tiers (including inactive, for managers)
export const getAllPriceTiers = async (req, res) => {
  try {
    const tiers = await PriceTier.find().sort({ sortOrder: 1 });
    res.json({ tiers });
  } catch (error) {
    console.error('Get all price tiers error:', error);
    res.status(500).json({ message: 'Server error fetching price tiers' });
  }
};

// Create price tier
export const createPriceTier = async (req, res) => {
  try {
    const { name, description, prices, sortOrder } = req.body;
    
    const tier = new PriceTier({
      name,
      description,
      prices,
      sortOrder,
    });
    
    await tier.save();
    
    res.status(201).json({ tier });
  } catch (error) {
    console.error('Create price tier error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A tier with this name already exists' });
    }
    res.status(500).json({ message: 'Server error creating price tier' });
  }
};

// Update price tier
export const updatePriceTier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, prices, sortOrder, isActive } = req.body;
    
    const tier = await PriceTier.findById(id);
    
    if (!tier) {
      return res.status(404).json({ message: 'Price tier not found' });
    }
    
    if (name !== undefined) tier.name = name;
    if (description !== undefined) tier.description = description;
    if (prices !== undefined) tier.prices = prices;
    if (sortOrder !== undefined) tier.sortOrder = sortOrder;
    if (isActive !== undefined) tier.isActive = isActive;
    
    await tier.save();
    
    res.json({ tier });
  } catch (error) {
    console.error('Update price tier error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A tier with this name already exists' });
    }
    res.status(500).json({ message: 'Server error updating price tier' });
  }
};

// Delete price tier
export const deletePriceTier = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tier = await PriceTier.findByIdAndDelete(id);
    
    if (!tier) {
      return res.status(404).json({ message: 'Price tier not found' });
    }
    
    res.json({ message: 'Price tier deleted successfully' });
  } catch (error) {
    console.error('Delete price tier error:', error);
    res.status(500).json({ message: 'Server error deleting price tier' });
  }
};
