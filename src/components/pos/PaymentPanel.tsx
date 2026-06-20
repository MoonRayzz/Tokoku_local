// src/components/pos/PaymentPanel.tsx
'use client'

import React, { useCallback } from 'react';
import { usePayment, type CartItem, type CompletedTransaction, type PaymentMethod } from '@/hooks/usePayment';
import { MethodSelector } from './MethodSelector';
import { CashForm } from './CashForm';
import { QrisPanel } from './QrisPanel';
import { DebitForm } from './DebitForm';
import { PaymentSuccess } from './PaymentSuccess';

interface PaymentPanelProps {
  total: number;
  discountAmount?: number;
  items: CartItem[];
  memberId?: string;
  memberName?: string;
  disabled?: boolean;
  onTransactionComplete: (tx: CompletedTransaction) => void;
  onNewTransaction: () => void;
  cashierName: string;
  shiftId: string | null;
}

export function PaymentPanel({
  total,
  discountAmount,
  items,
  memberId,
  memberName,
  disabled,
  onTransactionComplete,
  onNewTransaction,
  cashierName,
  shiftId,
}: PaymentPanelProps) {
  const handleSuccess = useCallback(
    (tx: CompletedTransaction) => {
      onTransactionComplete(tx);
    },
    [onTransactionComplete]
  );

  const {
    state,
    isLoading,
    error,
    lastTransaction,
    selectMethod,
    confirmCash,
    confirmQris,
    confirmDebit,
    reset,
  } = usePayment({
    total,
    discountAmount,
    items,
    memberId,
    memberName,
    cashierName,
    shiftId,
    onSuccess: handleSuccess,
  });

  const handleNewTransaction = () => {
    reset();
    onNewTransaction();
  };

  const handlePrint = (tx: CompletedTransaction) => {
    window.print();
  };

  // Derived: state saat ini sebagai PaymentMethod atau null
  const selectedMethod = (state === 'cash' || state === 'qris' || state === 'debit')
    ? state as PaymentMethod
    : null;

  return (
    <div className="bg-surface border border-border rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary-container text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            point_of_sale
          </span>
          <h2 className="font-bold text-text-primary text-base">Pembayaran</h2>
        </div>
        {/* Status badge */}
        {state === 'idle' && (
          <span className="text-xs text-text-secondary bg-surface-container px-2 py-1 rounded-full border border-border">
            Pilih Metode
          </span>
        )}
        {selectedMethod && (
          <span className="text-xs font-bold bg-surface-container px-2 py-1 rounded-full border border-border text-text-primary">
            {selectedMethod.toUpperCase()} Dipilih
          </span>
        )}
        {state === 'success' && (
          <span className="text-xs font-bold text-primary-container bg-primary-container/10 px-2 py-1 rounded-full border border-primary-container/30">
            Selesai ✓
          </span>
        )}
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* State: success */}
        {state === 'success' && lastTransaction ? (
          <PaymentSuccess
            transaction={lastTransaction}
            items={items}
            onNewTransaction={handleNewTransaction}
            onPrint={handlePrint}
          />
        ) : (
          <>
            {/* Method selector — always visible */}
            <MethodSelector
              selected={selectedMethod}
              onSelect={selectMethod}
              disabled={disabled || isLoading}
            />

            {/* Idle placeholder */}
            {state === 'idle' && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-secondary gap-3">
                <span className="material-symbols-outlined text-[48px] opacity-30">
                  touch_app
                </span>
                <div>
                  <p className="font-medium">Pilih metode pembayaran</p>
                  <p className="text-xs mt-1 opacity-70">Cash, QRIS, atau Debit/Kartu</p>
                </div>
              </div>
            )}

            {/* Cash form */}
            {state === 'cash' && (
              <CashForm
                total={total}
                isLoading={isLoading}
                error={error}
                onConfirm={confirmCash}
              />
            )}

            {/* QRIS panel */}
            {state === 'qris' && (
              <QrisPanel
                total={total}
                isLoading={isLoading}
                error={error}
                onConfirm={confirmQris}
              />
            )}

            {/* Debit form */}
            {state === 'debit' && (
              <DebitForm
                total={total}
                isLoading={isLoading}
                error={error}
                onConfirm={confirmDebit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
