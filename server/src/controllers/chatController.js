import { Message, Conversation, Order, User } from '../models/index.js';
import { sendPushToRole, sendPushToUser } from '../services/pushService.js';
import { io } from '../index.js';

// Get or create conversation for customer
export const getOrCreateConversation = async (req, res) => {
  try {
    let conversation = await Conversation.findOne({ customer: req.user._id })
      .populate('customer', 'firstName lastName nickname')
      .populate('lastMessage');
    
    if (!conversation) {
      conversation = new Conversation({
        customer: req.user._id,
      });
      await conversation.save();
      conversation = await conversation.populate('customer', 'firstName lastName nickname');
    }
    
    res.json({ conversation });
  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single conversation by ID (for managers)
export const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findById(conversationId)
      .populate('customer', 'firstName lastName nickname')
      .populate('lastMessage');
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Customers can only access their own conversation
    if (req.user.role === 'customer' && 
        conversation.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ conversation });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all conversations (for managers)
export const getConversations = async (req, res) => {
  try {
    const [conversations, customers] = await Promise.all([
      Conversation.find()
        .populate('customer', 'firstName lastName nickname')
        .populate('lastMessage'),
      User.find({ role: 'customer', isActive: true })
        .select('firstName lastName nickname'),
    ]);

    const existingCustomerIds = new Set(
      conversations
        .map((conversation) => conversation.customer?._id?.toString())
        .filter(Boolean)
    );

    const missingCustomers = customers.filter(
      (customer) => !existingCustomerIds.has(customer._id.toString())
    );

    if (missingCustomers.length > 0) {
      const created = await Conversation.insertMany(
        missingCustomers.map((customer) => ({ customer: customer._id }))
      );

      const createdConversations = await Conversation.find({
        _id: { $in: created.map((conversation) => conversation._id) },
      })
        .populate('customer', 'firstName lastName nickname')
        .populate('lastMessage');

      conversations.push(...createdConversations);
    }

    conversations.sort((a, b) => {
      const aTime =
        a.lastMessageAt || a.updatedAt || a.createdAt || new Date(0);
      const bTime =
        b.lastMessageAt || b.updatedAt || b.createdAt || new Date(0);
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error fetching conversations' });
  }
};

// Get messages for a conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Customers can only access their own conversation
    if (req.user.role === 'customer' && 
        conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const query = { conversation: conversationId };
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    
    const messages = await Message.find(query)
      .populate('sender', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// Send message (REST fallback, Socket.io preferred)
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, encrypted, encryptedKeys, encryptedAttachments, messageType = 'text', orderData } = req.body;
    const safeContent = encrypted?.cipherText
      ? (messageType === 'image' ? '📎 Attachment' : undefined)
      : content;
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Customers can only send to their own conversation
    if (req.user.role === 'customer' && 
        conversation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const message = new Message({
      conversation: conversationId,
      sender: req.user._id,
      senderRole: req.user.role,
      content: safeContent,
      encrypted,
      encryptedKeys,
      encryptedAttachments,
      messageType,
      orderData,
      readBy: [{ user: req.user._id }],
      deliveredAt: new Date(),
    });
    
    await message.save();
    
    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    
    if (req.user.role === 'customer') {
      conversation.unreadCount += 1;
    } else {
      conversation.customerUnreadCount += 1;
    }
    
    await conversation.save();
    
    // If it's an order message, create the order record
    if (messageType === 'order' && orderData) {
      const order = new Order({
        customer: conversation.customer,
        items: orderData.items,
        subtotal: orderData.orderTotal,
        total: orderData.orderTotal,
        messageId: message._id,
      });
      await order.save();
    }
    
    const populated = await message.populate('sender', 'firstName lastName role');
    
    // Emit socket events so other party receives the message in real-time
    // Emit to conversation room
    io.to(`conversation:${conversationId}`).emit('new:message', {
      message: populated,
      conversationId,
    });
    
    // Notify the other party
    if (req.user.role === 'customer') {
      // Notify managers
      io.to('managers').emit('conversation:updated', {
        conversationId,
        unreadCount: conversation.unreadCount,
        lastMessage: populated,
      });

      await sendPushToRole('manager', {
        title: `New message from ${req.user.firstName || 'Customer'}`,
        body: populated.content?.substring(0, 80) || 'New order or message received',
        url: '/chats',
        icon: '/icons/icon-192x192.png',
      });
    } else {
      // Notify customer
      io.to(`user:${conversation.customer}`).emit('new:notification', {
        type: 'message',
        conversationId,
        message: populated,
      });

      await sendPushToUser(conversation.customer, {
        title: 'New message from your manager',
        body: populated.content?.substring(0, 80) || 'You have a new message',
        url: '/chat',
        icon: '/icons/icon-192x192.png',
      });
    }
    
    res.status(201).json({ message: populated });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Update unread messages
    await Message.updateMany(
      {
        conversation: conversationId,
        'readBy.user': { $ne: req.user._id },
      },
      {
        $push: { readBy: { user: req.user._id, readAt: new Date() } },
      }
    );
    
    // Reset unread count
    if (req.user.role === 'manager') {
      conversation.unreadCount = 0;
    } else {
      conversation.customerUnreadCount = 0;
    }
    
    await conversation.save();
    
    // Emit read receipt via socket
    io.to(`conversation:${conversationId}`).emit('messages:read-receipt', {
      readBy: req.user._id,
      readerName: `${req.user.firstName} ${req.user.lastName}`,
      readerRole: req.user.role,
      conversationId,
      readAt: new Date(),
    });
    
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
