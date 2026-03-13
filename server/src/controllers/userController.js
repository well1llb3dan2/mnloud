import { Invite, User } from '../models/index.js';

// Create invite
export const createInvite = async (req, res) => {
  try {
    const { role = 'customer' } = req.body;
    
    const invite = new Invite({
      role,
      createdBy: req.user._id,
    });
    
    await invite.save();
    
    res.status(201).json({
      invite: {
        code: invite.code,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ message: 'Server error creating invite' });
  }
};

// Get all invites (manager only)
export const getInvites = async (req, res) => {
  try {
    const invites = await Invite.find()
      .populate('createdBy', 'firstName lastName nickname')
      .populate('usedBy', 'firstName lastName nickname')
      .sort({ createdAt: -1 });
    
    res.json({ invites });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ message: 'Server error fetching invites' });
  }
};

// Delete invite
export const deleteInvite = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invite = await Invite.findByIdAndDelete(id);
    
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }
    
    res.json({ message: 'Invite deleted successfully' });
  } catch (error) {
    console.error('Delete invite error:', error);
    res.status(500).json({ message: 'Server error deleting invite' });
  }
};

// Get all customers (manager only)
export const getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('-password -refreshTokens -email -emailHash')
      .sort({ createdAt: -1 });
    
    res.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error fetching customers' });
  }
};

// Get all managers (manager only)
export const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' })
      .select('-password -refreshTokens -email -emailHash')
      .sort({ createdAt: -1 });
    
    res.json({ managers });
  } catch (error) {
    console.error('Get managers error:', error);
    res.status(500).json({ message: 'Server error fetching managers' });
  }
};

// Toggle user active status
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deactivating yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'Server error toggling user status' });
  }
};
