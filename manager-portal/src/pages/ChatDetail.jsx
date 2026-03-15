import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  IconButton,
  Button,
  useColorMode,
  useToast,
  Spinner,
  Center,
  Avatar,
  Flex,
  Image,
  Badge,
} from '@chakra-ui/react';
import { FiSend, FiArrowLeft, FiImage, FiCheck, FiCheckCircle } from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import { authService, chatService, orderService } from '../services';
import { useChatStore, useAuthStore } from '../stores';
import { useSocket } from '../context/SocketContext';
import { decryptMessages, decryptMessage, encryptForRecipients } from '../utils/e2ee';
import { useConfirmDialog } from '../components/ConfirmDialog';

const ChatDetail = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const { socket, joinConversation, leaveConversation, markAsRead, startTyping, stopTyping } = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const messagesEndRef = useRef();
  const messagesContainerRef = useRef();
  const fileInputRef = useRef();
  const customerKeyRef = useRef(null);
  const clearedUnreadRef = useRef(null);

  const [message, setMessage] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestCursorRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const messageLimit = 15;
  const navBarHeight = 80;
  const customerBarHeight = 64;
  const inputBarHeight = 72;
  const typingUsers = useChatStore((state) => state.typingUsers);
  const setTypingUser = useChatStore((state) => state.setTypingUser);
  const setCurrentConversation = useChatStore((state) => state.setCurrentConversation);
  const clearUnread = useChatStore((state) => state.clearUnread);
  const storeMessages = useChatStore((state) => state.messages);
  const setStoreMessages = useChatStore((state) => state.setMessages);
  const prependStoreMessages = useChatStore((state) => state.prependMessages);
  const addMessageToStore = useChatStore((state) => state.addMessage);
  const { user } = useAuthStore();

  // Fetch conversation
  const { data: conversationData, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => chatService.getConversation(conversationId),
  });

  // Fetch messages (paged)
  useEffect(() => {
    if (!conversationId) return;

    const fetchInitial = async () => {
      setIsLoadingMessages(true);
      try {
        const data = await chatService.getMessages(conversationId, { limit: messageLimit });
        const decrypted = await decryptMessages({ messages: data.messages || [], userId: user?._id });
        setLocalMessages(decrypted);
        setStoreMessages(decrypted);
        oldestCursorRef.current = decrypted?.[0]?.createdAt || null;
        setHasMore((decrypted?.length || 0) === messageLimit);
        shouldAutoScrollRef.current = true;
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        });
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchInitial();
  }, [conversationId, messageLimit, setStoreMessages, user?._id]);

  const conversation = conversationData?.conversation;
  const customer = conversation?.customer;
  const isTyping = typingUsers[conversationId];

  // Combine local messages with store messages for display
  const displayMessages = localMessages;

  const orderMessageIds = displayMessages
    .filter((msg) => msg.messageType === 'order')
    .map((msg) => msg._id);

  const orderQueries = useQueries({
    queries: orderMessageIds.map((messageId) => ({
      queryKey: ['orderByMessage', messageId],
      queryFn: async () => orderService.getByMessage(messageId),
      enabled: Boolean(messageId),
      retry: false,
    })),
  });

  const ordersByMessageId = orderMessageIds.reduce((acc, messageId, idx) => {
    const data = orderQueries[idx]?.data;
    if (data?.order) acc[messageId] = data.order;
    return acc;
  }, {});

  const formatRelativeTime = (value) => {
    if (!value) return '';
    try {
      return formatDistanceToNow(new Date(value), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  // Set current conversation in store when loaded
  useEffect(() => {
    if (conversation) {
      setCurrentConversation(conversation);
    }
    return () => {
      setCurrentConversation(null);
      setStoreMessages([]);
    };
  }, [conversation, setCurrentConversation, setStoreMessages, clearUnread]);

  useEffect(() => {
    if (!conversationId) return;
    if (clearedUnreadRef.current === conversationId) return;
    clearUnread(conversationId);
    clearedUnreadRef.current = conversationId;
  }, [conversationId, clearUnread]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Sync store messages to local (when new messages arrive via socket)
  useEffect(() => {
    if (storeMessages.length > 0 && storeMessages.length > localMessages.length) {
      // Merge new messages from store that aren't in local
      setLocalMessages(prev => {
        const existingIds = new Set(prev.map(m => m._id));
        const newMessages = storeMessages.filter(m => !existingIds.has(m._id));
        if (newMessages.length > 0) {
          return [...prev, ...newMessages];
        }
        return prev;
      });
    }
  }, [storeMessages, localMessages.length]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    // Join conversation room using helper
    joinConversation(conversationId);

    const handleNewMessage = async ({ message: newMsg, conversationId: convId }) => {
      console.log('ChatDetail received new:message', { convId, conversationId, newMsg });
      if (convId === conversationId) {
        const decrypted = await decryptMessage({ message: newMsg, userId: user?._id });
        // Add directly to local state for immediate display
        setLocalMessages((prev) => {
          // Avoid duplicates
          if (prev.find(m => m._id === decrypted._id)) return prev;
          return [...prev, decrypted];
        });
        // Also add to store
        addMessageToStore(decrypted, conversationId);
        // Mark as read immediately
        markAsRead(conversationId);
      }
    };

    const handleTyping = ({ userId, conversationId: convId }) => {
      if (convId === conversationId) {
        setTypingUser(conversationId, userId);
      }
    };

    const handleStoppedTyping = ({ conversationId: convId }) => {
      if (convId === conversationId) {
        setTypingUser(conversationId, null);
      }
    };

    const handleReadReceipt = ({ conversationId: convId, readAt }) => {
      if (convId === conversationId) {
        setLocalMessages((prev) =>
          prev.map((m) => ({ ...m, readAt: readAt }))
        );
      }
    };

    // Listen for correct event names (with colons)
    socket.on('new:message', handleNewMessage);
    socket.on('user:typing', handleTyping);
    socket.on('user:stopped-typing', handleStoppedTyping);
    socket.on('messages:read-receipt', handleReadReceipt);

    // Mark messages as read when opening chat
    markAsRead(conversationId);

    return () => {
      socket.off('new:message', handleNewMessage);
      socket.off('user:typing', handleTyping);
      socket.off('user:stopped-typing', handleStoppedTyping);
      socket.off('messages:read-receipt', handleReadReceipt);
      leaveConversation(conversationId);
    };
  }, [socket, conversationId, setTypingUser, joinConversation, leaveConversation, markAsRead, addMessageToStore, clearUnread]);

  // Scroll to bottom (only when user is near bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages.length]);

  const loadMoreMessages = async () => {
    if (!conversationId || !hasMore || isLoadingMore) return;

    const before = oldestCursorRef.current;
    if (!before) return;

    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;
    const prevTop = container?.scrollTop || 0;

    setIsLoadingMore(true);
    try {
      const data = await chatService.getMessages(conversationId, {
        limit: messageLimit,
        before,
      });
      const older = await decryptMessages({ messages: data.messages || [], userId: user?._id });
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      oldestCursorRef.current = older[0]?.createdAt || before;
      shouldAutoScrollRef.current = false;
      prependStoreMessages(older);
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m._id));
        const uniqueOlder = older.filter((m) => !existingIds.has(m._id));
        return uniqueOlder.length > 0 ? [...uniqueOlder, ...prev] : prev;
      });
      requestAnimationFrame(() => {
        if (!container) return;
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - prevHeight + prevTop;
      });
      if (older.length < messageLimit) {
        setHasMore(false);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 40) {
      loadMoreMessages();
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    shouldAutoScrollRef.current = nearBottom;
  };

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (data) => chatService.sendMessage(conversationId, data),
    onSuccess: async (data) => {
      const decrypted = await decryptMessage({ message: data.message, userId: user?._id });
      setLocalMessages((prev) => {
        if (prev.some((msg) => msg._id === decrypted._id)) {
          return prev;
        }
        return [...prev, decrypted];
      });
      queryClient.invalidateQueries(['conversations']);
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (id) => orderService.updateStatus(id, 'cancelled'),
    onSuccess: () => {
      queryClient.invalidateQueries(['orderByMessage']);
      queryClient.invalidateQueries(['orders']);
      toast({ title: 'Order cancelled', status: 'info' });
    },
  });

  const handleCancelOrder = async (orderId) => {
    const shouldCancel = await confirm({
      title: 'Cancel order',
      message: 'Cancel this order?',
      confirmText: 'Cancel Order',
      cancelText: 'Back',
    });
    if (shouldCancel) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !user?._id) return;

    try {
      if (!customerKeyRef.current && conversation?.customer?._id) {
        customerKeyRef.current = await authService.getPublicKey(conversation.customer._id);
      }

      const recipients = customerKeyRef.current ? [customerKeyRef.current] : [];
      if (!recipients.length) {
        throw new Error('Customer public key is unavailable');
      }
      const encryption = await encryptForRecipients({
        plaintext: message,
        recipients,
        senderUserId: user._id,
      });

      await sendMutation.mutateAsync({
        messageType: 'text',
        encrypted: encryption.encrypted,
        encryptedKeys: encryption.encryptedKeys,
      });
      setMessage('');
    } catch (error) {
      console.error('Failed to send encrypted message:', error);
    }
  };

  const handleTypingStart = () => {
    startTyping(conversationId);
  };

  const handleTypingEnd = () => {
    stopTyping(conversationId);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (!customerKeyRef.current && conversation?.customer?._id) {
        customerKeyRef.current = await authService.getPublicKey(conversation.customer._id);
      }

      const recipients = customerKeyRef.current ? [customerKeyRef.current] : [];
      if (!recipients.length) {
        throw new Error('Customer public key is unavailable');
      }
      const buffer = await file.arrayBuffer();
      const encryption = await encryptForRecipients({
        plaintext: `📎 ${file.name}`,
        recipients,
        senderUserId: user._id,
        attachments: [
          {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            data: new Uint8Array(buffer),
          },
        ],
      });

      await sendMutation.mutateAsync({
        messageType: 'image',
        encrypted: encryption.encrypted,
        encryptedKeys: encryption.encryptedKeys,
        encryptedAttachments: encryption.encryptedAttachments,
      });
    } catch (error) {
      console.error('Failed to send encrypted attachment:', error);
    }
  };

  if (isLoadingConversation || isLoadingMessages) {
    return (
      <Center h="100vh">
        <Spinner size="xl" color="purple.400" />
      </Center>
    );
  }

  return (
    <Box
      h="100dvh"
      overflow="hidden"
      overscrollBehaviorY="none"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
    >
      {/* Customer bar */}
      <Box
        h={`${customerBarHeight}px`}
        px={4}
        display="flex"
        alignItems="center"
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderBottomWidth={1}
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={120}
      >
        <HStack w="100%" spacing={3} position="relative" align="center">
          <IconButton
            icon={<FiArrowLeft size={26} />}
            variant="ghost"
            onClick={() => navigate('/chats')}
            aria-label="Back"
          />
          <Box position="absolute" left="50%" transform="translateX(-50%)" textAlign="center">
            <Text fontWeight="bold" fontSize="xl">
              {customer?.nickname || 'Customer'}
            </Text>
            {isTyping && (
              <Text fontSize="xs" color="purple.400">
                typing...
              </Text>
            )}
          </Box>
        </HStack>
      </Box>

      {/* Messages */}
      <Box
        position="fixed"
        top={`${customerBarHeight}px`}
        bottom={`${navBarHeight + inputBarHeight}px`}
        left={0}
        right={0}
        overflowY="auto"
        overscrollBehaviorY="contain"
        px={4}
        pt={4}
        pb={4}
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <VStack spacing={3} align="stretch">
          {isLoadingMore && (
            <Center py={2}>
              <Spinner size="sm" />
            </Center>
          )}
          {displayMessages.map((msg) => {
            const isManager = msg.sender?.role === 'manager';
            const isOrder = msg.messageType === 'order';
            const order = ordersByMessageId[msg._id];

            return (
              <Flex
                key={msg._id}
                justify={isManager ? 'flex-end' : 'flex-start'}
              >
                <Box
                  maxW="80%"
                  bg={
                    isManager
                      ? 'purple.500'
                      : colorMode === 'dark'
                      ? 'gray.700'
                      : 'white'
                  }
                  color={isManager ? 'white' : 'inherit'}
                  px={4}
                  py={2}
                  borderRadius="lg"
                  boxShadow="sm"
                >
                  {msg.messageType === 'image' && msg.attachments?.length ? (
                    <Image
                      src={msg.attachments[0]?.dataUrl || ''}
                      maxH="200px"
                      borderRadius="md"
                    />
                  ) : isOrder ? (
                    <VStack spacing={1} align="stretch">
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          colorScheme="purple"
                          variant="outline"
                          onClick={() => {
                            if (order?._id) {
                              navigate('/orders', { state: { openOrderId: order._id } });
                            }
                          }}
                          isDisabled={!order?._id}
                        >
                          Order #{(order?._id || msg._id).slice(-6).toUpperCase()}
                        </Button>
                        {order?.status && (
                          <Badge
                            colorScheme={order.status === 'pending' ? 'yellow' : order.status === 'completed' ? 'green' : 'red'}
                            fontSize="xs"
                          >
                            {order.status}
                          </Badge>
                        )}
                      </HStack>
                      {order?.status === 'pending' && (
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleCancelOrder(order._id)}
                          isLoading={cancelOrderMutation.isPending}
                        >
                          Cancel Order
                        </Button>
                      )}
                    </VStack>
                  ) : (
                    <Text>{msg.content}</Text>
                  )}
                  <HStack justify="flex-end" spacing={1} mt={1}>
                    <Text fontSize="xs" opacity={0.7}>
                      {formatRelativeTime(msg.createdAt)}
                    </Text>
                    {isManager && (
                      msg.readAt ? (
                        <FiCheckCircle size={12} />
                      ) : (
                        <FiCheck size={12} />
                      )
                    )}
                  </HStack>
                </Box>
              </Flex>
            );
          })}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input */}
      <Box
        p={4}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderTopWidth={1}
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        position="fixed"
        bottom={`${navBarHeight}px`}
        left={0}
        right={0}
        zIndex={99}
        minH={`${inputBarHeight}px`}
      >
        <HStack>
          <Input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            display="none"
          />
          <IconButton
            icon={<FiImage />}
            variant="ghost"
            onClick={() => fileInputRef.current.click()}
            aria-label="Send image"
          />
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={handleTypingStart}
            onBlur={handleTypingEnd}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <IconButton
            icon={<FiSend />}
            colorScheme="purple"
            onClick={handleSend}
            isLoading={sendMutation.isPending}
            aria-label="Send"
          />
        </HStack>
      </Box>
      <ConfirmDialog />
    </Box>
  );
};

export default ChatDetail;
