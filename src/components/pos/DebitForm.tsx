// src/components/pos/DebitForm.tsx
'use client'

import React, { useState, useEffect } from 'react';

interface DebitFormProps {
  total: number;
  isLoading: boolean;
  error: string | null;
  onConfirm: (approvalCode: string) => void;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

const APPROVAL_REGEX = /^[A-Z0-9]{4,8}$/;

export function DebitForm({ total, isLoading, error, onConfirm }: DebitFormProps) {
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setCode('');
    setTouched(false);
  }, [total]);

  const upperCode = code.toUpperCase().trim();
  const isValid = APPROVAL_REGEX.test(upperCode);
  const showInlineError = touched && code.length > 0 && !isValid;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hanya izinkan alphanumeric, auto uppercase
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    setCode(val);
    setTouched(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Total display */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-5 text-center">
        <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-2">
          Nominal yang Harus Diinput di Mesin EDC
        </p>
        <p className="text-4xl font-bold text-orange-300 font-mono tracking-tight">
          {formatRp(total)}
        </p>
      </div>

      {/* Instruksi */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <p className="text-text-primary font-semibold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-orange-400 text-[20px]">info</span>
          Cara Pembayaran Debit / Kartu
        </p>
        <ol className="space-y-2 text-text-secondary text-sm pl-2">
          <li className="flex gap-2">
            <span className="text-orange-400 font-bold shrink-0">1.</span>
            Input nominal di atas pada mesin EDC.
          </li>
          <li className="flex gap-2">
            <span className="text-orange-400 font-bold shrink-0">2.</span>
            Minta pembeli gesek / tap kartu dan masukkan PIN.
          </li>
          <li className="flex gap-2">
            <span className="text-orange-400 font-bold shrink-0">3.</span>
            Setelah struk EDC tercetak, catat kode approval.
          </li>
          <li className="flex gap-2">
            <span className="text-orange-400 font-bold shrink-0">4.</span>
            Masukkan kode approval dari struk di bawah ini.
          </li>
        </ol>
      </div>

      {/* Approval code input */}
      <div className="space-y-1.5">
        <label className="text-text-secondary text-xs font-bold uppercase tracking-wider">
          Kode Approval dari Struk EDC
        </label>
        <input
          type="text"
          value={code}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="Contoh: AB1234"
          maxLength={8}
          autoCapitalize="characters"
          className={`
            w-full h-14 bg-background border rounded-xl px-4 text-center text-2xl font-mono font-bold tracking-widest
            text-text-primary focus:outline-none transition-all
            ${showInlineError
              ? 'border-danger focus:border-danger'
              : isValid
                ? 'border-orange-500 focus:border-orange-400'
                : 'border-border focus:border-orange-500'
            }
          `}
        />
        {/* Inline validation feedback */}
        {showInlineError ? (
          <p className="text-danger text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            Harus 4–8 karakter, hanya huruf (A–Z) dan angka (0–9).
          </p>
        ) : isValid ? (
          <p className="text-primary-container text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Kode valid — {upperCode.length} karakter
          </p>
        ) : (
          <p className="text-text-secondary text-xs">
            Minimal 4, maksimal 8 karakter. Otomatis UPPERCASE.
          </p>
        )}
      </div>

      {/* Error dari server */}
      {error && (
        <p className="text-danger text-sm text-center bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Confirm button */}
      <button
        type="button"
        disabled={!isValid || isLoading}
        onClick={() => onConfirm(upperCode)}
        className="w-full h-14 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
          bg-orange-600 text-white
          hover:bg-orange-500 active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : (
          <>
            <span className="material-symbols-outlined">check_circle</span>
            Konfirmasi Debit — {formatRp(total)}
          </>
        )}
      </button>
    </div>
  );
}
