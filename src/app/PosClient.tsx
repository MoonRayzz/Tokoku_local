// src/app/PosClient.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react';
import { useCartStore } from '@/store/useCartStore';
import { PaymentPanel } from '@/components/pos/PaymentPanel';
import { useToast } from '@/components/ui/Toast';
import { useSync } from '@/context/SyncContext';
import { linkBarcodeToProduct } from '@/app/produk/actions';
import type { CompletedTransaction, CartItem } from '@/hooks/usePayment';

type Product = {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  priceRetail: number;
  priceWholesale: number | null;
  wholesaleMinQty: number | null;
  stock: number;
};
type Member = { id: string; name: string; phone: string };
type Employee = { id: string; name: string; role: string; };
type Shift = { id: string; name: string; startTime: string; endTime: string; };

type MemberTier = {
  id: string;
  name: string;
  minTransactions: number;
  minTotalSpent: number;
  minOrderAmount: number;
  discountPercentage: number;
  maxDiscountAmount: number;
};

interface PosClientProps {
  products: Product[];
  members: Member[];
  tiers: MemberTier[];
  memberStats: Record<string, { txCount: number, totalSpent: number, lastTxDate: string | null }>;
  employees: Employee[];
  shifts: Shift[];
  storeProfile: any;
}

// Format Rupiah util
const formatRp = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function PosClient({ products, members, tiers, memberStats, employees, shifts, storeProfile }: PosClientProps) {
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  useEffect(() => { setLocalProducts(products); }, [products]);

  const { items, total, addItem, removeItem, updateQuantity, clearCart } = useCartStore();
  const [searchInput, setSearchInput] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [lastTx, setLastTx] = useState<CompletedTransaction | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const memberDropdownRef = useRef<HTMLDivElement>(null);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const { triggerSync } = useSync();
  
  const [activeSession, setActiveSession] = useState<{ cashierName: string, shiftId: string } | null>(null);
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  
  // Offline Manual Mode
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualCashierName, setManualCashierName] = useState('');
  const [manualShiftName, setManualShiftName] = useState('');

  // Persist session across tabs & auto-logout when expired
  useEffect(() => {
    const checkSession = () => {
      const saved = localStorage.getItem('pos_session');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.expiresAt && Date.now() < data.expiresAt) {
            setActiveSession({ cashierName: data.cashierName, shiftId: data.shiftId });
          } else {
            localStorage.removeItem('pos_session');
            setActiveSession(null);
          }
        } catch (e) {
          localStorage.removeItem('pos_session');
          setActiveSession(null);
        }
      } else {
        setActiveSession(null);
      }
    };

    // Cek saat pertama kali load
    checkSession();

    // Cek setiap 1 menit agar auto-logout jika POS dibiarkan terbuka
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const toast = useToast();

  // Fokus ke scanner setiap kali keranjang berubah
  useEffect(() => {
    if (activeSession && lastTx === null && !memberSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [items, lastTx, memberSearchOpen, activeSession]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(event.target as Node)) {
        setMemberSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItemToProductCart = (foundProduct: Product) => {
    let finalPrice = foundProduct.priceRetail;
    const currentQtyInCart =
      items.find((i) => i.productId === foundProduct.id)?.quantity || 0;
    const newQty = currentQtyInCart + 1;

    if (foundProduct.stock < newQty) {
      toast.error(`Stok ${foundProduct.name} tidak mencukupi (Sisa: ${foundProduct.stock})`);
      return false;
    }

    if (
      foundProduct.priceWholesale &&
      foundProduct.wholesaleMinQty &&
      newQty >= foundProduct.wholesaleMinQty
    ) {
      finalPrice = foundProduct.priceWholesale;
    }

    const existingItem = items.find((i) => i.productId === foundProduct.id);
    if (existingItem) {
      updateQuantity(existingItem.id, newQty, finalPrice);
    } else {
      addItem({ productId: foundProduct.id, name: foundProduct.name, price: finalPrice, quantity: 1 });
    }
    return true;
  };

  // Logika Scanner & Pencarian Manual
  const handleScanOrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    // 1. Cari by BARCODE dulu, lalu SKU, lalu nama partial/exact
    const foundProduct = localProducts.find(
      (p) =>
        (p.barcode && p.barcode === query) ||
        p.sku === query ||
        p.name.toLowerCase() === query.toLowerCase()
    );

    if (foundProduct) {
      addItemToProductCart(foundProduct);
      setSearchInput('');
    } else {
      const foundMember = members.find(m => m.phone === query || m.id === query);
      if (foundMember) {
        setSelectedMember(foundMember);
        toast.success(`Member ${foundMember.name} berhasil dipilih.`);
        setSearchInput('');
        return;
      }

      // Cek apakah input terlihat seperti barcode scanner (angka/alphanumeric pendek tanpa spasi, min 4 max 25 char)
      const looksLikeBarcode = /^[A-Za-z0-9\-]{4,25}$/.test(query) && !query.includes(' ');
      if (looksLikeBarcode) {
        setUnknownBarcode(query);
        setSearchInput('');
      } else {
        toast.warning(`Produk atau Member "${query}" tidak ditemukan.`);
        setSearchInput('');
      }
    }
  };

  // Dipanggil PaymentPanel setelah transaksi berhasil disimpan
  const handleTransactionComplete = (tx: CompletedTransaction) => {
    setLastTx(tx);
    toast.success(`Transaksi ${tx.receiptNumber} berhasil!`, 3000);
    triggerSync(); // Panggil event-based sync (5s debounce)
  };

  // Reset semua state ke kondisi awal (siap transaksi baru)
  const handleNewTransaction = () => {
    clearCart();
    setSelectedMember(null);
    setLastTx(null);
    // Fokus ke scanner setelah reset
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Wrapper untuk updateQuantity agar memvalidasi stok dan harga grosir
  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    const item = items.find((i) => i.id === cartItemId);
    if (!item) return;
    
    const product = localProducts.find((p) => p.id === item.productId);
    
    // Jika menambah quantity, pastikan stok cukup
    if (newQty > item.quantity) {
      if (product && product.stock < newQty) {
        toast.error(`Stok ${product?.name || item.name} tidak mencukupi (Sisa: ${product?.stock || 0})`);
        return;
      }
    }
    
    // Hitung ulang harga jika ada aturan harga grosir
    let newPrice = item.price;
    if (product) {
      if (product.priceWholesale && product.wholesaleMinQty && newQty >= product.wholesaleMinQty) {
        newPrice = product.priceWholesale;
      } else {
        newPrice = product.priceRetail;
      }
    }
    
    updateQuantity(cartItemId, newQty, newPrice);
  };

  // Konversi CartItem dari store ke format yang dipahami PaymentPanel
  const paymentItems: CartItem[] = items.map((i) => ({
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    subtotal: i.subtotal,
  }));

  const handleStartSession = () => {
    if (isManualMode) {
      if (!manualCashierName.trim() || !manualShiftName.trim()) {
        toast.warning("Silakan isi Nama Kasir dan Shift manual!");
        return;
      }
      
      const expiresAt = new Date();
      expiresAt.setHours(23, 59, 59, 999); // Berlaku sampai akhir hari
      
      const sessionData = {
        cashierId: 'manual',
        cashierName: manualCashierName.trim(),
        shiftId: manualShiftName.trim(),
        shiftName: manualShiftName.trim(),
        expiresAt: expiresAt.getTime()
      };
      
      localStorage.setItem('pos_session', JSON.stringify(sessionData));
      setActiveSession({ cashierName: sessionData.cashierName, shiftId: sessionData.shiftId });
      setTimeout(() => searchInputRef.current?.focus(), 100);
      return;
    }

    if (!selectedCashierId || !selectedShiftId) {
      toast.warning("Silakan pilih Kasir dan Shift terlebih dahulu!");
      return;
    }
    const emp = employees.find(e => e.id === selectedCashierId);
    const shift = shifts.find(s => s.id === selectedShiftId);
    if (!emp || !shift) return;

    // Hitung expiresAt
    const now = new Date();
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const expiresAt = new Date(now);
    expiresAt.setHours(endH, endM, 0, 0);

    // Jika endTime sudah lewat hari ini, anggap ini shift malam yang berakhir besok
    if (expiresAt.getTime() <= now.getTime()) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    const sessionData = {
      cashierId: emp.id,
      cashierName: emp.name,
      shiftId: shift.id,
      shiftName: shift.name,
      expiresAt: expiresAt.getTime()
    };
    
    localStorage.setItem('pos_session', JSON.stringify(sessionData));
    setActiveSession({ cashierName: emp.name, shiftId: selectedShiftId });
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Hitung Diskon Member (Khusus Barang Reguler/Non-Grosir)
  let activeTier: MemberTier | null = null;
  let discountAmount = 0;
  
  // Pisahkan subtotal grosir dan reguler
  const { nonWholesaleTotal, wholesaleTotal } = items.reduce(
    (acc, item) => {
      const product = products.find((p) => p.id === item.productId);
      const isWholesale = product && product.priceWholesale && product.wholesaleMinQty && item.quantity >= product.wholesaleMinQty;
      if (isWholesale) {
        acc.wholesaleTotal += item.subtotal;
      } else {
        acc.nonWholesaleTotal += item.subtotal;
      }
      return acc;
    },
    { nonWholesaleTotal: 0, wholesaleTotal: 0 }
  );

  if (selectedMember) {
    const stats = memberStats[selectedMember.id] || { txCount: 0, totalSpent: 0 };
    activeTier = tiers.find((t) => {
      const meetsTx = t.minTransactions > 0 && stats.txCount >= t.minTransactions;
      const meetsSpent = t.minTotalSpent > 0 && stats.totalSpent >= t.minTotalSpent;
      if (t.minTransactions === 0 && t.minTotalSpent === 0) return true;
      return meetsTx || meetsSpent;
    }) || (tiers.length > 0 ? tiers[tiers.length - 1] : null);

    if (nonWholesaleTotal > 0 && activeTier && nonWholesaleTotal >= activeTier.minOrderAmount) {
      const calculatedDiscount = (nonWholesaleTotal * activeTier.discountPercentage) / 100;
      if (activeTier.maxDiscountAmount > 0 && calculatedDiscount > activeTier.maxDiscountAmount) {
        discountAmount = activeTier.maxDiscountAmount;
      } else {
        discountAmount = calculatedDiscount;
      }
    }
  }

  const getMemberTierUI = (memberId: string) => {
    const stats = memberStats[memberId] || { txCount: 0, totalSpent: 0 };
    const tier = tiers.find((t) => {
      const meetsTx = t.minTransactions > 0 && stats.txCount >= t.minTransactions;
      const meetsSpent = t.minTotalSpent > 0 && stats.totalSpent >= t.minTotalSpent;
      if (t.minTransactions === 0 && t.minTotalSpent === 0) return true;
      return meetsTx || meetsSpent;
    }) || (tiers.length > 0 ? tiers[tiers.length - 1] : null);
    
    if (!tier) return { label: 'TANPA LEVEL', color: 'bg-surface-bright text-text-secondary border-border' };

    const colors = [
      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      'bg-amber-500/15 text-amber-400 border-amber-500/30',
      'bg-blue-500/15 text-blue-400 border-blue-500/30',
      'bg-purple-500/15 text-purple-400 border-purple-500/30',
      'bg-pink-500/15 text-pink-400 border-pink-500/30',
    ];
    const idx = tiers.findIndex(t => t.id === tier.id);
    return { label: tier.name.toUpperCase(), color: colors[idx % colors.length] };
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
    m.phone.includes(memberSearchQuery)
  );

  const isLocked = lastTx !== null;

  const finalTotal = total - discountAmount;

  return (
    <div className="relative h-full w-full flex flex-col">
      {!activeSession && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-40 flex items-center justify-center p-4 rounded-tl-2xl">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-3xl">lock_person</span>
              </div>
              <h2 className="text-xl font-bold text-text-primary">Mulai Sesi Kasir</h2>
              <p className="text-sm text-text-secondary mt-1">Silakan pilih nama kasir dan jadwal shift Anda sebelum melayani pelanggan.</p>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer w-fit">
                <input 
                  type="checkbox" 
                  checked={isManualMode}
                  onChange={(e) => setIsManualMode(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="font-medium">Kasir belum sinkron? Input Manual</span>
              </label>

              {isManualMode ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">Nama Kasir (Manual)</label>
                    <input 
                      type="text"
                      placeholder="Masukkan nama kasir"
                      value={manualCashierName}
                      onChange={(e) => setManualCashierName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">Nama Shift (Manual)</label>
                    <input 
                      type="text"
                      placeholder="Misal: Pagi / Malam"
                      value={manualShiftName}
                      onChange={(e) => setManualShiftName(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">Nama Kasir</label>
                    <select 
                      value={selectedCashierId} 
                      onChange={(e) => setSelectedCashierId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                    >
                      <option value="">-- Pilih Kasir --</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">Jadwal Shift</label>
                    <select 
                      value={selectedShiftId} 
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                    >
                      <option value="">-- Pilih Shift --</option>
                      {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                    </select>
                  </div>
                </>
              )}

              <button 
                onClick={handleStartSession}
                className="w-full h-11 bg-primary-container hover:bg-primary text-on-primary-container font-bold rounded-lg transition-colors mt-2"
              >
                Buka Kasir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row h-full overflow-hidden p-margin-desktop gap-4">

      {/* ══════════════════════════════
          KIRI: Keranjang Belanja
      ══════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Header Session Kasir Aktif */}
        {activeSession && (
          <div className="bg-surface border border-border rounded-xl px-4 py-2 shrink-0 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Kasir Aktif</span>
                <span className="text-sm font-semibold text-text-primary">
                  {activeSession.cashierName} <span className="opacity-50 text-xs font-normal">({shifts.find(s => s.id === activeSession.shiftId)?.name || 'Shift'})</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveSession(null);
                setSelectedCashierId('');
                setSelectedShiftId('');
                localStorage.removeItem('pos_session');
              }}
              className="px-3 py-1.5 rounded bg-surface-variant hover:bg-surface-bright text-text-secondary hover:text-text-primary text-xs font-medium transition-colors border border-border"
            >
              Ganti Kasir
            </button>
          </div>
        )}

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
              placeholder="Scan Barcode Produk / Member atau ketik nama/SKU di sini…"
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
        <div className="bg-surface border border-border rounded-xl px-4 py-3 shrink-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center relative" ref={memberDropdownRef}>
          <div className="flex-1 w-full relative">
            <label className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1.5 block">
              Pelanggan Member
            </label>
            <div 
              onClick={() => !isLocked && setMemberSearchOpen(!memberSearchOpen)}
              className={`w-full bg-background border border-border rounded-lg h-10 px-3 flex items-center justify-between cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-container'}`}
            >
              {selectedMember ? (
                <span className="text-sm text-text-primary">{selectedMember.name} ({selectedMember.phone})</span>
              ) : (
                <span className="text-sm text-text-secondary flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">search</span> Cari / Pilih Member (Manual)</span>
              )}
              <span className="material-symbols-outlined text-text-secondary text-[18px]">expand_more</span>
            </div>

            {memberSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-border">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Cari nama atau nomor..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="w-full bg-background border border-border rounded h-9 px-3 text-sm text-text-primary focus:outline-none focus:border-primary-container"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div 
                    onClick={() => { setSelectedMember(null); setMemberSearchOpen(false); setMemberSearchQuery(''); }}
                    className="px-3 py-2 hover:bg-surface-bright cursor-pointer text-sm text-text-secondary flex items-center gap-2"
                  >
                    — Pelanggan Umum —
                  </div>
                  {filteredMembers.map(m => {
                    const tierUI = getMemberTierUI(m.id);
                    return (
                      <div 
                        key={m.id}
                        onClick={() => { setSelectedMember(m); setMemberSearchOpen(false); setMemberSearchQuery(''); }}
                        className="px-3 py-2 hover:bg-surface-bright cursor-pointer text-sm flex items-center justify-between border-t border-border/50"
                      >
                        <span className="text-text-primary font-medium">{m.name} <span className="text-text-secondary text-xs font-normal ml-1">({m.phone})</span></span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tierUI.color}`}>
                          {tierUI.label}
                        </span>
                      </div>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-text-secondary">Tidak ada member ditemukan.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          {selectedMember && (() => {
            const stats = memberStats[selectedMember.id] || { txCount: 0, totalSpent: 0, lastTxDate: null };
            let daysText = 'Belum pernah';
            if (stats.lastTxDate) {
              const diffMs = new Date().getTime() - new Date(stats.lastTxDate).getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (diffDays === 0) daysText = 'Hari ini';
              else daysText = `${diffDays} hari lalu`;
            }

            return (
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div className={`shrink-0 flex items-center gap-3 px-3 py-2 rounded border w-full sm:w-auto ${getMemberTierUI(selectedMember.id).color}`}>
                  <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider opacity-80">Level Member</span>
                    <span className="text-sm font-bold">
                      {getMemberTierUI(selectedMember.id).label}
                    </span>
                  </div>
                </div>
                
                {/* Tooltip Info Member */}
                <div className="text-[11px] text-text-secondary bg-surface-container-high px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-border">
                  <span className="material-symbols-outlined text-[12px]">info</span>
                  Terakhir belanja: {daysText} | Total transaksi: {stats.txCount}
                </div>
              </div>
            );
          })()}
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
                  items.map((item) => {
                    const product = localProducts.find(p => p.id === item.productId);
                    const isWholesale = product && product.priceWholesale && product.wholesaleMinQty && item.quantity >= product.wholesaleMinQty;
                    
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/50 hover:bg-surface-container-high"
                      >
                        <td className="py-3 px-4 font-medium text-text-primary">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{item.name}</span>
                            {isWholesale && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/20 text-success border border-success/30 uppercase tracking-wider">
                                Grosir
                              </span>
                            )}
                          </div>
                        </td>
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
                  );
                })
              )}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          {items.length > 0 && (
            <div className="shrink-0 border-t border-border px-4 py-3 bg-surface-container-low flex justify-between items-end">
              <div className="flex flex-col gap-1.5">
                <span className="text-text-secondary text-sm font-medium">
                  {items.reduce((s, i) => s + i.quantity, 0)} item
                </span>
                
                {wholesaleTotal > 0 && (
                  <div className="flex flex-col text-[11px] text-text-secondary border-l-2 border-primary/20 pl-2 mt-1">
                    <span className="text-text-primary">Subtotal Reguler: <span className="font-mono font-medium">{formatRp(nonWholesaleTotal)}</span></span>
                    <span className="text-warning">Subtotal Grosir: <span className="font-mono font-medium">{formatRp(wholesaleTotal)}</span> <span className="opacity-70 italic">(Tidak Didiskon)</span></span>
                  </div>
                )}

                {discountAmount > 0 && activeTier && (
                  <span className="text-primary-container text-xs font-bold bg-primary-container/10 px-2 py-1 rounded inline-block w-max mt-1">
                    ✓ Diskon {activeTier.name} ({activeTier.discountPercentage}%)
                  </span>
                )}
                {selectedMember && nonWholesaleTotal > 0 && nonWholesaleTotal < (activeTier?.minOrderAmount || 0) && (
                  <span className="text-warning text-xs font-medium mt-1">
                    Beli Reguler min {formatRp(activeTier?.minOrderAmount || 0)} untuk diskon
                  </span>
                )}
              </div>
              
              <div className="text-right">
                {discountAmount > 0 ? (
                  <>
                    <div className="text-text-secondary text-xs line-through opacity-70 mb-0.5">
                      {formatRp(total)}
                    </div>
                    <div>
                      <span className="text-text-secondary text-xs mr-2">TOTAL</span>
                      <span className="text-2xl font-bold text-primary-container font-mono">
                        {formatRp(finalTotal)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div>
                    <span className="text-text-secondary text-xs mr-2">TOTAL</span>
                    <span className="text-2xl font-bold text-text-primary font-mono">
                      {formatRp(total)}
                    </span>
                  </div>
                )}
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
          total={finalTotal}
          discountAmount={discountAmount}
          items={paymentItems}
          memberId={selectedMember?.id}
          memberName={selectedMember?.name}
          disabled={items.length === 0}
          onTransactionComplete={handleTransactionComplete}
          onNewTransaction={handleNewTransaction}
          cashierName={activeSession?.cashierName || 'Admin'}
          shiftId={activeSession?.shiftId || null}
          storeProfile={storeProfile}
        />
      </div>
      </div>

      {unknownBarcode && (
        <LinkBarcodeDialog
          barcode={unknownBarcode}
          products={localProducts}
          onLink={async (product) => {
            const result = await linkBarcodeToProduct(product.id, unknownBarcode);
            if (result.success) {
              const updated = result.product || { ...product, barcode: unknownBarcode };
              setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, barcode: unknownBarcode } : p));
              addItemToProductCart({ ...product, barcode: unknownBarcode });
              toast.success(`Barcode berhasil ditautkan ke "${product.name}" dan dimasukkan ke keranjang!`);
              setUnknownBarcode(null);
            } else {
              toast.error(result.error || 'Gagal menautkan barcode');
            }
          }}
          onClose={() => setUnknownBarcode(null)}
        />
      )}
    </div>
  );
}

function LinkBarcodeDialog({
  barcode,
  products,
  onLink,
  onClose
}: {
  barcode: string;
  products: Product[];
  onLink: (product: Product) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 rounded-tl-2xl">
      <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">barcode_scanner</span>
          </div>
          <div>
            <h3 className="font-bold text-text-primary text-base">Barcode Belum Terdaftar</h3>
            <p className="text-xs font-mono text-text-secondary mt-0.5">{barcode}</p>
          </div>
        </div>

        <p className="text-xs text-text-secondary">
          Pilih produk yang sesuai di bawah ini untuk menautkan barcode ini secara permanen. Scan berikutnya akan langsung mendeteksi produk tersebut.
        </p>

        <div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">search</span>
            <input
              type="text"
              placeholder="Cari nama produk atau SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg h-10 pl-9 pr-3 text-sm text-text-primary focus:border-primary outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5 border border-border rounded-lg p-1.5 bg-background/50">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-secondary">Produk tidak ditemukan</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  await onLink(p);
                  setIsSaving(false);
                }}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-hover text-left transition-colors border border-transparent hover:border-border"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-sm font-medium text-text-primary truncate">{p.name}</span>
                  <span className="text-[11px] font-mono text-text-secondary">SKU: {p.sku} | Stok: {p.stock}</span>
                </div>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded shrink-0">
                  Tautkan
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-surface-variant hover:bg-surface-bright text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
          >
            Batalkan
          </button>
        </div>
      </div>
    </div>
  );
}