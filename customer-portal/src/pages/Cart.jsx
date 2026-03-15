import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiMinus, FiPlus, FiTrash2, FiShoppingBag } from 'react-icons/fi';
import { useCartStore, useChatStore } from '../stores';
import { useSocket } from '../context/SocketContext';
import { chatService, productService } from '../services';
import { useToast } from '../components/ToastProvider';
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

const groupItemsByCategory = (items) =>
  items.reduce((acc, item, originalIndex) => {
    const key = item.productType || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...item, _originalIndex: originalIndex });
    return acc;
  }, {});

const CartItem = ({ item, onUpdateQuantity, onRemove, showPrice = true }) => {
  const isUnavailable = item.unavailable;
  const idx = item._originalIndex;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        ...(isUnavailable ? { opacity: 0.5 } : {}),
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {isUnavailable && (
          <small style={{ color: '#dc3232', fontWeight: 600, display: 'block', marginBottom: 2 }}>
            Unavailable
          </small>
        )}
        <span style={{ fontSize: 14 }}>
          <strong>{item.quantity}x</strong>{'  '}{formatItemLine(item)}
        </span>
      </div>
      {showPrice && (
        <strong style={{
          fontSize: 14,
          flexShrink: 0,
          ...(isUnavailable ? { textDecoration: 'line-through' } : {}),
        }}>
          ${((parseFloat(item.priceEach) || 0) * item.quantity).toFixed(2)}
        </strong>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          className="button secondary"
          style={{ padding: '4px 8px', fontSize: 12 }}
          disabled={isUnavailable}
          onClick={() => onUpdateQuantity(idx, item.quantity - 1)}
        >
          <FiMinus size={12} />
        </button>
        <button
          type="button"
          className="button secondary"
          style={{ padding: '4px 8px', fontSize: 12 }}
          disabled={isUnavailable}
          onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
        >
          <FiPlus size={12} />
        </button>
        <button
          type="button"
          className="button secondary"
          style={{ padding: '4px 8px', fontSize: 12 }}
          onClick={() => onRemove(idx)}
        >
          <FiTrash2 size={12} />
        </button>
      </div>
    </div>
  );
};

const Cart = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unavailableModal, setUnavailableModal] = useState(null);

  const { items, updateQuantity, removeItem, clearCart, getTotal, fetchCart, validateCart, isLoading } = useCartStore();
  const { setConversation } = useChatStore();
  const { sendMessage } = useSocket();

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAllProducts,
    staleTime: 5 * 60 * 1000,
  });

  const priceTierMap = useMemo(
    () => buildPriceTierMap(productsData?.flowers || []),
    [productsData]
  );

  const pricing = useMemo(
    () => optimizeFlowerPricing(items, priceTierMap),
    [items, priceTierMap]
  );

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const total = pricing.optimizedTotal;
  const hasUnavailable = items.some((item) => item.unavailable);
  const availableItems = items.filter((item) => !item.unavailable);

  const handleRemoveUnavailable = async () => {
    // Remove all unavailable items (in reverse to maintain indices)
    const unavailableIndices = items
      .map((item, i) => (item.unavailable ? i : -1))
      .filter((i) => i >= 0)
      .reverse();
    for (const idx of unavailableIndices) {
      await removeItem(idx);
    }
    setUnavailableModal(null);
  };

  const handleCheckout = async () => {
    setIsSubmitting(true);

    try {
      // Validate cart before submitting
      const unavailable = await validateCart();
      if (unavailable.length > 0) {
        setUnavailableModal(unavailable);
        setIsConfirmOpen(false);
        setIsSubmitting(false);
        return;
      }

      if (availableItems.length === 0) {
        toast({
          title: 'Cart is empty',
          description: 'No available items to order.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        setIsSubmitting(false);
        setIsConfirmOpen(false);
        return;
      }

      // Get or create conversation
      const { conversation } = await chatService.getOrCreateConversation();
      setConversation(conversation);

      // Prepare order data (only available items)
      const orderData = {
        items: availableItems.map((item) => ({
          productType: item.productType,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          strain: item.strain,
          strainId: item.strainId,
          strainType: item.strainType,
          strain2: item.strain2,
          strainType2: item.strainType2,
          variant: item.variant,
          variantId: item.variantId,
          weight: item.weight,
          priceTierId: item.priceTierId,
          quantity: item.quantity,
          priceEach: parseFloat(item.priceEach) || 0,
          priceTotal: (parseFloat(item.priceEach) || 0) * item.quantity,
        })),
        orderTotal: pricing.optimizedTotal,
      };

      const content = 'I just placed an order.';

      // Send order message via socket
      sendMessage(conversation._id, content, 'order', orderData);

      // Clear cart (server clears on successful order too)
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

  if (isLoading && items.length === 0) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
        <p>Loading cart...</p>
      </div>
    );
  }

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
        <span />
        <button className="button secondary" onClick={clearCart}>Clear All</button>
      </div>

      {hasUnavailable && (
        <div
          className="panel"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(220, 50, 50, 0.1)',
            border: '1px solid rgba(220, 50, 50, 0.3)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <small style={{ color: '#dc3232' }}>
            Some items are no longer available.
          </small>
          <button
            className="button secondary"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={handleRemoveUnavailable}
          >
            Remove all
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        {Object.entries(groupItemsByCategory(items)).map(([category, categoryItems]) => (
          <div
            key={category}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              maxWidth: 480,
              marginLeft: 'auto',
              marginRight: 'auto',
              width: '100%',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--surface-light)',
                borderBottom: '1px solid var(--border)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {categoryLabels[category] || 'Other'}
            </div>
            {categoryItems.map((item, idx) => (
              <div key={`${category}-${idx}`}>
                {idx > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}
                <CartItem
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  showPrice={category !== 'flower'}
                />
              </div>
            ))}
            {pricing.categorySubtotals[category] != null && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  fontSize: 14,
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
                    fontSize: 12,
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
          <button
            className="button"
            disabled={availableItems.length === 0}
            onClick={() => setIsConfirmOpen(true)}
          >
            Checkout
          </button>
        </div>
      </div>

      {isConfirmOpen ? (
        <div className="modal-backdrop" onClick={() => setIsConfirmOpen(false)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Confirm Order</h3>
            <p>Your order of ${total.toFixed(2)} will be sent to the manager for confirmation.</p>
            {hasUnavailable && (
              <p style={{ color: '#dc3232', fontSize: 14 }}>
                Unavailable items will not be included in your order.
              </p>
            )}
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

      {unavailableModal ? (
        <div className="modal-backdrop" onClick={() => setUnavailableModal(null)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Items Unavailable</h3>
            <p style={{ marginBottom: 12 }}>The following items are no longer available:</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {unavailableModal.map((entry, i) => (
                <div
                  key={i}
                  className="panel"
                  style={{ padding: '8px 12px', fontSize: 14 }}
                >
                  <strong>{entry.item?.productName || 'Item'}</strong>
                  {entry.item?.strain && <span> — {entry.item.strain}</span>}
                  {entry.item?.variant && <span> — {entry.item.variant}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="button secondary" onClick={() => setUnavailableModal(null)}>
                Back to Cart
              </button>
              <button
                className="button secondary"
                onClick={async () => {
                  await handleRemoveUnavailable();
                  setUnavailableModal(null);
                }}
              >
                Remove Unavailable
              </button>
              <button className="button" onClick={() => { setUnavailableModal(null); navigate('/'); }}>
                Browse Shop
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Cart;
