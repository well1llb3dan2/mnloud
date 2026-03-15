import { create } from 'zustand';
import { cartService } from '../services';

export const useCartStore = create(
  (set, get) => ({
    items: [],
    isLoading: false,
    hasFetched: false,

    setItems: (items) => set({ items }),

    fetchCart: async () => {
      if (get().isLoading) return;
      set({ isLoading: true });
      try {
        const data = await cartService.getCart();
        set({ items: data.items || [], hasFetched: true });
      } catch (error) {
        console.error('Fetch cart error:', error);
      } finally {
        set({ isLoading: false });
      }
    },

    addItem: async (item) => {
      try {
        const data = await cartService.addItem(item);
        set({ items: data.items || [] });
        return { success: true };
      } catch (error) {
        const msg = error?.response?.data?.message || 'Failed to add item';
        const reason = error?.response?.data?.reason;
        return { success: false, message: msg, reason };
      }
    },

    removeItem: async (index) => {
      try {
        const data = await cartService.removeItem(index);
        set({ items: data.items || [] });
      } catch (error) {
        console.error('Remove item error:', error);
      }
    },

    updateQuantity: async (index, quantity) => {
      try {
        const data = await cartService.updateItem(index, quantity);
        set({ items: data.items || [] });
      } catch (error) {
        console.error('Update quantity error:', error);
      }
    },

    clearCart: async () => {
      try {
        await cartService.clearCart();
        set({ items: [] });
      } catch (error) {
        console.error('Clear cart error:', error);
      }
    },

    validateCart: async () => {
      try {
        const data = await cartService.validateCart();
        set({ items: data.items || [] });
        return data.unavailableItems || [];
      } catch (error) {
        console.error('Validate cart error:', error);
        return [];
      }
    },

    markUnavailable: (productId, strainId, variantId) => {
      const { items } = get();
      const updated = items.map((item) => {
        const matchProduct = item.productId === productId;
        const matchStrain = strainId ? (item.strainId === strainId) : true;
        const matchVariant = variantId ? (item.variantId === variantId) : true;
        if (matchProduct && matchStrain && matchVariant) {
          return { ...item, unavailable: true };
        }
        return item;
      });
      set({ items: updated });
    },

    markProductUnavailable: (productId) => {
      const { items } = get();
      const updated = items.map((item) =>
        item.productId === productId ? { ...item, unavailable: true } : item
      );
      set({ items: updated });
    },

    getTotal: () => {
      const { items } = get();
      return items
        .filter((item) => !item.unavailable)
        .reduce((total, item) => total + (parseFloat(item.priceEach) || 0) * item.quantity, 0);
    },

    getItemCount: () => {
      const { items } = get();
      return items.reduce((count, item) => count + item.quantity, 0);
    },
  })
);
