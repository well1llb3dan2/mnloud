import jwt from 'jsonwebtoken';
import { User, Message, Conversation, Order, Cart } from '../models/index.js';
import { sendPushToRole, sendPushToUser } from '../services/pushService.js';
import { validateCartItem } from '../controllers/cartController.js';
import config from '../config/index.js';
import { getServerVersion } from './bus.js';

// Verify socket JWT
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (error) {
    return null;
  }
};

// Connected users map: { userId: { userId, role, socketId } }
const connectedUsers = new Map();

// Manager sockets for broadcasting
const managerSockets = new Set();

export const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = verifySocketToken(token);
      
      if (!decoded) {
        return next(new Error('Invalid token'));
      }
      
      const user = await User.findById(decoded.userId).select('-password -refreshTokens -email -emailHash');
      
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user.nickname || user.firstName || user._id} (${user.role})`);
    
    // Store connection
    connectedUsers.set(user._id.toString(), {
      userId: user._id.toString(),
      role: user.role,
      socketId: socket.id,
    });
    
    if (user.role === 'manager') {
      managerSockets.add(socket.id);
    }
    
    // Join user's personal room
    socket.join(`user:${user._id}`);
    
    // Managers join a shared room
    if (user.role === 'manager') {
      socket.join('managers');
    }

    if (user.role === 'customer') {
      socket.join('customers');
    }

    const serverVersion = getServerVersion();
    if (serverVersion) {
      socket.emit('system:version', { version: serverVersion });
    }

    // =====================
    // CHAT EVENTS
    // =====================
    
    // Join a conversation room
    socket.on('join:conversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }
        
        // Customers can only join their own conversation
        if (user.role === 'customer' && 
            conversation.customer.toString() !== user._id.toString()) {
          return socket.emit('error', { message: 'Access denied' });
        }
        
        socket.join(`conversation:${conversationId}`);
        socket.emit('joined:conversation', conversationId);
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });
    
    // Leave conversation room
    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });
    
    // Send message
    socket.on('send:message', async (data) => {
      try {
        const { conversationId, content, encrypted, encryptedKeys, encryptedAttachments, messageType = 'text', orderData } = data;
        const safeContent = encrypted?.cipherText
          ? (messageType === 'image' ? '📎 Attachment' : undefined)
          : content;
        
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }
        
        // Validate access
        if (user.role === 'customer' && 
            conversation.customer.toString() !== user._id.toString()) {
          return socket.emit('error', { message: 'Access denied' });
        }
        
        // Create message
        const message = new Message({
          conversation: conversationId,
          sender: user._id,
          senderRole: user.role,
          content: safeContent,
          encrypted,
          encryptedKeys,
          encryptedAttachments,
          messageType,
          orderData,
          readBy: [{ user: user._id }],
          deliveredAt: new Date(),
        });
        
        await message.save();
        
        // Update conversation
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;
        
        if (user.role === 'customer') {
          conversation.unreadCount += 1;
        } else {
          conversation.customerUnreadCount += 1;
        }
        
        await conversation.save();
        
        // If it's an order, validate and create order record
        if (messageType === 'order' && orderData) {
          // Validate each order item before creating
          const unavailableItems = [];
          for (let i = 0; i < orderData.items.length; i++) {
            const item = orderData.items[i];
            const validation = await validateCartItem(item);
            if (validation.unavailable) {
              unavailableItems.push({
                index: i,
                productName: item.productName,
                strain: item.strain,
                variant: item.variant,
                reason: validation.reason,
              });
            }
          }

          if (unavailableItems.length > 0) {
            // Update cart to mark unavailable items
            const cart = await Cart.findOne({ customer: conversation.customer });
            if (cart) {
              for (const unavail of unavailableItems) {
                const cartItem = cart.items.find(
                  (ci) =>
                    ci.productId?.toString() === orderData.items[unavail.index].productId &&
                    (ci.strain || '') === (orderData.items[unavail.index].strain || '') &&
                    (ci.variant || '') === (orderData.items[unavail.index].variant || '')
                );
                if (cartItem) {
                  cartItem.unavailable = true;
                }
              }
              await cart.save();
            }

            // Delete the message since the order failed validation
            await message.deleteOne();
            conversation.lastMessage = null;
            conversation.lastMessageAt = null;
            if (user.role === 'customer') {
              conversation.unreadCount = Math.max(0, conversation.unreadCount - 1);
            }
            await conversation.save();

            socket.emit('order:validation-failed', {
              unavailableItems,
              message: 'Some items in your order are no longer available.',
            });
            return;
          }

          const order = new Order({
            customer: conversation.customer,
            items: orderData.items,
            subtotal: orderData.orderTotal,
            total: orderData.orderTotal,
            messageId: message._id,
          });
          await order.save();

          // Clear cart after successful order
          await Cart.findOneAndUpdate(
            { customer: conversation.customer },
            { items: [] }
          );
        }
        
        // Populate sender info
        const populated = await message.populate('sender', 'firstName lastName role');
        
        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('new:message', {
          message: populated,
          conversationId,
        });
        
        // Notify managers if customer sent message
        if (user.role === 'customer') {
          io.to('managers').emit('conversation:updated', {
            conversationId,
            unreadCount: conversation.unreadCount,
            lastMessage: populated,
          });

          await sendPushToRole('manager', {
            title: `New message from ${user.firstName || 'Customer'}`,
            body: messageType === 'order' ? 'New order received' : 'New encrypted message',
            url: '/chats',
            icon: '/icons/icon-192x192.png',
          });
        }
        
        // Notify customer if manager sent message
        if (user.role === 'manager') {
          io.to(`user:${conversation.customer}`).emit('new:notification', {
            type: 'message',
            conversationId,
            message: populated,
          });

          await sendPushToUser(conversation.customer, {
            title: 'New message from your manager',
            body: 'New encrypted message',
            url: '/chat',
            icon: '/icons/icon-192x192.png',
          });
        }
        
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Typing indicator
    socket.on('typing:start', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) return;
        
        // Customers can only type in their own conversation
        if (user.role === 'customer' && 
            conversation.customer.toString() !== user._id.toString()) {
          return;
        }
        
        // Broadcast to conversation (except sender)
        socket.to(`conversation:${conversationId}`).emit('user:typing', {
          userId: user._id,
          firstName: user.firstName,
          role: user.role,
          conversationId,
        });
        
        // If customer is typing, also notify all managers
        if (user.role === 'customer') {
          socket.to('managers').emit('customer:typing', {
            customerId: user._id,
            customerName: `${user.firstName} ${user.lastName}`,
            conversationId,
          });
        }
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });
    
    // Stop typing
    socket.on('typing:stop', async (conversationId) => {
      try {
        socket.to(`conversation:${conversationId}`).emit('user:stopped-typing', {
          userId: user._id,
          conversationId,
        });
        
        if (user.role === 'customer') {
          socket.to('managers').emit('customer:stopped-typing', {
            customerId: user._id,
            conversationId,
          });
        }
      } catch (error) {
        console.error('Stop typing error:', error);
      }
    });
    
    // Mark messages as read
    socket.on('messages:read', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        
        if (!conversation) return;
        
        // Update unread messages
        await Message.updateMany(
          {
            conversation: conversationId,
            'readBy.user': { $ne: user._id },
          },
          {
            $push: { readBy: { user: user._id, readAt: new Date() } },
          }
        );
        
        // Reset unread count
        if (user.role === 'manager') {
          conversation.unreadCount = 0;
        } else {
          conversation.customerUnreadCount = 0;
        }
        
        await conversation.save();
        
        // Notify sender that messages were read
        socket.to(`conversation:${conversationId}`).emit('messages:read-receipt', {
          readBy: user._id,
          readerName: `${user.firstName} ${user.lastName}`,
          readerRole: user.role,
          conversationId,
          readAt: new Date(),
        });
        
        // Notify managers of read status
        if (user.role === 'customer') {
          io.to('managers').emit('customer:read-messages', {
            customerId: user._id,
            customerName: `${user.firstName} ${user.lastName}`,
            conversationId,
            readAt: new Date(),
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });
    
    // Message delivered confirmation
    socket.on('message:delivered', async (messageId) => {
      try {
        const message = await Message.findById(messageId);
        
        if (!message) return;
        
        if (!message.deliveredAt) {
          message.deliveredAt = new Date();
          await message.save();
        }
        
        // Notify sender
        io.to(`user:${message.sender}`).emit('message:delivered-receipt', {
          messageId,
          deliveredAt: message.deliveredAt,
        });
      } catch (error) {
        console.error('Delivery receipt error:', error);
      }
    });

    // =====================
    // DISCONNECT
    // =====================
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.nickname || user.firstName || user._id}`);
      connectedUsers.delete(user._id.toString());
      
      if (user.role === 'manager') {
        managerSockets.delete(socket.id);
      }
    });
  });

  return io;
};

export { connectedUsers, managerSockets };
