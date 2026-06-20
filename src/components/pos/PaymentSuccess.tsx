// src/components/pos/PaymentSuccess.tsx
import React from 'react';
import type { CompletedTransaction, CartItem } from '@/hooks/usePayment';
import { PaymentBadge } from '@/components/ui/PaymentBadge';
import { PrintableReceipt } from '@/components/pos/PrintableReceipt';

interface PaymentSuccessProps {
  transaction: CompletedTransaction;
  items: CartItem[];
  onNewTransaction: () => void;
  onPrint: (tx: CompletedTransaction) => void;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

export function PaymentSuccess({ transaction, items, onNewTransaction, onPrint }: PaymentSuccessProps) {
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
      try { setStoreConfig(JSON.parse(saved)); } catch {}
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* Success icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-primary-container/15 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-primary-container/25 flex items-center justify-center animate-bounce-once">
            <span
              className="material-symbols-outlined text-primary-container text-[40px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
        </div>
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full bg-primary-container/10 animate-ping" style={{ animationDuration: '1s', animationIterationCount: 2 }} />
      </div>

      <div className="text-center">
        <h3 className="text-xl font-bold text-primary-container">Transaksi Berhasil!</h3>
        <p className="text-text-secondary text-sm mt-1">
          No. Nota:{' '}
          <span className="text-text-primary font-mono font-semibold">
            {transaction.receiptNumber}
          </span>
        </p>
      </div>

      {/* Summary / Preview Struk */}
      <div className="w-full bg-surface border border-border rounded-xl overflow-hidden flex flex-col items-center p-4 print:hidden">
        <p className="text-xs text-text-secondary mb-3 w-full text-center border-b border-border/50 pb-2">
          Preview Struk Thermal
        </p>
        <div className="bg-white text-black p-3 shadow-sm border border-gray-200 rounded w-full flex justify-center overflow-hidden">
          <PrintableReceipt 
            transaction={transaction}
            items={items.map(item => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal
            }))}
            storeConfig={storeConfig}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex gap-3">
        <button
          type="button"
          onClick={() => {
            onPrint(transaction);
            onNewTransaction();
          }}
          className="flex-1 h-12 rounded-xl border border-border text-text-primary hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">print</span>
          Cetak Struk
        </button>
        <button
          type="button"
          onClick={onNewTransaction}
          className="flex-1 h-12 rounded-xl bg-primary-container text-on-primary-fixed font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
          Selesai / Baru
        </button>
      </div>

      <style>{`
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
      `}</style>
      
      {/* Area Struk Thermal Tersembunyi (Hanya muncul saat diprint) */}
      <div className="hidden print-area print:flex justify-center items-start pt-8 mx-auto">
        <PrintableReceipt 
          transaction={transaction}
          items={items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal
          }))}
          storeConfig={storeConfig}
        />
      </div>
    </div>
  );
}
