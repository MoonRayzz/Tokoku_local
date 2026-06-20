// src/components/pos/CashForm.tsx
'use client'

import React, { useState, useEffect } from 'react';

interface CashFormProps {
  total: number;
  isLoading: boolean;
  error: string | null;
  onConfirm: (cashReceived: number) => void;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

// Denominasi uang yang umum dipakai kasir
const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

export function CashForm({ total, isLoading, error, onConfirm }: CashFormProps) {
  const [rawInput, setRawInput] = useState(''); // digit string, tanpa format

  // Reset saat total berubah (transaksi baru)
  useEffect(() => {
    setRawInput('');
  }, [total]);

  const cashReceived = rawInput ? parseInt(rawInput, 10) : 0;
  const change = cashReceived - total;
  const isValid = cashReceived >= total && cashReceived > 0;

  const handleNumpad = (val: string) => {
    if (val === 'DEL') {
      setRawInput((prev) => prev.slice(0, -1));
    } else if (val === 'C') {
      setRawInput('');
    } else {
      // Batasi panjang angka agar tidak overflow
      if (rawInput.length >= 11) return;
      setRawInput((prev) => prev + val);
    }
  };

  const handleQuick = (amount: number) => {
    setRawInput(amount.toString());
  };

  const handlePas = () => {
    setRawInput(total.toString());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Display area */}
      <div className="bg-background rounded-lg border border-border p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-text-secondary text-sm">Total Belanja</span>
          <span className="font-bold text-text-primary text-lg">{formatRp(total)}</span>
        </div>

        {/* Nominal input display */}
        <div className="flex justify-between items-center border-t border-border/50 pt-3">
          <span className="text-text-secondary text-sm">Uang Diterima</span>
          <div className="text-right">
            <div
              className={`font-bold text-2xl font-mono ${
                cashReceived > 0
                  ? isValid
                    ? 'text-primary-container'
                    : 'text-danger'
                  : 'text-text-secondary'
              }`}
            >
              {cashReceived > 0 ? formatRp(cashReceived) : 'Rp 0'}
            </div>
          </div>
        </div>

        {/* Kembalian */}
        <div
          className={`flex justify-between items-center border-t border-border/50 pt-3 ${
            isValid ? '' : 'opacity-40'
          }`}
        >
          <span className="text-text-secondary text-sm">Kembalian</span>
          <span
            className={`font-bold text-xl ${
              change === 0 ? 'text-text-primary' : 'text-primary-container'
            }`}
          >
            {isValid ? formatRp(Math.max(0, change)) : '—'}
          </span>
        </div>
      </div>

      {/* Quick amount buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handlePas}
          className="px-3 py-1.5 rounded border border-primary-container text-primary-container text-xs font-bold hover:bg-primary-container/10 transition-colors"
        >
          Pas
        </button>
        {QUICK_AMOUNTS.filter((a) => a >= total).slice(0, 4).map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => handleQuick(amt)}
            className="px-3 py-1.5 rounded border border-border text-text-secondary text-xs hover:bg-surface-container-high hover:text-text-primary transition-colors"
          >
            {formatRp(amt)}
          </button>
        ))}
        {/* Selalu tampilkan denominasi besar */}
        {[50000, 100000].filter((a) => a < total).map((amt) => (
          <button
            key={`large-${amt}`}
            type="button"
            onClick={() => handleQuick(Math.ceil(total / amt) * amt)}
            className="px-3 py-1.5 rounded border border-border text-text-secondary text-xs hover:bg-surface-container-high hover:text-text-primary transition-colors"
          >
            {formatRp(Math.ceil(total / amt) * amt)}
          </button>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-1.5">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleNumpad(n.toString())}
            className="h-12 bg-surface-container-high rounded-lg text-xl font-medium hover:bg-surface-bright active:scale-95 transition-all"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleNumpad('C')}
          className="h-12 bg-danger/15 text-danger rounded-lg text-sm font-bold hover:bg-danger/25 active:scale-95 transition-all"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleNumpad('0')}
          className="h-12 bg-surface-container-high rounded-lg text-xl font-medium hover:bg-surface-bright active:scale-95 transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleNumpad('DEL')}
          className="h-12 bg-surface-container-high rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[20px] text-text-secondary">backspace</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-danger text-sm text-center bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Confirm button */}
      <button
        type="button"
        disabled={!isValid || isLoading}
        onClick={() => onConfirm(cashReceived)}
        className="w-full h-14 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
          bg-primary-container text-on-primary-fixed
          hover:brightness-110 active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
      >
        {isLoading ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : (
          <>
            <span className="material-symbols-outlined">check_circle</span>
            Konfirmasi — Terima {isValid ? formatRp(cashReceived) : '...'}
          </>
        )}
      </button>
    </div>
  );
}
