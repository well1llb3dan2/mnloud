import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ToastProvider';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useCartStore } from '../stores/cartStore';
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
  const managerKeysRef = useRef(null);
  const { addMessage, setTyping, incrementUnread } = useChatStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const serverVersionKey = 'customer:lastServerVersion';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const apiUrl = import.meta.env.VITE_API_URL || (isLocalhost
    ? '/api'
    : 'https://api.mnloud.com/api');

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

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (isLocalhost
      ? window.location.origin
      : 'https://api.mnloud.com');
    
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
          await pushService.subscribe(existing.toJSON(), 'customer');
          return;
        }

        const { publicKey } = await pushService.getVapidPublicKey();
        if (!publicKey) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await pushService.subscribe(subscription.toJSON(), 'customer');
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

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('system:version', ({ version }) => {
      if (!version) return;
      const previous = localStorage.getItem(serverVersionKey);
      localStorage.setItem(serverVersionKey, version);
      if (previous && previous !== version) {
        window.location.reload();
      }
    });

    newSocket.on('products:updated', ({ name, isActive, action, productType }) => {
      const label = name || 'Product';
      queryClient.invalidateQueries({ queryKey: ['products'] });

      if (action === 'deactivated' || action === 'deleted') {
        // Re-validate cart items when products become unavailable
        useCartStore.getState().validateCart();
      }

      if (action === 'activated') {
        toast({
          title: 'Product available',
          description: `${label} is now available.`,
          status: 'success',
          duration: 4000,
          isClosable: true,
          position: 'top',
        });
      } else if (action === 'deactivated') {
        toast({
          title: 'Product unavailable',
          description: `${label} was just deactivated.`,
          status: 'warning',
          duration: 4000,
          isClosable: true,
          position: 'top',
        });
      } else if (action === 'deleted') {
        toast({
          title: 'Product removed',
          description: `${label} is no longer available.`,
          status: 'warning',
          duration: 4000,
          isClosable: true,
          position: 'top',
        });
      } else {
        toast({
          title: 'Product updated',
          description: `${label} has been updated.`,
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      }
    });

    // Message handlers
    newSocket.on('new:message', async ({ message }) => {
      console.log('Customer received new:message', message);
      const decrypted = await decryptMessage({ message, userId: user?._id });
      addMessage(decrypted);
    });

    newSocket.on('new:notification', async ({ type, message }) => {
      console.log('Customer received new:notification', { type, message });
      if (type === 'message') {
        // Also add the message to ensure it appears
        const decrypted = await decryptMessage({ message, userId: user?._id });
        addMessage(decrypted);
        incrementUnread();
        // Show toast notification
        toast({
          title: 'New message',
          description: decrypted?.content?.substring(0, 50) || 'You have a new encrypted message',
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      }
    });

    newSocket.on('user:typing', ({ firstName }) => {
      setTyping(true, firstName);
    });

    newSocket.on('user:stopped-typing', () => {
      setTyping(false, null);
    });

    newSocket.on('messages:read-receipt', () => {
      // Could update UI to show read receipts
    });

    newSocket.on('order:status', ({ orderId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    newSocket.on('order:validation-failed', ({ unavailableItems, message: msg }) => {
      // Re-fetch cart to get updated unavailable flags
      useCartStore.getState().fetchCart();
      toast({
        title: 'Order could not be placed',
        description: msg || 'Some items are no longer available.',
        status: 'error',
        duration: 6000,
        isClosable: true,
        position: 'top',
      });
    });

    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      toast({
        title: 'Connection error',
        description: message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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

  const getManagerKeys = async () => {
    if (managerKeysRef.current) return managerKeysRef.current;
    const data = await authService.listPublicKeys('manager');
    managerKeysRef.current = data?.keys || [];
    return managerKeysRef.current;
  };

  const sendMessage = async (conversationId, content, messageType = 'text', orderData = null) => {
    if (!socket || !user?._id) return;

    try {
      const recipients = await getManagerKeys();
      if (!recipients.length) {
        throw new Error('No manager public keys available');
      }
      const encryption = await encryptForRecipients({
        plaintext: content,
        recipients,
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
