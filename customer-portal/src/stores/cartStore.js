import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item) => {
        const { items } = get();
        const existingIndex = items.findIndex(
          (i) => 
            i.productId === item.productId && 
            i.productType === item.productType &&
            i.weight === item.weight &&
            i.strain === item.strain
        );

        if (existingIndex >= 0) {
          const newItems = [...items];
          newItems[existingIndex].quantity += item.quantity || 1;
          set({ items: newItems });
        } else {
          set({ items: [...items, { ...item, quantity: item.quantity || 1 }] });
        }
      },

      removeItem: (index) => {
        const { items } = get();
        set({ items: items.filter((_, i) => i !== index) });
      },

      updateQuantity: (index, quantity) => {
        const { items } = get();
        if (quantity < 1) {
          set({ items: items.filter((_, i) => i !== index) });
        } else {
          const newItems = [...items];
          newItems[index].quantity = quantity;
          set({ items: newItems });
        }
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + (parseFloat(item.priceEach) || 0) * item.quantity, 0);
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'customer-cart',
    }
  )
);
