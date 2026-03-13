import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useToast } from '@chakra-ui/react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { authService, pushService } from '../services';
import { decryptMessage, encryptForRecipients } from '../utils/e2ee';

const SocketContext = createContext(null);

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { accessToken, refreshToken, user } = useAuthStore();
  const socketRef = useRef(null);
  const customerKeyCacheRef = useRef(new Map());
  const {
    addMessage,
    updateConversation,
    setTypingUser,
  } = useChatStore();
  const toast = useToast();
  const serverVersionKey = 'manager:lastServerVersion';
  const isHosted = window.location.hostname.endsWith('nexgrex.com');
  const apiUrl = isHosted
    ? (import.meta.env.VITE_API_URL || 'https://api.nexgrex.com/api')
    : import.meta.env.VITE_API_URL || '/api';

  const parseJwtExp = (token) => {
    try {
      const payload = token.split('.')[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(window.atob(base64));
      return decoded?.exp ? decoded.exp * 1000 : null;
    } catch (error) {
      return null;
    }
  };

  const isTokenExpired = (token) => {
    const exp = parseJwtExp(token);
    if (!exp) return true;
    return Date.now() >= exp;
  };

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (socketRef.current) {
      socketRef.current.auth = { token: accessToken };
      if (!socketRef.current.connected) {
        socketRef.current.connect();
      }
      return;
    }

    const socketUrl = window.location.hostname.endsWith('nexgrex.com')
      ? (import.meta.env.VITE_SOCKET_URL || 'https://api.nexgrex.com')
      : import.meta.env.VITE_SOCKET_URL || window.location.origin;
    
    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    const setupPushNotifications = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (typeof Notification === 'undefined') return;
        if (Notification.permission === 'denied') return;

        const permission = Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();

        if (permission !== 'granted') return;

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await pushService.subscribe(existing.toJSON(), 'manager');
          return;
        }

        const { publicKey } = await pushService.getVapidPublicKey();
        if (!publicKey) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await pushService.subscribe(subscription.toJSON(), 'manager');
      } catch (error) {
        console.warn('Push setup failed:', error?.message || error);
      }
    };

    setupPushNotifications();

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('system:version', ({ version }) => {
      if (!version) return;
      const previous = localStorage.getItem(serverVersionKey);
      if (previous && previous !== version) {
        toast({
          title: 'Update available',
          description: 'Server updated. Refresh the page to continue.',
          status: 'info',
          duration: null,
          isClosable: true,
          position: 'top-right',
        });
      }
      localStorage.setItem(serverVersionKey, version);
    });

    // Message handlers
    newSocket.on('new:message', async ({ message, conversationId }) => {
      console.log('Manager SocketContext received new:message', { message, conversationId });
      const decrypted = await decryptMessage({ message, userId: user?._id });
      addMessage(decrypted, conversationId);
    });

    newSocket.on('conversation:updated', async ({ conversationId, unreadCount, lastMessage }) => {
      console.log('Manager received conversation:updated', { conversationId, lastMessage });
      const decryptedLast = await decryptMessage({ message: lastMessage, userId: user?._id });
      updateConversation(conversationId, {
        unreadCount,
        lastMessage: decryptedLast,
        lastMessageAt: decryptedLast?.createdAt || lastMessage.createdAt,
      });

      // Show notification
      const customerName = decryptedLast?.sender?.firstName || 'Customer';
      toast({
        title: `New message from ${customerName}`,
        description: decryptedLast?.content?.substring(0, 50) || 'New encrypted message',
        status: 'info',
        duration: 4000,
        isClosable: true,
        position: 'top-right',
      });
    });

    // Typing indicators
    newSocket.on('customer:typing', ({ customerId, customerName, conversationId }) => {
      setTypingUser(conversationId, customerId);
    });

    newSocket.on('customer:stopped-typing', ({ customerId, conversationId }) => {
      setTypingUser(conversationId, null);
    });

    // Also listen for user:typing (when viewing specific conversation)
    newSocket.on('user:typing', ({ userId, conversationId }) => {
      setTypingUser(conversationId, userId);
    });

    newSocket.on('user:stopped-typing', ({ userId, conversationId }) => {
      setTypingUser(conversationId, null);
    });

    // Read receipts
    newSocket.on('customer:read-messages', ({ customerId, customerName, conversationId, readAt }) => {
      // Could show a toast or update UI
    });

    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, user?._id]);

  useEffect(() => {
    if (!accessToken || !refreshToken) return;

    const expMs = parseJwtExp(accessToken);
    if (!expMs) return;

    const now = Date.now();
    const refreshAt = expMs - 60 * 1000;
    const delay = Math.max(refreshAt - now, 5000);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await axios.post(`${apiUrl}/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
      } catch (error) {
        const currentToken = useAuthStore.getState().accessToken;
        if (!currentToken || isTokenExpired(currentToken)) {
          localStorage.setItem(
            'auth:logoutReason',
            'You were signed out due to inactivity. Please sign in again.'
          );
          useAuthStore.getState().logout();
          window.location.replace('/login');
        }
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [accessToken, refreshToken, apiUrl]);

  const joinConversation = (conversationId) => {
    if (socket) {
      socket.emit('join:conversation', conversationId);
    }
  };

  const leaveConversation = (conversationId) => {
    if (socket) {
      socket.emit('leave:conversation', conversationId);
    }
  };

  const getCustomerKey = async (customerId) => {
    if (customerKeyCacheRef.current.has(customerId)) {
      return customerKeyCacheRef.current.get(customerId);
    }
    const data = await authService.getPublicKey(customerId);
    customerKeyCacheRef.current.set(customerId, data);
    return data;
  };

  const sendMessage = async (conversationId, content, messageType = 'text', orderData = null, recipientUserId = null) => {
    if (!socket || !user?._id || !recipientUserId) return;

    try {
      const recipient = await getCustomerKey(recipientUserId);
      const encryption = await encryptForRecipients({
        plaintext: content,
        recipients: [recipient],
        senderUserId: user._id,
      });

      socket.emit('send:message', {
        conversationId,
        messageType,
        orderData,
        encrypted: encryption.encrypted,
        encryptedKeys: encryption.encryptedKeys,
      });
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      toast({
        title: 'Message failed',
        description: 'Unable to encrypt message. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top-right',
      });
    }
  };

  const startTyping = (conversationId) => {
    if (socket) {
      socket.emit('typing:start', conversationId);
    }
  };

  const stopTyping = (conversationId) => {
    if (socket) {
      socket.emit('typing:stop', conversationId);
    }
  };

  const markAsRead = (conversationId) => {
    if (socket) {
      socket.emit('messages:read', conversationId);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        sendMessage,
        startTyping,
        stopTyping,
        markAsRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
