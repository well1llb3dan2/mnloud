import { useQuery } from '@tanstack/react-query';
import { orderService } from '../services';

const OrderItem = ({ order }) => {
  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Order #{order._id.slice(-6).toUpperCase()}</strong>
          <span style={{ textTransform: 'capitalize' }}>{order.status}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, opacity: 0.8 }}>
          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
          <strong>${order.total.toFixed(2)}</strong>
        </div>
      </summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {order.items.map((item, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div>{item.productName}</div>
              <small style={{ opacity: 0.7 }}>
                {item.strain && `${item.strain} • `}
                {item.weight} × {item.quantity}
              </small>
            </div>
            <div>${item.priceTotal.toFixed(2)}</div>
          </div>
        ))}
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
            <OrderItem key={order._id} order={order} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Orders;
