'use client';

import React, { useState } from 'react';
import { addExpense, voidExpense } from './actions';
import { useToast } from '@/components/ui/Toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useSync } from '@/context/SyncContext';
import Pagination from '@/components/ui/Pagination';
import { useRouter, useSearchParams } from 'next/navigation';

interface Expense {
  id: string;
  date: Date;
  category: string;
  amount: number;
  notes: string | null;
  employeeId: string;
  employee?: { name: string };
  shift?: { name: string };
  syncStatus: string;
  isVoid: boolean;
}

interface ExpenseManagerProps {
  expenses: Expense[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
  limit: number;
  activeEmployees: { id: string, name: string }[];
  activeShifts: { id: string, name: string }[];
}

const CATEGORIES = [
  'LISTRIK',
  'TRANSPORT',
  'PERLENGKAPAN',
  'KONSUMSI',
  'LAINNYA'
];

export default function ExpenseManager({ expenses, totalPages, totalCount, currentPage, limit, activeEmployees, activeShifts }: ExpenseManagerProps) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { triggerSync } = useSync();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date') || '';

  const handleDateFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('date', val);
      params.delete('page'); // Reset ke halaman 1
    } else {
      params.delete('date');
    }
    router.push(`?${params.toString()}`);
  };

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

  const handleVoid = async (id: string) => {
    const pin = window.prompt("Masukkan PIN Otorisasi (Void PIN) untuk membatalkan pengeluaran ini:");
    if (!pin) return;

    setLoading(true);
    const res = await voidExpense(id, pin);
    setLoading(false);

    if (res.success) {
      toast.success('Pengeluaran berhasil dibatalkan!');
      triggerSync();
    } else {
      toast.error(res.error || 'Gagal membatalkan pengeluaran.');
    }
  };

  const totalExpense = expenses.filter(e => !e.isVoid).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-4 md:p-8 space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Pengeluaran Operasional</h2>
        <p className="text-sm text-text-secondary mt-1">Catat dan kelola kas keluar harian (selain pembelian stok)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
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
                <label className="text-xs font-semibold text-text-secondary uppercase">Karyawan (Kasir)</label>
                <select 
                  name="employeeId" 
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary-container"
                >
                  {activeEmployees.length === 0 ? (
                    <option value="">Belum ada karyawan absen</option>
                  ) : (
                    activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Sesi / Shift</label>
                <select 
                  name="shiftId" 
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary-container"
                >
                  {activeShifts.length === 0 ? (
                    <option value="">Belum ada sesi aktif</option>
                  ) : (
                    activeShifts.map(shift => (
                      <option key={shift.id} value={shift.id}>{shift.name}</option>
                    ))
                  )}
                </select>
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
        <div className="lg:col-span-3">
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="p-5 border-b border-border flex flex-wrap gap-4 justify-between items-center bg-surface-container-high/30">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-text-primary">Riwayat Pengeluaran</h3>
                <input 
                  type="date" 
                  value={dateParam}
                  onChange={handleDateFilter}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-primary-container"
                  title="Filter Tanggal"
                />
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary">Total Halaman Ini</p>
                <p className="text-lg font-bold text-error">Rp {totalExpense.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-border">
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Kategori</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Keterangan</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Karyawan</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Sesi</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-right">Nominal</th>
                    <th className="px-5 py-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-text-secondary">Belum ada pengeluaran.</td>
                    </tr>
                  ) : (
                    expenses.map(exp => (
                      <tr key={exp.id} className={`hover:bg-surface-container transition-colors ${exp.isVoid ? 'opacity-50 line-through grayscale' : ''}`}>
                        <td className="px-5 py-3 text-sm text-text-primary whitespace-nowrap">
                          {format(new Date(exp.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-text-primary">
                          <span className={`px-2 py-1 rounded text-xs ${exp.isVoid ? 'bg-error/20 text-error' : 'bg-surface-container-highest'}`}>
                            {exp.isVoid ? 'DIBATALKAN' : exp.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-text-secondary max-w-[150px] truncate">
                          {exp.notes || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-text-primary">
                          {exp.employee?.name || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-text-primary">
                          {exp.shift?.name || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-semibold text-error">
                          - Rp {exp.amount.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3 text-center flex items-center justify-center gap-2">
                          {exp.isVoid ? (
                            <span className="text-xs text-error font-bold">Dibatalkan</span>
                          ) : (
                            <>
                              {exp.syncStatus === 'SYNCED' ? (
                                <span className="material-symbols-outlined text-primary-container text-sm" title="Tersinkronisasi">cloud_done</span>
                              ) : (
                                <span className="material-symbols-outlined text-warning text-sm animate-pulse" title="Menunggu Sync">cloud_upload</span>
                              )}
                              <button 
                                onClick={() => handleVoid(exp.id)}
                                disabled={loading}
                                className="ml-2 px-2 py-1 text-[10px] uppercase font-bold text-error bg-error/10 hover:bg-error hover:text-white rounded transition-colors disabled:opacity-50"
                                title="Batalkan Pengeluaran"
                              >
                                Void
                              </button>
                            </>
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
