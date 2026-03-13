import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMinus, FiPlus, FiTrash2, FiShoppingBag } from 'react-icons/fi';
import { useCartStore, useChatStore } from '../stores';
import { useSocket } from '../context/SocketContext';
import { chatService } from '../services';
import { useToast } from '../components/ToastProvider';

const CartItem = ({ item, index, onUpdateQuantity, onRemove }) => {
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block' }}>{item.productName}</strong>
          <small style={{ opacity: 0.7 }}>
            {item.strain && `${item.strain} • `}
            {item.weight}
          </small>
        </div>
        <button type="button" className="button secondary" onClick={() => onRemove(index)}>
          <FiTrash2 />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="button secondary" onClick={() => onUpdateQuantity(index, item.quantity - 1)}>
            <FiMinus />
          </button>
          <strong>{item.quantity}</strong>
          <button type="button" className="button secondary" onClick={() => onUpdateQuantity(index, item.quantity + 1)}>
            <FiPlus />
          </button>
        </div>
        <strong>${((parseFloat(item.priceEach) || 0) * item.quantity).toFixed(2)}</strong>
      </div>
    </div>
  );
};

const Cart = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const { setConversation } = useChatStore();
  const { sendMessage } = useSocket();

  const total = getTotal();

  const handleCheckout = async () => {
    setIsSubmitting(true);

    try {
      // Get or create conversation
      const { conversation } = await chatService.getOrCreateConversation();
      setConversation(conversation);

      // Prepare order data
      const orderData = {
        items: items.map((item) => ({
          productType: item.productType,
          productId: item.productId,
          productName: item.productName,
          strain: item.strain,
          weight: item.weight,
          quantity: item.quantity,
          priceEach: parseFloat(item.priceEach) || 0,
          priceTotal: (parseFloat(item.priceEach) || 0) * item.quantity,
        })),
        orderTotal: total,
      };

      const content = 'I just placed an order.';

      // Send order message via socket
      sendMessage(conversation._id, content, 'order', orderData);

      // Clear cart
      clearCart();

      toast({
        title: 'Order submitted!',
        description: 'Your order has been sent to the manager.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Navigate to chat
      navigate('/chat');
    } catch (error) {
      toast({
        title: 'Error submitting order',
        description: error.message || 'Please try again',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
        <FiShoppingBag size={64} />
        <p>Your cart is empty</p>
        <button className="button" onClick={() => navigate('/')}>Browse Categories</button>
      </div>
    );
  }

  return (
    <section className="page" style={{ paddingBottom: 150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Cart</h2>
        <button className="button secondary" onClick={clearCart}>Clear All</button>
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {items.map((item, index) => (
          <CartItem
            key={`${item.productId}-${item.weight}-${item.strain}-${index}`}
            item={item}
            index={index}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
          />
        ))}
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 70,
          left: 0,
          right: 0,
          padding: 16,
        }}
      >
        <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Total</strong>
          <strong>${total.toFixed(2)}</strong>
          <button className="button" onClick={() => setIsConfirmOpen(true)}>
            Checkout
          </button>
        </div>
      </div>

      {isConfirmOpen ? (
        <div className="modal-backdrop" onClick={() => setIsConfirmOpen(false)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Confirm Order</h3>
            <p>Your order of ${total.toFixed(2)} will be sent to the manager for confirmation.</p>
            <p>You&apos;ll be able to chat with them about your order.</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="button secondary" onClick={() => setIsConfirmOpen(false)}>
                Cancel
              </button>
              <button className="button" onClick={handleCheckout} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Order'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Cart;
