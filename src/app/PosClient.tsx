// src/app/PosClient.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { PaymentPanel } from '@/components/pos/PaymentPanel';
import { useToast } from '@/components/ui/Toast';
import type { CompletedTransaction, CartItem } from '@/hooks/usePayment';

type Product = {
  id: string;
  sku: string;
  name: string;
  priceRetail: number;
  priceWholesale: number | null;
  wholesaleMinQty: number | null;
  stock: number;
};
type Member = { id: string; name: string; phone: string };

interface PosClientProps {
  products: Product[];
  members: Member[];
}

// Format Rupiah util
const formatRp = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function PosClient({ products, members }: PosClientProps) {
  const { items, total, addItem, removeItem, updateQuantity, clearCart } = useCartStore();
  const [searchInput, setSearchInput] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [lastTx, setLastTx] = useState<CompletedTransaction | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Fokus ke scanner setiap kali keranjang berubah
  useEffect(() => {
    if (lastTx === null) {
      searchInputRef.current?.focus();
    }
  }, [items, lastTx]);

  // Logika Scanner & Pencarian Manual
  const handleScanOrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    const foundProduct = products.find(
      (p) =>
        p.sku === searchInput ||
        p.name.toLowerCase() === searchInput.toLowerCase()
    );

    if (foundProduct) {
      let finalPrice = foundProduct.priceRetail;
      const currentQtyInCart =
        items.find((i) => i.productId === foundProduct.id)?.quantity || 0;
      const newQty = currentQtyInCart + 1;

      if (foundProduct.stock < newQty) {
        toast.error(`Stok ${foundProduct.name} tidak mencukupi (Sisa: ${foundProduct.stock})`);
        setSearchInput('');
        return;
      }

      if (
        foundProduct.priceWholesale &&
        foundProduct.wholesaleMinQty &&
        newQty >= foundProduct.wholesaleMinQty
      ) {
        finalPrice = foundProduct.priceWholesale;
        const existingItem = items.find((i) => i.productId === foundProduct.id);
        if (existingItem) updateQuantity(existingItem.id, newQty);
      }

      addItem({ productId: foundProduct.id, name: foundProduct.name, price: finalPrice, quantity: 1 });
      setSearchInput('');
    } else {
      toast.warning(`Produk "${searchInput}" tidak ditemukan.`);
      setSearchInput('');
    }
  };

  // Dipanggil PaymentPanel setelah transaksi berhasil disimpan
  const handleTransactionComplete = (tx: CompletedTransaction) => {
    setLastTx(tx);
    toast.success(`Transaksi ${tx.receiptNumber} berhasil!`, 3000);
  };

  // Reset semua state ke kondisi awal (siap transaksi baru)
  const handleNewTransaction = () => {
    clearCart();
    setSelectedMember(null);
    setLastTx(null);
    // Fokus ke scanner setelah reset
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Wrapper untuk updateQuantity agar memvalidasi stok
  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    const item = items.find((i) => i.id === cartItemId);
    if (!item) return;
    
    // Jika menambah quantity, pastikan stok cukup
    if (newQty > item.quantity) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.stock < newQty) {
        toast.error(`Stok ${product.name} tidak mencukupi (Sisa: ${product.stock})`);
        return;
      }
    }
    
    updateQuantity(cartItemId, newQty);
  };

  // Konversi CartItem dari store ke format yang dipahami PaymentPanel
  const paymentItems: CartItem[] = items.map((i) => ({
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    subtotal: i.subtotal,
  }));

  const isLocked = lastTx !== null;

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden p-margin-desktop gap-4">

      {/* ══════════════════════════════
          KIRI: Keranjang Belanja
      ══════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Input Barcode Scanner */}
        <form
          onSubmit={handleScanOrSearch}
          className="relative bg-surface rounded-xl border border-border focus-pulse p-2 flex gap-2 shrink-0"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              barcode_scanner
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              disabled={isLocked}
              placeholder="Scan Barcode atau ketik SKU produk di sini…"
              className="w-full bg-background border-none rounded-lg h-12 pl-12 pr-4 text-text-primary focus:ring-0 font-mono disabled:opacity-50"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isLocked}
            className="bg-surface-container-high px-4 rounded-lg text-text-primary hover:bg-surface-bright transition-colors font-medium disabled:opacity-50"
          >
            Tambah
          </button>
        </form>

        {/* Member Selector */}
        <div className="bg-surface border border-border rounded-xl px-4 py-3 shrink-0">
          <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1.5 block">
            Pelanggan Member
          </label>
          <select
            onChange={(e) =>
              setSelectedMember(members.find((m) => m.id === e.target.value) || null)
            }
            value={selectedMember?.id || ''}
            disabled={isLocked}
            className="w-full bg-background border border-border rounded-lg h-10 px-3 text-text-primary focus:border-primary-container text-sm disabled:opacity-50"
          >
            <option value="">— Pelanggan Umum —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.phone})
              </option>
            ))}
          </select>
        </div>

        {/* Tabel Keranjang */}
        <div className="flex-1 bg-surface border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container-low border-b border-border z-10">
                <tr>
                  <th className="py-3 px-4 text-text-secondary font-medium text-sm">Produk</th>
                  <th className="py-3 px-4 text-text-secondary font-medium text-sm w-28 text-center">Qty</th>
                  <th className="py-3 px-4 text-text-secondary font-medium text-sm text-right">Harga</th>
                  <th className="py-3 px-4 text-text-secondary font-medium text-sm text-right">Subtotal</th>
                  <th className="py-3 px-4 w-10" />
                </tr>
              </thead>
              <tbody className="text-sm">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-14 text-text-secondary">
                      <span className="material-symbols-outlined text-[48px] opacity-20 block mx-auto mb-2">
                        shopping_cart
                      </span>
                      Keranjang kosong. Mulai scan produk.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 hover:bg-surface-container-high"
                    >
                      <td className="py-3 px-4 font-medium text-text-primary">{item.name}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!isLocked && (
                            <button
                              onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                              className="w-7 h-7 rounded bg-surface-variant flex items-center justify-center hover:text-primary text-lg leading-none"
                            >
                              −
                            </button>
                          )}
                          <span className="w-8 text-center font-mono">{item.quantity}</span>
                          {!isLocked && (
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 rounded bg-surface-variant flex items-center justify-center hover:text-primary text-lg leading-none"
                            >
                              +
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-text-secondary">{formatRp(item.price)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-primary-container">
                        {formatRp(item.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {!isLocked && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-text-secondary hover:text-danger transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          {items.length > 0 && (
            <div className="shrink-0 border-t border-border px-4 py-3 bg-surface-container-low flex justify-between items-center">
              <span className="text-text-secondary text-sm">
                {items.reduce((s, i) => s + i.quantity, 0)} item
              </span>
              <div className="text-right">
                <span className="text-text-secondary text-xs mr-2">TOTAL</span>
                <span className="text-2xl font-bold text-text-primary font-mono">
                  {formatRp(total)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════
          KANAN: Payment Panel
      ══════════════════════════════ */}
      <div className="w-full lg:w-[380px] shrink-0 flex flex-col">
        <PaymentPanel
          total={total}
          items={paymentItems}
          memberId={selectedMember?.id}
          memberName={selectedMember?.name}
          disabled={items.length === 0}
          onTransactionComplete={handleTransactionComplete}
          onNewTransaction={handleNewTransaction}
        />
      </div>
    </div>
  );
}