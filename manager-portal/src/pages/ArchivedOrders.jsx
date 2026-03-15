import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  HStack,
  Text,
  useColorMode,
  Spinner,
  Center,
  Badge,
  Button,
} from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { format } from 'date-fns';
import { orderService, productService } from '../services';
import { optimizeFlowerPricing, buildPriceTierMap } from '../utils/tierOptimizer';

const statusColors = {
  pending: 'yellow',
  completed: 'green',
  cancelled: 'red',
};

const getItemTotal = (item) => {
  if (typeof item.priceTotal === 'number') return item.priceTotal;
  if (typeof item.priceEach === 'number' && typeof item.quantity === 'number') {
    return item.priceEach * item.quantity;
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
  if (item.brand) parts.push(item.brand);
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

const ArchivedOrders = () => {
  const { colorMode } = useColorMode();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'archived'],
    queryFn: () => orderService.getAll({ archived: true, limit: 200 }),
  });

  const { data: flowersData } = useQuery({
    queryKey: ['flowers'],
    queryFn: productService.getFlowers,
    staleTime: 5 * 60 * 1000,
  });

  const priceTierMap = useMemo(
    () => buildPriceTierMap(flowersData?.products || []),
    [flowersData]
  );

  const orders = data?.orders || [];

  if (isLoading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" color="purple.400" />
      </Center>
    );
  }

  const borderColor = colorMode === 'dark' ? '#4A5568' : '#E2E8F0';
  const surfaceBg = colorMode === 'dark' ? '#2D3748' : '#F7FAFC';
  const cardBg = colorMode === 'dark' ? '#1A202C' : '#FFFFFF';

  return (
    <Box p={4}>
      <HStack mb={4} spacing={3}>
        <Button size="sm" variant="ghost" onClick={() => navigate('/orders')} leftIcon={<FiArrowLeft />}>
          Back
        </Button>
        <Text fontSize="2xl" fontWeight="bold">Archived Orders</Text>
      </HStack>

      {orders.length === 0 ? (
        <Center h="200px">
          <Text color="gray.500">No archived orders</Text>
        </Center>
      ) : (
        <Box display="grid" gap={3}>
          {orders.map((order) => {
            const pricing = optimizeFlowerPricing(order.items || [], priceTierMap);
            const orderTotal = typeof order.total === 'number' ? order.total : pricing.optimizedTotal;
            const customerName = order.customer?.nickname
              || `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()
              || 'Customer';

            return (
              <details
                key={order._id}
                style={{
                  background: cardBg,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  overflow: 'hidden',
                }}
              >
                <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{customerName}</strong>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                        {format(new Date(order.createdAt), 'MMM d, yyyy — h:mm a')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Badge colorScheme={statusColors[order.status]}>{order.status}</Badge>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <strong>${orderTotal.toFixed(2)}</strong>
                        <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>
                          {order.items?.length || 0} items
                        </span>
                      </div>
                    </div>
                  </div>
                </summary>

                <div style={{ padding: '0 16px 16px', display: 'grid', gap: 12 }}>
                  {Object.entries(groupItemsByCategory(order.items)).map(([category, items]) => (
                    <div
                      key={category}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 12px',
                          background: surfaceBg,
                          borderBottom: `1px solid ${borderColor}`,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {categoryLabels[category] || 'Other'}
                      </div>
                      {items.map((item, idx) => (
                        <div key={idx}>
                          {idx > 0 && <div style={{ borderTop: `1px solid ${borderColor}` }} />}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', gap: 8 }}>
                            <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                              <strong>{item.quantity}x</strong>{'  '}{formatItemLine(item)}
                            </span>
                            <strong style={{ fontSize: 13, flexShrink: 0 }}>
                              ${getItemTotal(item).toFixed(2)}
                            </strong>
                          </div>
                        </div>
                      ))}
                      {category === 'flower' && pricing.flowerDiscount > 0.01 && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          borderTop: `1px solid ${borderColor}`,
                          fontSize: 12,
                          color: '#48BB78',
                        }}>
                          <span>Bulk discount</span>
                          <span style={{ fontWeight: 600 }}>−${pricing.flowerDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      {pricing.categorySubtotals[category] != null && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderTop: `1px solid ${borderColor}`,
                          background: surfaceBg,
                          fontSize: 13,
                          fontWeight: 700,
                        }}>
                          <span>Subtotal</span>
                          <span>${pricing.categorySubtotals[category].toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 16 }}>
                    <strong>Total</strong>
                    <strong style={{ color: '#48BB78' }}>${orderTotal.toFixed(2)}</strong>
                  </div>

                  {order.notes && (
                    <div style={{
                      padding: '8px 12px',
                      background: surfaceBg,
                      borderRadius: 8,
                      fontSize: 13,
                    }}>
                      <strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Notes</strong>
                      {order.notes}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ArchivedOrders;
