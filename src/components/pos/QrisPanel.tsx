// src/components/pos/QrisPanel.tsx
import React from 'react';

interface QrisPanelProps {
  total: number;
  isLoading: boolean;
  error: string | null;
  onConfirm: () => void;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

export function QrisPanel({ total, isLoading, error, onConfirm }: QrisPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Total display — besar supaya mudah dibaca kasir */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 text-center">
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">
          Nominal QRIS yang Harus Dibayar
        </p>
        <p className="text-4xl font-bold text-blue-300 font-mono tracking-tight">
          {formatRp(total)}
        </p>
      </div>

      {/* Instruksi */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <p className="text-text-primary font-semibold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400 text-[20px]">info</span>
          Cara Pembayaran QRIS
        </p>
        <ol className="space-y-2 text-text-secondary text-sm pl-2">
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold shrink-0">1.</span>
            Arahkan pembeli ke stiker QR yang ada di meja kasir.
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold shrink-0">2.</span>
            Pembeli scan menggunakan GoPay, OVO, Dana, m-Banking, dll.
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold shrink-0">3.</span>
            Pastikan pembeli memasukkan nominal yang tertera di atas.
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 font-bold shrink-0">4.</span>
            Cek notifikasi di HP kasir untuk konfirmasi penerimaan.
          </li>
        </ol>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2.5">
        <span className="material-symbols-outlined text-warning text-[18px] shrink-0 mt-0.5">warning</span>
        <p className="text-warning text-xs leading-relaxed">
          <strong>Pastikan nominal di HP sesuai</strong> sebelum klik konfirmasi. Sistem tidak dapat
          memverifikasi pembayaran secara otomatis.
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-danger text-sm text-center bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Confirm — langsung aktif, tanpa input tambahan */}
      <button
        type="button"
        disabled={isLoading}
        onClick={onConfirm}
        className="w-full h-14 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
          bg-blue-600 text-white
          hover:bg-blue-500 active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : (
          <>
            <span className="material-symbols-outlined">check_circle</span>
            Saya Sudah Terima QRIS — {formatRp(total)}
          </>
        )}
      </button>
    </div>
  );
}
