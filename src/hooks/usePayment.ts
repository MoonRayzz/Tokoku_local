// src/hooks/usePayment.ts
'use client'

import { useState, useCallback } from 'react';
import { processCheckout } from '@/app/actions';

export type PaymentMethod = 'cash' | 'qris' | 'debit' | 'utang';
export type PaymentState = 'idle' | 'cash' | 'qris' | 'debit' | 'utang' | 'success' | 'error';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface CompletedTransaction {
  receiptNumber: string;
  totalAmount: number;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  approvalCode?: string;
  memberName?: string;
  cashierName?: string;
}

export type DebtorInfo = {
  debtorName: string;
  debtorPhone?: string;
  debtorNotes?: string;
  memberId?: string;
  isLimitOverride?: boolean;
};

interface UsePaymentOptions {
  total: number;
  discountAmount?: number;
  items: CartItem[];
  memberId?: string;
  memberName?: string;
  cashierName: string;
  shiftId: string | null;
  onSuccess: (tx: CompletedTransaction) => void;
}

interface UsePaymentReturn {
  state: PaymentState;
  isLoading: boolean;
  error: string | null;
  lastTransaction: CompletedTransaction | null;
  selectMethod: (m: PaymentMethod) => void;
  confirmCash: (cashReceived: number) => Promise<void>;
  confirmQris: () => Promise<void>;
  confirmDebit: (approvalCode: string) => Promise<void>;
  confirmUtang: (info: DebtorInfo) => Promise<void>;
  reset: () => void;
}

export function usePayment({
  total,
  discountAmount = 0,
  items,
  memberId,
  memberName,
  cashierName,
  shiftId,
  onSuccess,
}: UsePaymentOptions): UsePaymentReturn {
  const [state, setState] = useState<PaymentState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<CompletedTransaction | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setIsLoading(false);
    setLastTransaction(null);
  }, []);

  const selectMethod = useCallback((m: PaymentMethod) => {
    setState(m);
    setError(null);
  }, []);

  // --- Shared submit logic ---
  const submit = async (
    paymentMethod: PaymentMethod,
    extras: { cashReceived?: number; approvalCode?: string; debtorInfo?: DebtorInfo }
  ) => {
    if (items.length === 0) {
      setError('Keranjang belanja kosong.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await processCheckout({
        memberId,
        items: items.map((i) => ({
          productId: i.productId,
          priceAtTime: i.price,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
        totalAmount: total,
        discountAmount,
        paymentMethod,
        cashReceived: extras.cashReceived,
        approvalCode: extras.approvalCode,
        debtorInfo: extras.debtorInfo,
        cashierName,
        shiftId,
      });

      if (result.success && result.receiptNumber) {
        const tx: CompletedTransaction = {
          receiptNumber: result.receiptNumber,
          totalAmount: total,
          discountAmount,
          paymentMethod,
          cashReceived: extras.cashReceived,
          change: extras.cashReceived != null ? extras.cashReceived - total : undefined,
          approvalCode: extras.approvalCode,
          memberName,
          cashierName,
        };
        setLastTransaction(tx);
        setState('success');
        onSuccess(tx);
      } else {
        setError(result.error ?? 'Transaksi gagal. Coba lagi.');
        // Kembali ke state metode yg sedang dipilih — bukan ke idle
        setState(paymentMethod);
      }
    } catch {
      setError('Terjadi kesalahan sistem. Coba lagi.');
      setState(paymentMethod);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Cash: validasi di sisi client sebelum submit ---
  const confirmCash = useCallback(
    async (cashReceived: number) => {
      if (cashReceived < total) {
        setError('Uang tunai kurang dari total belanja.');
        return;
      }
      await submit('cash', { cashReceived });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, items, memberId]
  );

  // --- QRIS: langsung submit, tidak ada input tambahan ---
  const confirmQris = useCallback(async () => {
    await submit('qris', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, items, memberId]);

  // --- Debit: validasi approval code ---
  const confirmDebit = useCallback(
    async (approvalCode: string) => {
      const cleaned = approvalCode.toUpperCase().trim();
      if (!/^[A-Z0-9]{4,8}$/.test(cleaned)) {
        setError('Kode approval tidak valid. Harus 4–8 karakter alphanumeric (A–Z, 0–9).');
        return;
      }
      await submit('debit', { approvalCode: cleaned });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, items, memberId]
  );

  // --- Utang: simpan info debtor ---
  const confirmUtang = useCallback(
    async (info: DebtorInfo) => {
      await submit('utang', { debtorInfo: info });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total, items, memberId]
  );

  return {
    state,
    isLoading,
    error,
    lastTransaction,
    selectMethod,
    confirmCash,
    confirmQris,
    confirmDebit,
    confirmUtang,
    reset,
  };
}
