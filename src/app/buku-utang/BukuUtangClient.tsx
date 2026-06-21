'use client'

import React, { useState, useRef } from 'react';
import { processDebtPayment } from './actions';
import { DebtPaymentReceipt } from '@/components/pos/DebtPaymentReceipt';
import { useReactToPrint } from 'react-to-print';

const formatRp = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

export default function BukuUtangClient({ initialDebts, employees, storeProfile }: any) {
  const [debts, setDebts] = useState(initialDebts);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [amount, setAmount] = useState<number | ''>('');
  const [selectedKasir, setSelectedKasir] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Printing
  const [paymentToPrint, setPaymentToPrint] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    onAfterPrint: () => setPaymentToPrint(null),
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKasir) {
      setError('Silakan pilih kasir.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Nominal pembayaran tidak valid.');
      return;
    }
    if (Number(amount) > selectedDebt.remaining) {
      setError('Nominal melebihi sisa utang.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const kasirName = employees.find((em: any) => em.id === selectedKasir)?.name || 'Kasir';
    
    const res = await processDebtPayment(selectedDebt.id, Number(amount), kasirName);
    if (res.success) {
      // Update local state to avoid full reload
      const updatedList = debts.map((d: any) => 
        d.id === selectedDebt.id 
          ? { 
              ...d, 
              remaining: res.data!.updatedDebt.remaining, 
              paidAmount: res.data!.updatedDebt.paidAmount, 
              status: res.data!.updatedDebt.status,
              payments: [res.data!.payment, ...(d.payments || [])]
            }
          : d
      );
      setDebts(updatedList);
      
      // Set to print
      setPaymentToPrint({
        ...res.data!.payment,
        debt: {
          debtorName: selectedDebt.debtorName,
          transaction: selectedDebt.transaction,
          totalAmount: selectedDebt.totalAmount,
          remaining: res.data!.updatedDebt.remaining
        }
      });
      setTimeout(() => {
        handlePrint();
      }, 500);

      setSelectedDebt(null);
      setAmount('');
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  };

  const filteredDebts = debts.filter((d: any) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchQuery && !d.debtorName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-8 space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Buku Utang</h1>
          <p className="text-text-secondary mt-1">Kelola piutang pelanggan dan cicilan pembayaran.</p>
        </div>
        <div className="bg-rose-500/10 text-rose-500 px-4 py-2 rounded-xl border border-rose-500/20 font-bold">
          Total Piutang Berjalan: {formatRp(debts.reduce((sum: number, d: any) => sum + d.remaining, 0))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Cari nama pelanggan..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="UNPAID">Belum Lunas</option>
            <option value="PARTIAL">Dicicil</option>
            <option value="PAID">Lunas</option>
          </select>
        </div>
        <a 
          href={`/api/export/buku-utang?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`}
          target="_blank"
          className="flex items-center gap-2 bg-success/10 text-success border border-success/20 px-4 py-2 rounded-lg text-sm font-bold hover:bg-success/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export Excel
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-surface-container-low font-bold">Daftar Utang</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-border text-xs uppercase text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">No. Trx</th>
                  <th className="px-4 py-3 text-right">Total Utang</th>
                  <th className="px-4 py-3 text-right">Sisa Utang</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDebts.map((d: any) => (
                  <tr key={d.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="px-4 py-3 text-sm">{new Date(d.createdAt).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 font-medium">
                      {d.debtorName}
                      <div className="text-xs text-text-secondary font-normal">{d.debtorPhone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-text-secondary">{d.transaction?.receiptNumber || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatRp(d.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-500">{formatRp(d.remaining)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                        d.status === 'PAID' ? 'bg-success/20 text-success' : 
                        d.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => {
                          setSelectedDebt(d);
                          setAmount(d.remaining);
                        }}
                        disabled={d.status === 'PAID'}
                        className="text-xs bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-bold disabled:opacity-50 hover:bg-primary hover:text-on-primary transition-colors"
                      >
                        Bayar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDebts.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-text-secondary">Tidak ada data sesuai filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {selectedDebt ? (
            <div className="bg-surface rounded-xl border border-border p-5 sticky top-4 shadow-sm">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500">payments</span>
                Terima Pembayaran
              </h2>
              
              <div className="bg-surface-container-low p-3 rounded-lg mb-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Pengutang:</span>
                  <span className="font-bold">{selectedDebt.debtorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Sisa Utang:</span>
                  <span className="font-bold text-rose-500">{formatRp(selectedDebt.remaining)}</span>
                </div>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Kasir Bertugas</label>
                  <select 
                    value={selectedKasir}
                    onChange={(e) => setSelectedKasir(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg h-11 px-3"
                    required
                  >
                    <option value="">Pilih Kasir</option>
                    {employees.map((em: any) => (
                      <option key={em.id} value={em.id}>{em.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-text-secondary uppercase mb-1 block">Nominal Bayar (Rp)</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    max={selectedDebt.remaining}
                    className="w-full bg-background border border-border rounded-lg h-11 px-3 text-lg font-mono font-bold text-rose-500 focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none"
                    required
                  />
                  <div className="text-xs text-text-secondary mt-1 flex gap-2">
                    <button type="button" onClick={() => setAmount(selectedDebt.remaining)} className="hover:text-primary">Bayar Penuh</button>
                    |
                    <button type="button" onClick={() => setAmount(selectedDebt.remaining / 2)} className="hover:text-primary">Bayar Setengah</button>
                  </div>
                </div>

                {error && <div className="text-xs text-error bg-error/10 p-2 rounded">{error}</div>}

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedDebt(null)}
                    className="flex-1 bg-surface-container-high text-text-primary font-bold h-11 rounded-lg hover:bg-surface-bright"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-1 bg-primary-container text-on-primary-container font-bold h-11 rounded-lg hover:bg-primary transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : 'Konfirmasi'}
                  </button>
                </div>
              </form>

              {/* Riwayat Cicilan untuk debt yang dipilih */}
              {selectedDebt.payments && selectedDebt.payments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h3 className="text-xs font-bold text-text-secondary uppercase mb-3">Riwayat Cicilan</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedDebt.payments.map((p: any) => (
                      <div key={p.id} className="text-xs bg-surface-container-low p-2 rounded flex justify-between items-center">
                        <div>
                          <div className="font-bold">{formatRp(p.amount)}</div>
                          <div className="text-[10px] text-text-secondary">{new Date(p.paidAt).toLocaleDateString()} - {p.kasirId}</div>
                        </div>
                        <span className="material-symbols-outlined text-success text-[16px]">check_circle</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-border p-8 flex flex-col items-center justify-center text-center h-64 text-text-secondary">
              <span className="material-symbols-outlined text-[48px] opacity-20 mb-4">payments</span>
              <p>Pilih data utang di samping untuk menerima pembayaran cicilan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Thermal Print */}
      <div className="hidden">
        <div ref={receiptRef}>
          {paymentToPrint && (
            <DebtPaymentReceipt 
              payment={paymentToPrint} 
              storeConfig={{
                name: storeProfile?.name || 'TokoKu',
                address: storeProfile?.address || '-',
                phone: storeProfile?.phone || '-',
                city: storeProfile?.city || '-',
                footer: storeProfile?.footer || 'Terima kasih',
                logoUrl: storeProfile?.logoUrl
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
