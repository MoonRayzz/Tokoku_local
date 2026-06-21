'use client';

import React, { useState } from 'react';
import { addExpense } from './actions';
import { useToast } from '@/components/ui/Toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useSync } from '@/context/SyncContext';
import Pagination from '@/components/ui/Pagination';

interface Expense {
  id: string;
  date: Date;
  category: string;
  amount: number;
  notes: string | null;
  employeeId: string;
  employee?: { name: string };
  syncStatus: string;
}

interface ExpenseManagerProps {
  expenses: Expense[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
  limit: number;
}

const CATEGORIES = [
  'LISTRIK',
  'TRANSPORT',
  'PERLENGKAPAN',
  'KONSUMSI',
  'LAINNYA'
];

export default function ExpenseManager({ expenses, totalPages, totalCount, currentPage, limit }: ExpenseManagerProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { triggerSync } = useSync();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await addExpense(formData);

    setLoading(false);
    if (res.success) {
      toast.success('Pengeluaran berhasil dicatat!');
      (e.target as HTMLFormElement).reset();
      triggerSync(); // Trigger event-based sync
    } else {
      toast.error(res.error || 'Terjadi kesalahan.');
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Pengeluaran Operasional</h2>
        <p className="text-sm text-text-secondary mt-1">Catat dan kelola kas keluar harian (selain pembelian stok)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Input */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">add_circle</span>
              Catat Pengeluaran
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Kategori</label>
                <select 
                  name="category" 
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary-container"
                >
                  <option value="">Pilih Kategori...</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Nominal (Rp)</label>
                <input 
                  type="number" 
                  name="amount" 
                  min="1"
                  required
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary-container"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Keterangan / Catatan</label>
                <textarea 
                  name="notes" 
                  rows={3}
                  placeholder="Opsional"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary-container resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary-container hover:bg-primary text-on-primary-container font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengeluaran'}
              </button>
            </form>
          </div>
        </div>

        {/* Tabel Riwayat */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-container-high/30">
              <h3 className="font-semibold text-text-primary">Riwayat Hari Ini</h3>
              <div className="text-right">
                <p className="text-xs text-text-secondary">Total Keluar</p>
                <p className="text-lg font-bold text-error">Rp {totalExpense.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-surface-container-high border-b border-border">
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Kategori</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Keterangan</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-right">Nominal</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">Belum ada pengeluaran hari ini.</td>
                    </tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-surface-container transition-colors">
                        <td className="px-5 py-3 text-sm text-text-primary whitespace-nowrap">
                          {format(new Date(exp.date), 'HH:mm', { locale: localeId })}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-text-primary">
                          <span className="bg-surface-container-highest px-2 py-1 rounded text-xs">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-text-secondary max-w-[150px] truncate">
                          {exp.notes || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-semibold text-error">
                          - Rp {exp.amount.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {exp.syncStatus === 'SYNCED' ? (
                            <span className="material-symbols-outlined text-primary-container text-sm" title="Tersinkronisasi">cloud_done</span>
                          ) : (
                            <span className="material-symbols-outlined text-warning text-sm animate-pulse" title="Menunggu Sync">cloud_upload</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination 
              totalPages={totalPages} 
              totalItems={totalCount} 
              currentPage={currentPage} 
              pageSize={limit} 
            />
          </div>
        </div>

      </div>
    </div>
  );
}
