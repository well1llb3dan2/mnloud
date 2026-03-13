import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  useColorMode,
  Spinner,
  Center,
  Badge,
  Icon,
  useBreakpointValue,
} from '@chakra-ui/react';
import { FiPackage, FiMessageCircle, FiClipboard, FiUsers, FiLink } from 'react-icons/fi';
import { chatService, orderService, userService, productService, inviteService } from '../services';
import { useChatStore, useAuthStore } from '../stores';

const StatCard = ({ icon, label, value, color, onClick }) => {
  const { colorMode } = useColorMode();
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      p={6}
      borderRadius="xl"
      boxShadow="lg"
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      transition="all 0.2s"
      _hover={onClick ? { transform: 'scale(1.02)' } : {}}
    >
      {isMobile ? (
        <HStack spacing={3} align="center">
          <Box p={2} borderRadius="full" bg={`${color}.500`}>
            <Icon as={icon} boxSize={5} color="white" />
          </Box>
          <Text flex={1} textAlign="center" fontWeight="semibold">
            {label}
          </Text>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Text fontSize="lg" fontWeight="bold">
              {value}
            </Text>
          ) : (
            <Box>
              {value}
            </Box>
          )}
        </HStack>
      ) : (
        <VStack spacing={3}>
          <Box p={3} borderRadius="full" bg={`${color}.500`}>
            <Icon as={icon} boxSize={6} color="white" />
          </Box>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Text fontSize="2xl" fontWeight="bold">
              {value}
            </Text>
          ) : (
            <Box>
              {value}
            </Box>
          )}
          <Text color="gray.500" fontSize="sm">
            {label}
          </Text>
        </VStack>
      )}
    </Box>
  );
};

const Dashboard = () => {
  const { colorMode } = useColorMode();
  const navigate = useNavigate();
  const totalUnread = useChatStore((state) => state.totalUnread);
  const setConversations = useChatStore((state) => state.setConversations);

  // Fetch conversations
  const { data: chatData, isLoading: isLoadingChats } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await chatService.getConversations();
      setConversations(data.conversations);
      return data;
    },
  });

  // Fetch orders
  const { data: orderData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: () => orderService.getAll({ status: 'pending' }),
  });

  // Fetch customers
  const { data: customerData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: userService.getCustomers,
  });

  // Fetch product counts
  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['productCounts'],
    queryFn: async () => {
      const [bulk, packaged, concentrates, edibles] = await Promise.all([
        productService.getBulkFlowers(),
        productService.getPackagedFlowers(),
        productService.getConcentrates(),
        productService.getEdibles(),
      ]);

      const countActive = (items = []) =>
        items.filter((item) => item.isActive !== false).length;

      return (
        countActive(bulk?.products) +
        countActive(packaged?.products) +
        countActive(concentrates?.products) +
        countActive(edibles?.products)
      );
    },
  });

  const pendingOrders = orderData?.orders?.length || 0;
  const totalCustomers = customerData?.customers?.length || 0;

  const { data: inviteData, isLoading: isLoadingInvites } = useQuery({
    queryKey: ['invites', 'active'],
    queryFn: inviteService.getAll,
  });

  const activeInvites = (inviteData?.invites || []).filter(
    (invite) => invite?.isUsed === false && (!invite?.expiresAt || new Date(invite.expiresAt) > new Date())
  ).length;

  return (
    <Box p={4}>
      <VStack spacing={6} align="stretch">
        {/* Stats */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <StatCard
            icon={FiMessageCircle}
            label="Unread Messages"
            value={isLoadingChats ? <Spinner size="sm" /> : totalUnread}
            color="purple"
            onClick={() => navigate('/chats')}
          />
          <StatCard
            icon={FiClipboard}
            label={
              <>
                Pending Orders
                <br />
                Confirmed Orders
              </>
            }
            value={isLoadingOrders ? <Spinner size="sm" /> : pendingOrders}
            color="orange"
            onClick={() => navigate('/orders')}
          />
          <StatCard
            icon={FiUsers}
            label="Customers"
            value={isLoadingCustomers ? <Spinner size="sm" /> : totalCustomers}
            color="blue"
            onClick={() => navigate('/users')}
          />
          <StatCard
            icon={FiPackage}
            label="Products"
            value={isLoadingProducts ? <Spinner size="sm" /> : (productData ?? 0)}
            color="green"
            onClick={() => navigate('/products')}
          />
          <StatCard
            icon={FiLink}
            label="Pending Invites"
            value={isLoadingInvites ? <Spinner size="sm" /> : activeInvites}
            color="purple"
            onClick={() => navigate('/invites')}
          />
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default Dashboard;
