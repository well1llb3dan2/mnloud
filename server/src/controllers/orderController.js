import { Order } from '../models/index.js';
import { emitToRoom } from '../socket/bus.js';

// Get customer's order history (excludes archived)
export const getCustomerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id, archived: { $ne: true } })
      .sort({ createdAt: -1 });
    
    res.json({ orders });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
};

// Get all orders (manager) — active (non-archived) by default
export const getAllOrders = async (req, res) => {
  try {
    const { status, archived, limit = 50, page = 1 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    if (archived === 'true') {
      query.archived = true;
    } else {
      query.archived = { $ne: true };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'firstName lastName nickname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);
    
    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
};

// Get single order
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate('customer', 'firstName lastName nickname');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Customers can only see their own orders
    if (req.user.role === 'customer' && 
        order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error fetching order' });
  }
};

// Get order by messageId (manager)
export const getOrderByMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const order = await Order.findOne({ messageId })
      .populate('customer', 'firstName lastName nickname');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order by message error:', error);
    res.status(500).json({ message: 'Server error fetching order' });
  }
};

// Update order status (manager)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.archived) {
      return res.status(400).json({ message: 'Cannot modify archived orders' });
    }
    
    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    
    await order.save();
    
    const populated = await order.populate('customer', 'firstName lastName nickname');

    // Notify customer in real-time
    emitToRoom(`user:${order.customer}`, 'order:status', {
      orderId: order._id,
      status: order.status,
    });
    
    res.json({ order: populated });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error updating order' });
  }
};
