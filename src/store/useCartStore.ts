// src/store/useCartStore.ts
import { create } from 'zustand';

export interface CartItem {
  id: string; // ID unik untuk baris di keranjang
  productId: string; // ID produk dari database
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CartState {
  items: CartItem[];
  total: number;
  addItem: (item: Omit<CartItem, 'id' | 'subtotal'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  total: 0,
  
  // Fungsi untuk menambah barang (jika barang sudah ada, kuantitasnya ditambah)
  addItem: (newItem) => set((state) => {
    const existingItem = state.items.find((i) => i.productId === newItem.productId);
    
    if (existingItem) {
      const updatedItems = state.items.map((i) => 
        i.productId === newItem.productId 
          ? { ...i, quantity: i.quantity + newItem.quantity, subtotal: (i.quantity + newItem.quantity) * i.price }
          : i
      );
      return {
        items: updatedItems,
        total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0)
      };
    }

    const itemWithIdAndSubtotal: CartItem = {
      ...newItem,
      id: crypto.randomUUID(),
      subtotal: newItem.quantity * newItem.price
    };

    const newItems = [...state.items, itemWithIdAndSubtotal];
    return {
      items: newItems,
      total: newItems.reduce((sum, item) => sum + item.subtotal, 0)
    };
  }),

  // Fungsi untuk menghapus satu baris barang dari keranjang
  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((i) => i.id !== id);
    return {
      items: newItems,
      total: newItems.reduce((sum, item) => sum + item.subtotal, 0)
    };
  }),

  // Fungsi untuk mengubah kuantitas secara manual (misal diketik oleh kasir)
  updateQuantity: (id, quantity) => set((state) => {
    const newItems = state.items.map((i) => 
      i.id === id 
        ? { ...i, quantity, subtotal: quantity * i.price }
        : i
    );
    return {
      items: newItems,
      total: newItems.reduce((sum, item) => sum + item.subtotal, 0)
    };
  }),

  // Fungsi untuk mengosongkan keranjang setelah transaksi selesai
  clearCart: () => set({ items: [], total: 0 }),
}));