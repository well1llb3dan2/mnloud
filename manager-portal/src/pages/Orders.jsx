import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorMode,
  useToast,
  Spinner,
  Center,
  Badge,
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Button,
  Divider,
} from '@chakra-ui/react';
import { format } from 'date-fns';
import { orderService } from '../services';
import { useConfirmDialog } from '../components/ConfirmDialog';

const statusColors = {
  pending: 'yellow',
  completed: 'green',
};

const getItemTotal = (item) => {
  if (typeof item.priceTotal === 'number') return item.priceTotal;
  if (typeof item.priceEach === 'number' && typeof item.quantity === 'number') {
    return item.priceEach * item.quantity;
  }
  return 0;
};

const getOrderTotal = (order) => {
  if (typeof order.total === 'number') return order.total;
  if (Array.isArray(order.items)) {
    return order.items.reduce((sum, item) => sum + getItemTotal(item), 0);
  }
  return 0;
};

const categoryLabels = {
  flower: 'Flower',
  disposable: 'Disposables',
  concentrate: 'Concentrates',
  edible: 'Edibles',
};

const groupItemsByCategory = (items = []) =>
  items.reduce((acc, item) => {
    const key = item.productType || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

const Orders = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const location = useLocation();
  const [autoOpenId, setAutoOpenId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => orderService.getAll(statusFilter ? { status: statusFilter } : {}),
  });

  const orders = data?.orders || [];

  useEffect(() => {
    const openId = location.state?.openOrderId;
    if (openId) {
      setAutoOpenId(openId);
    }
  }, [location.state]);

  useEffect(() => {
    if (!autoOpenId || orders.length === 0) return;
    const target = orders.find((order) => order._id === autoOpenId);
    if (target) {
      handleViewOrder(target);
      setAutoOpenId(null);
    }
  }, [autoOpenId, orders]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => orderService.updateStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orders']);
      if (data?.order) {
        setSelectedOrder((prev) => (prev?._id === data.order._id ? data.order : prev));
      }
      toast({ title: 'Order updated', status: 'success' });
    },
  });

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    onOpen();
  };

  const handleStatusChange = (orderId, newStatus) => {
    updateMutation.mutate({ id: orderId, status: newStatus });
  };

  if (isLoading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" color="purple.400" />
      </Center>
    );
  }

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="2xl" fontWeight="bold">
            Orders
          </Text>
          <Select
            maxW="150px"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Status"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </Select>
        </HStack>

        {orders.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No orders found</Text>
          </Center>
        ) : (
          orders.map((order) => (
            <Box
              key={order._id}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              p={4}
              borderRadius="lg"
              boxShadow="md"
              cursor="pointer"
              onClick={() => handleViewOrder(order)}
            >
              <HStack justify="space-between" mb={2}>
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold">
                    {order.customer?.nickname || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Customer'}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                  </Text>
                </VStack>
                <Badge colorScheme={statusColors[order.status]}>
                  {order.status}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="gray.500">
                {order.items?.length || 0} items • ${getOrderTotal(order).toFixed(2)}
              </Text>
            </Box>
          ))
        )}
      </VStack>

      {/* Order Detail Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>
            Order Details
            <Badge ml={2} colorScheme={statusColors[selectedOrder?.status]}>
              {selectedOrder?.status}
            </Badge>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedOrder && (
              <VStack align="stretch" spacing={4}>
                {/* Customer Info */}
                <Box>
                  <Text fontWeight="bold" mb={2}>
                    Customer
                  </Text>
                  <Text>
                    {selectedOrder.customer?.firstName}{' '}
                    {selectedOrder.customer?.lastName}
                  </Text>
                  {selectedOrder.customer?.nickname ? (
                    <Text fontSize="sm" color="gray.500">
                      {selectedOrder.customer?.nickname}
                    </Text>
                  ) : null}
                </Box>

                <Divider />

                {/* Items */}
                <Box>
                  <Text fontWeight="bold" mb={2}>
                    Items
                  </Text>
                  {Object.entries(groupItemsByCategory(selectedOrder.items || [])).map(([category, items]) => (
                    <Box key={category} mb={3}>
                      <Text fontSize="sm" fontWeight="semibold" color="gray.500" mb={1}>
                        {categoryLabels[category] || 'Other'}
                      </Text>
                      {items.map((item, idx) => (
                        <HStack key={`${category}-${idx}`} justify="space-between" py={2}>
                          <VStack align="start" spacing={0}>
                            <Text>{item.productName}</Text>
                            <Text fontSize="sm" color="gray.500">
                              {item.quantity}x @ ${item.priceEach ?? item.price ?? 0}
                            </Text>
                          </VStack>
                          <Text fontWeight="bold">
                            ${getItemTotal(item).toFixed(2)}
                          </Text>
                        </HStack>
                      ))}
                    </Box>
                  ))}
                </Box>

                <Divider />

                {/* Total */}
                <HStack justify="space-between">
                  <Text fontWeight="bold" fontSize="lg">
                    Total
                  </Text>
                  <Text fontWeight="bold" fontSize="lg" color="green.400">
                    ${getOrderTotal(selectedOrder).toFixed(2)}
                  </Text>
                </HStack>

                <Divider />

                {/* Status Update */}
                {selectedOrder.status === 'pending' ? (
                  <Button
                    colorScheme="green"
                    w="100%"
                    size="lg"
                    onClick={async () => {
                      const shouldUpdate = await confirm({
                        title: 'Complete order',
                        message: 'Mark this order as completed?',
                        confirmText: 'Complete',
                        cancelText: 'Cancel',
                      });
                      if (shouldUpdate) {
                        handleStatusChange(selectedOrder._id, 'completed');
                      }
                    }}
                    isLoading={updateMutation.isPending}
                  >
                    Mark Complete
                  </Button>
                ) : (
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    This order is completed.
                  </Text>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <Box>
                    <Text fontWeight="bold" mb={2}>
                      Notes
                    </Text>
                    <Text
                      p={3}
                      bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                      borderRadius="md"
                    >
                      {selectedOrder.notes}
                    </Text>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog />
    </Box>
  );
};

export default Orders;
