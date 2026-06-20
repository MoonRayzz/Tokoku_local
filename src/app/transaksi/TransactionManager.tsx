// src/app/transaksi/TransactionManager.tsx
'use client'

import React, { useState, useTransition, useMemo } from 'react';
import { voidTransaction } from './actions';
import { useToast } from '@/components/ui/Toast';
import { PaymentBadge } from '@/components/ui/PaymentBadge';
import { PrintableReceipt } from '@/components/pos/PrintableReceipt';

// Tipe data hasil join Prisma
type TransactionDetail = {
  id: string;
  quantity: number;
  priceAtTime: number;
  subtotal: number;
  product: { name: string; sku: string };
};

type TransactionData = {
  id: string;
  receiptNumber: string;
  createdAt: Date;
  totalAmount: number;
  paymentMethod: string;
  cashReceived: number | null;
  change: number | null;
  approvalCode: string | null;
  isVoid: boolean;
  member: { name: string; phone: string } | null;
  details: TransactionDetail[];
};

interface TransactionManagerProps {
  initialTransactions: TransactionData[];
}

type MethodFilter = 'all' | 'cash' | 'qris' | 'debit';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const formatDate = (d: Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const formatTime = (d: Date) =>
  new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export default function TransactionManager({ initialTransactions }: TransactionManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [selectedTx, setSelectedTx] = useState<TransactionData | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const [storeConfig, setStoreConfig] = React.useState({
    name: 'TOKOKU POS LOKAL',
    address: 'Jl. Pendidikan Raya No. 1, Jakarta',
    phone: '08123456789',
    footer: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar.',
    qrisProvider: 'GoPay Merchant',
    edcBank: 'BCA',
  });

  React.useEffect(() => {
    const saved = localStorage.getItem('tokoku_config');
    if (saved) {
      try { setStoreConfig(JSON.parse(saved)); } catch { }
    }
  }, []);

  // ── Filtered transactions ──
  const filteredTx = useMemo(() => {
    return initialTransactions.filter((tx) => {
      const matchesSearch =
        tx.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.member?.name.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesMethod = methodFilter === 'all' || tx.paymentMethod === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [initialTransactions, searchQuery, methodFilter]);

  // ── Closing summary per metode ──
  const summary = useMemo(() => {
    const active = initialTransactions.filter((tx) => !tx.isVoid);
    const byMethod = (m: string) =>
      active.filter((tx) => tx.paymentMethod === m).reduce((s, tx) => s + tx.totalAmount, 0);
    return {
      cash: byMethod('cash'),
      qris: byMethod('qris'),
      debit: byMethod('debit'),
      grand: active.reduce((s, tx) => s + tx.totalAmount, 0),
    };
  }, [initialTransactions]);

  // ── Void handler ──
  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx || pin.length < 4) return;
    setErrorMessage('');

    startTransition(async () => {
      const result = await voidTransaction(selectedTx.id, pin);
      if (result.success) {
        setVoidModalOpen(false);
        setPin('');
        setSelectedTx(null);
        toast.success('Transaksi berhasil dibatalkan dan stok telah dikembalikan.');
      } else {
        setErrorMessage(result.error || 'Terjadi kesalahan.');
        setPin('');
      }
    });
  };

  const openVoidModal = (tx: TransactionData) => {
    if (tx.isVoid) return;
    setSelectedTx(tx);
    setVoidModalOpen(true);
    setErrorMessage('');
    setPin('');
  };

  // ── Method filter buttons ──
  const METHOD_FILTERS: { id: MethodFilter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'cash', label: 'Cash' },
    { id: 'qris', label: 'QRIS' },
    { id: 'debit', label: 'Debit' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-margin-desktop h-full flex flex-col gap-6">

      {/* ── Header ── */}
      <div>
        <h1 className="font-headline-md text-headline-md text-text-primary">Riwayat Transaksi</h1>
        <p className="text-text-secondary text-sm mt-1">
          Pantau histori penjualan, filter per metode, dan kelola void.
        </p>
      </div>

      {/* ── Closing Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cash', value: summary.cash, icon: 'payments', color: 'text-primary-container bg-primary-container/10 border-primary-container/20' },
          { label: 'QRIS', value: summary.qris, icon: 'qr_code_2', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
          { label: 'Debit', value: summary.debit, icon: 'credit_card', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
          { label: 'Grand Total', value: summary.grand, icon: 'account_balance_wallet', color: 'text-text-primary bg-surface-container-high border-border' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
            </div>
            <div className="font-bold text-lg font-mono">{formatRp(s.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col md:flex-row gap-3 items-center bg-surface p-4 border border-border rounded-t-xl">
        {/* Search */}
        <div className="w-full md:w-80 relative focus-pulse rounded-lg">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Cari No. Nota atau nama pelanggan…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg h-10 pl-10 pr-4 text-text-primary text-sm focus:outline-none"
          />
        </div>

        {/* Method filter pills */}
        <div className="flex gap-1.5 ml-auto">
          {METHOD_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setMethodFilter(f.id)}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${methodFilter === f.id
                  ? 'bg-primary-container text-on-primary-fixed border-primary-container'
                  : 'border-border text-text-secondary hover:bg-surface-container-high hover:text-text-primary'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabel ── */}
      <div className="w-full border-x border-b border-border rounded-b-xl overflow-x-auto bg-surface flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-container-low border-b border-border z-10">
            <tr>
              <th className="p-4 text-text-secondary font-medium text-sm">No. Nota</th>
              <th className="p-4 text-text-secondary font-medium text-sm">Waktu</th>
              <th className="p-4 text-text-secondary font-medium text-sm">Pelanggan</th>
              <th className="p-4 text-text-secondary font-medium text-sm text-right">Total</th>
              <th className="p-4 text-text-secondary font-medium text-sm text-center">Metode</th>
              <th className="p-4 text-text-secondary font-medium text-sm">Keterangan</th>
              <th className="p-4 text-text-secondary font-medium text-sm text-center">Status</th>
              <th className="p-4 text-text-secondary font-medium text-sm text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredTx.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-text-secondary">
                  <span className="material-symbols-outlined text-[40px] opacity-20 block mx-auto mb-2">
                    receipt_long
                  </span>
                  Tidak ada transaksi yang cocok.
                </td>
              </tr>
            ) : (
              filteredTx.map((tx) => (
                <tr key={tx.id} className="border-b border-border hover:bg-surface-container-high transition-colors">
                  <td className="p-4 font-mono font-semibold text-primary-container">{tx.receiptNumber}</td>
                  <td className="p-4 text-text-secondary whitespace-nowrap">
                    {formatDate(tx.createdAt)}{' '}
                    <span className="text-xs">{formatTime(tx.createdAt)}</span>
                  </td>
                  <td className="p-4 text-text-primary">
                    {tx.member?.name ?? <span className="text-text-secondary italic">Umum</span>}
                  </td>
                  <td className="p-4 text-right font-semibold text-text-primary">{formatRp(tx.totalAmount)}</td>
                  <td className="p-4 text-center">
                    <PaymentBadge method={tx.paymentMethod} />
                  </td>
                  <td className="p-4 text-text-secondary text-xs">
                    {tx.paymentMethod === 'cash' && tx.change != null && (
                      <span>Kembalian: {formatRp(tx.change)}</span>
                    )}
                    {tx.paymentMethod === 'debit' && tx.approvalCode && (
                      <span className="font-mono">Approval: {tx.approvalCode}</span>
                    )}
                    {tx.paymentMethod === 'qris' && (
                      <span className="text-blue-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {tx.isVoid ? (
                      <span className="px-2 py-1 rounded bg-danger/10 text-danger border border-danger/30 text-[11px] font-bold">
                        VOID
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-primary-container/10 text-primary-container border border-primary-container/30 text-[11px] font-bold">
                        SUKSES
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="p-1.5 text-text-secondary hover:text-text-primary transition-colors mr-1"
                      title="Lihat Struk"
                    >
                      <span className="material-symbols-outlined text-[20px]">receipt</span>
                    </button>
                    {!tx.isVoid && (
                      <button
                        onClick={() => openVoidModal(tx)}
                        className="p-1.5 text-text-secondary hover:text-danger transition-colors"
                        title="Void Transaksi"
                      >
                        <span className="material-symbols-outlined text-[20px]">cancel</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Struk ── */}
      {selectedTx && !voidModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
          <div className="relative print-area bg-white p-4 max-h-[90vh] overflow-y-auto rounded shadow-2xl flex flex-col font-mono text-sm leading-tight print:max-h-none print:overflow-visible print:shadow-none print:mx-auto">
            
            <PrintableReceipt 
              transaction={selectedTx} 
              items={selectedTx.details.map(d => ({
                name: d.product.name,
                price: d.priceAtTime,
                quantity: d.quantity,
                subtotal: d.subtotal
              }))} 
              storeConfig={storeConfig} 
            />

            {selectedTx.isVoid && (
              <div className="text-center font-bold text-red-600 border border-red-600 p-2 mb-4 mt-2 rotate-12">
                TRANSAKSI DIBATALKAN (VOID)
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded print:hidden font-sans font-bold flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">print</span> CETAK STRUK
            </button>
          </div>
        </div>
      )}

      {/* ── Modal PIN Void ── */}
      {voidModalOpen && selectedTx && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setVoidModalOpen(false)} />
          <div className="relative bg-surface border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4 border border-danger/20">
                <span className="material-symbols-outlined text-[32px]">admin_panel_settings</span>
              </div>
              <h2 className="font-bold text-text-primary text-lg">Otorisasi Pembatalan</h2>
              <p className="text-text-secondary text-sm mt-1">
                Masukkan PIN Admin untuk membatalkan nota <b>{selectedTx.receiptNumber}</b>.
              </p>
              <p className="text-danger text-xs mt-2 bg-danger/10 py-1 px-2 rounded inline-block">
                PIN Default Simulator: 123456
              </p>
            </div>

            <form onSubmit={handleVoidSubmit}>
              {errorMessage && (
                <div className="bg-danger/10 border border-danger text-danger px-3 py-2 rounded text-sm mb-4 text-center">
                  {errorMessage}
                </div>
              )}
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                placeholder="••••••"
                className="w-full bg-background border border-border rounded-xl h-14 text-center text-2xl tracking-[1em] text-text-primary focus:outline-none focus:border-danger transition-all mb-6"
                maxLength={6}
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setVoidModalOpen(false)}
                  disabled={isPending}
                  className="flex-1 h-12 rounded-xl border border-border text-text-primary hover:bg-surface-container-high transition-colors font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || pin.length < 4}
                  className="flex-1 h-12 rounded-xl bg-danger text-white hover:bg-red-600 transition-colors font-bold disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isPending ? (
                    <span className="material-symbols-outlined animate-spin">refresh</span>
                  ) : (
                    'Proses Void'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}