import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorMode,
  Spinner,
  Center,
  Badge,
  Avatar,
} from '@chakra-ui/react';
import { formatDistanceToNow } from 'date-fns';
import { chatService, orderService } from '../services';
import { useChatStore, useAuthStore } from '../stores';
import { useSocket } from '../context/SocketContext';
import { decryptMessage } from '../utils/e2ee';

const Chats = () => {
  const { colorMode } = useColorMode();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuthStore();
  const { conversations, setConversations, updateConversation, typingUsers } =
    useChatStore();

  const { isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await chatService.getConversations();
      const decryptedConversations = await Promise.all(
        (data.conversations || []).map(async (conversation) => {
          if (!conversation?.lastMessage) return conversation;
          const decryptedLast = await decryptMessage({
            message: conversation.lastMessage,
            userId: user?._id,
          });
          return { ...conversation, lastMessage: decryptedLast };
        })
      );
      setConversations(decryptedConversations);
      return { ...data, conversations: decryptedConversations };
    },
  });

  const { data: pendingOrdersData } = useQuery({
    queryKey: ['orders', 'pending', 'contacts'],
    queryFn: () => orderService.getAll({ status: 'pending', limit: 500 }),
  });

  const { data: confirmedOrdersData } = useQuery({
    queryKey: ['orders', 'confirmed', 'contacts'],
    queryFn: () => orderService.getAll({ status: 'confirmed', limit: 500 }),
  });

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      updateConversation(message.conversationId, {
        lastMessage: message,
        updatedAt: new Date().toISOString(),
      });
      refetch();
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [socket, updateConversation, refetch]);

  if (isLoading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" color="purple.400" />
      </Center>
    );
  }

  const getLastMessageTime = (conversation) => {
    const ts =
      conversation.lastMessageAt ||
      conversation.lastMessage?.createdAt ||
      conversation.updatedAt ||
      conversation.createdAt;
    return ts ? new Date(ts).getTime() : 0;
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    const aUnread = (a.unreadCount || 0) > 0;
    const bUnread = (b.unreadCount || 0) > 0;
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    return getLastMessageTime(b) - getLastMessageTime(a);
  });

  const pendingByCustomer = (pendingOrdersData?.orders || []).reduce((acc, order) => {
    const id = order.customer?._id;
    if (!id) return acc;
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  const confirmedByCustomer = (confirmedOrdersData?.orders || []).reduce((acc, order) => {
    const id = order.customer?._id;
    if (!id) return acc;
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">
          Messages
        </Text>

        {sortedConversations.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No conversations yet</Text>
          </Center>
        ) : (
          sortedConversations.map((conversation) => {
            const customer = conversation.customer;
            const customerName = customer?.nickname || 'Customer';
            const isTyping = typingUsers[conversation._id];
            const unread = conversation.unreadCount || 0;
            const pendingCount = pendingByCustomer[customer?._id] || 0;
            const confirmedCount = confirmedByCustomer[customer?._id] || 0;
            const lastMessage = conversation.lastMessage;
            const lastMessageText = !lastMessage
              ? 'No messages yet'
              : lastMessage.messageType === 'image'
                ? '📷 Image'
                : lastMessage.content || '🔒 Encrypted message';

            return (
              <Box
                key={conversation._id}
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                p={4}
                borderRadius="lg"
                boxShadow="md"
                cursor="pointer"
                onClick={() => navigate(`/chats/${conversation._id}`)}
                transition="all 0.2s"
                _hover={{
                  transform: 'scale(1.01)',
                  boxShadow: 'lg',
                }}
                position="relative"
              >
                <HStack spacing={4}>
                  <Avatar name={customerName} size="md" />
                  <VStack align="start" flex={1} spacing={0}>
                    <HStack justify="space-between" w="100%">
                      <Text fontWeight="bold">
                        {customerName}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {conversation.lastMessage?.createdAt
                          ? formatDistanceToNow(
                              new Date(conversation.lastMessage.createdAt),
                              { addSuffix: true }
                            )
                          : ''}
                      </Text>
                    </HStack>
                    {isTyping ? (
                      <Text fontSize="sm" color="purple.400" fontStyle="italic">
                        typing...
                      </Text>
                    ) : (
                      <Text
                        fontSize="sm"
                        color="gray.500"
                        noOfLines={1}
                        maxW="200px"
                      >
                        {lastMessageText}
                      </Text>
                    )}
                  </VStack>
                  <VStack align="end" spacing={1}>
                    {unread > 0 && (
                      <Badge
                        colorScheme="purple"
                        borderRadius="full"
                        px={2}
                        py={1}
                      >
                        {unread}
                      </Badge>
                    )}
                    <HStack spacing={1}>
                      {pendingCount > 0 && (
                        <Badge colorScheme="yellow" variant="subtle">
                          P {pendingCount}
                        </Badge>
                      )}
                      {confirmedCount > 0 && (
                        <Badge colorScheme="blue" variant="subtle">
                          C {confirmedCount}
                        </Badge>
                      )}
                    </HStack>
                  </VStack>
                </HStack>
              </Box>
            );
          })
        )}
      </VStack>
    </Box>
  );
};

export default Chats;
