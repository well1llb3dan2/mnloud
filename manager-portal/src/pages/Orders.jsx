import { useEffect, useState, useMemo } from 'react';
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
import { orderService, productService } from '../services';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { optimizeFlowerPricing, buildPriceTierMap } from '../utils/tierOptimizer';

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

const strainTypeLabel = (st) => {
  if (!st) return '';
  const map = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid', 'hybrid-s': 'Hybrid-S', 'hybrid-i': 'Hybrid-I' };
  return map[st] || st;
};

const formatItemLine = (item) => {
  const parts = [];
  // Brand (concentrates, disposables, edibles)
  if (item.brand) parts.push(item.brand);
  // Product name
  parts.push(item.productName);

  if (item.productType === 'flower') {
    if (item.strainType) parts.push(`(${strainTypeLabel(item.strainType)})`);
    if (item.weight) parts.push(`— ${item.weight}`);
  } else if (item.productType === 'concentrate' || item.productType === 'disposable') {
    if (item.strain) {
      const strainText = item.strain2
        ? `${item.strain} / ${item.strain2}`
        : item.strain;
      parts.push(`— ${strainText}`);
    }
    if (item.strainType) {
      const typeText = item.strainType2
        ? `${strainTypeLabel(item.strainType)} / ${strainTypeLabel(item.strainType2)}`
        : strainTypeLabel(item.strainType);
      parts.push(`(${typeText})`);
    }
    if (item.weight) parts.push(`${item.weight}`);
  } else if (item.productType === 'edible') {
    if (item.variant) parts.push(`— ${item.variant}`);
    if (item.weight) parts.push(`${item.weight}`);
  }

  return parts.join(' ');
};

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

  const { data: flowersData } = useQuery({
    queryKey: ['flowers'],
    queryFn: productService.getFlowers,
    staleTime: 5 * 60 * 1000,
  });

  const priceTierMap = useMemo(
    () => buildPriceTierMap(flowersData || []),
    [flowersData]
  );

  const selectedPricing = useMemo(
    () => selectedOrder ? optimizeFlowerPricing(selectedOrder.items || [], priceTierMap) : null,
    [selectedOrder, priceTierMap]
  );

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
                  <Text fontWeight="bold" mb={3}>
                    Items
                  </Text>
                  {Object.entries(groupItemsByCategory(selectedOrder.items || [])).map(([category, items]) => (
                    <Box
                      key={category}
                      mb={4}
                      border="1px solid"
                      borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                      borderRadius="lg"
                      overflow="hidden"
                    >
                      <Box
                        px={3}
                        py={2}
                        bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                        borderBottom="1px solid"
                        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                      >
                        <Text fontSize="sm" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                          {categoryLabels[category] || 'Other'}
                        </Text>
                      </Box>
                      <VStack align="stretch" spacing={0} divider={<Divider borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'} />}>
                        {items.map((item, idx) => (
                          <HStack key={`${category}-${idx}`} justify="space-between" px={3} py={3}>
                            <Text flex={1} fontSize="sm">
                              <Text as="span" fontWeight="semibold">{item.quantity}x</Text>
                              {'  '}
                              {formatItemLine(item)}
                            </Text>
                            <Text fontWeight="bold" fontSize="sm" flexShrink={0} ml={3}>
                              ${getItemTotal(item).toFixed(2)}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                      {category === 'flower' && selectedPricing && selectedPricing.flowerDiscount > 0.01 && (
                        <HStack
                          justify="space-between"
                          px={3}
                          py={2}
                          borderTop="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                        >
                          <Text fontSize="sm" color="green.400">Bulk discount</Text>
                          <Text fontSize="sm" color="green.400" fontWeight="semibold">
                            −${selectedPricing.flowerDiscount.toFixed(2)}
                          </Text>
                        </HStack>
                      )}
                      {selectedPricing && selectedPricing.categorySubtotals[category] != null && (
                        <HStack
                          justify="space-between"
                          px={3}
                          py={2}
                          borderTop="1px solid"
                          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                        >
                          <Text fontSize="sm" fontWeight="bold">Subtotal</Text>
                          <Text fontSize="sm" fontWeight="bold">
                            ${selectedPricing.categorySubtotals[category].toFixed(2)}
                          </Text>
                        </HStack>
                      )}
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
                    ${(selectedPricing ? selectedPricing.optimizedTotal : getOrderTotal(selectedOrder)).toFixed(2)}
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
