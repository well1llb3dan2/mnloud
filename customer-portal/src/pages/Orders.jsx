import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderService, productService } from '../services';
import { optimizeFlowerPricing, buildPriceTierMap } from '../utils/tierOptimizer';

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
      const strainText = item.strain2 ? `${item.strain} / ${item.strain2}` : item.strain;
      parts.push(`— ${strainText}`);
    }
    if (item.strainType) {
      const typeText = item.strainType2
        ? `${strainTypeLabel(item.strainType)} / ${strainTypeLabel(item.strainType2)}`
        : strainTypeLabel(item.strainType);
      parts.push(`(${typeText})`);
    }
    if (item.weight) parts.push(item.weight);
  } else if (item.productType === 'edible') {
    if (item.variant) parts.push(`— ${item.variant}`);
    if (item.weight) parts.push(item.weight);
  }
  return parts.join(' ');
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

const OrderItem = ({ order, priceTierMap }) => {
  const pricing = useMemo(
    () => optimizeFlowerPricing(order.items || [], priceTierMap),
    [order.items, priceTierMap]
  );
  const orderTotal = typeof order.total === 'number' ? order.total : pricing.optimizedTotal;

  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Order #{order._id.slice(-6).toUpperCase()}</strong>
          <span style={{ textTransform: 'capitalize' }}>{order.status}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, opacity: 0.8 }}>
          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          <strong>${orderTotal.toFixed(2)}</strong>
        </div>
      </summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        {Object.entries(groupItemsByCategory(order.items)).map(([category, items]) => (
          <div
            key={category}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--surface-light)',
                borderBottom: '1px solid var(--border)',
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
                {idx > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', gap: 8 }}>
                  <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                    <strong>{item.quantity}x</strong>{'  '}{formatItemLine(item)}
                  </span>
                  {category !== 'flower' && (
                    <strong style={{ fontSize: 13, flexShrink: 0 }}>
                      ${getItemTotal(item).toFixed(2)}
                    </strong>
                  )}
                </div>
              </div>
            ))}
            {pricing.categorySubtotals[category] != null && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  <span>Subtotal</span>
                  <span>${pricing.categorySubtotals[category].toFixed(2)}</span>
                </div>
                {category === 'flower' && pricing.flowerDiscount > 0.01 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '2px 12px 8px',
                    fontSize: 11,
                    color: '#2e7d32',
                  }}>
                    <span>Bulk discount</span>
                    <span>−${pricing.flowerDiscount.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <strong>Total</strong>
          <strong>${orderTotal.toFixed(2)}</strong>
        </div>
      </div>
    </details>
  );
};

const Orders = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await orderService.getMyOrders();
      return response.orders;
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAllProducts,
    staleTime: 5 * 60 * 1000,
  });

  const priceTierMap = useMemo(
    () => buildPriceTierMap(productsData?.flowers || []),
    [productsData]
  );

  if (isLoading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="panel">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="panel">Error loading orders</div>
      </div>
    );
  }

  const orders = data || [];

  return (
    <section className="page">
      {orders.length === 0 ? (
        <div className="panel" style={{ marginTop: 16, textAlign: 'center' }}>
          No orders yet
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {orders.map((order) => (
            <OrderItem key={order._id} order={order} priceTierMap={priceTierMap} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Orders;
