'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { DebtorInfo } from '@/hooks/usePayment';

interface UtangFormProps {
  totalAmount: number;
  onConfirm: (info: DebtorInfo) => void;
  isLoading: boolean;
  error: string | null;
  storeProfile?: any;
  memberId?: string;
  memberName?: string;
}

export function UtangForm({
  totalAmount,
  onConfirm,
  isLoading,
  error,
  storeProfile,
  memberId,
  memberName,
}: UtangFormProps) {
  const [debtorName, setDebtorName] = useState(memberName || '');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [debtorNotes, setDebtorNotes] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Existing Debt for limit check
  const [existingDebt, setExistingDebt] = useState(0);

  const debtLimit = storeProfile?.debtLimitPerPerson || 500000;
  const debtLimitBehavior = storeProfile?.debtLimitBehavior || 'WARN';

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Hit endpoint API untuk search debtor
  useEffect(() => {
    if (debtorName.trim().length < 2) {
      setSuggestions([]);
      setExistingDebt(0);
      return;
    }

    // Jika member aktif dipilih, tidak perlu search suggestion (bisa langsung pakai namanya)
    if (memberId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/debtors/search?q=${encodeURIComponent(debtorName)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.debtors);
          
          // Jika ada exact match, ambil existing debt-nya
          const exactMatch = data.debtors.find((d: any) => d.debtorName.toLowerCase() === debtorName.toLowerCase());
          if (exactMatch) {
            setExistingDebt(exactMatch.remaining);
          } else {
            setExistingDebt(0);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debtorName, memberId]);

  const totalDebtAfter = existingDebt + totalAmount;
  const isLimitExceeded = totalDebtAfter > debtLimit;
  const isBlocked = isLimitExceeded && debtLimitBehavior === 'BLOCK';

  const formatRp = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName.trim()) return;
    if (isBlocked) return;

    onConfirm({
      debtorName: debtorName.trim(),
      debtorPhone: debtorPhone.trim() || undefined,
      debtorNotes: debtorNotes.trim() || undefined,
      memberId: memberId || undefined,
      isLimitOverride: isLimitExceeded
    });
  };

  const handleSelectSuggestion = (s: any) => {
    setDebtorName(s.debtorName);
    if (s.debtorPhone) setDebtorPhone(s.debtorPhone);
    setExistingDebt(s.remaining);
    setShowSuggestions(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-surface-container-low p-4 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-2 text-rose-500">
        <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
        <h3 className="font-bold">Informasi Utang</h3>
      </div>

      <div className="relative">
        <label className="text-xs font-bold text-text-secondary mb-1 block uppercase tracking-wider">Nama Pengutang</label>
        <input
          type="text"
          value={debtorName}
          onChange={(e) => {
            setDebtorName(e.target.value);
            setShowSuggestions(true);
          }}
          readOnly={!!memberId}
          placeholder="Masukkan nama lengkap..."
          className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none read-only:opacity-60"
          autoFocus
        />
        {isSearching && (
          <div className="absolute right-3 top-9 w-4 h-4 border-2 border-border border-t-rose-500 rounded-full animate-spin"></div>
        )}
        
        {/* Autocomplete dropdown */}
        {!memberId && showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-border rounded-lg shadow-xl z-10 overflow-hidden">
            {suggestions.map((s, idx) => (
              <div 
                key={idx}
                onClick={() => handleSelectSuggestion(s)}
                className="px-3 py-2 hover:bg-surface-bright cursor-pointer text-sm flex justify-between items-center border-b border-border/50 last:border-0"
              >
                <div>
                  <div className="font-medium text-text-primary">{s.debtorName}</div>
                  {s.debtorPhone && <div className="text-xs text-text-secondary">{s.debtorPhone}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-text-secondary">Sisa Utang</div>
                  <div className="font-mono text-rose-500 text-xs font-bold">{formatRp(s.remaining)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-text-secondary mb-1 block uppercase tracking-wider">Nomor HP (Opsional)</label>
          <input
            type="text"
            value={debtorPhone}
            onChange={(e) => setDebtorPhone(e.target.value)}
            placeholder="08123..."
            className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-text-secondary mb-1 block uppercase tracking-wider">Catatan</label>
          <input
            type="text"
            value={debtorNotes}
            onChange={(e) => setDebtorNotes(e.target.value)}
            placeholder="Janji bayar bulan depan..."
            className="w-full bg-background border border-border rounded-lg h-11 px-3 text-text-primary focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          />
        </div>
      </div>

      {existingDebt > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 mt-2 flex justify-between items-center">
          <span className="text-sm font-medium text-rose-500">Utang Sebelumnya:</span>
          <span className="font-mono font-bold text-rose-500">{formatRp(existingDebt)}</span>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-3 flex justify-between items-center">
        <span className="text-sm font-medium text-text-primary">Total Utang Baru:</span>
        <span className="font-mono font-bold text-rose-500 text-lg">{formatRp(totalDebtAfter)}</span>
      </div>

      {isLimitExceeded && (
        <div className={`p-3 rounded-lg text-sm flex gap-2 items-start ${isBlocked ? 'bg-error/10 text-error border border-error/30' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'}`}>
          <span className="material-symbols-outlined text-[18px]">warning</span>
          <div>
            <div className="font-bold">Batas Utang Terlampaui</div>
            <div className="mt-0.5 opacity-90">Limit toko adalah {formatRp(debtLimit)}. {isBlocked ? 'Transaksi tidak bisa dilanjutkan.' : 'Kasir masih dapat melanjutkan (Override Limit).'}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-error/10 text-error border border-error/30 rounded-lg p-3 text-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !debtorName.trim() || isBlocked}
        className="w-full h-12 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center gap-2 mt-2"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        ) : (
          <>
            <span className="material-symbols-outlined">how_to_reg</span>
            Konfirmasi Utang
          </>
        )}
      </button>
    </form>
  );
}
