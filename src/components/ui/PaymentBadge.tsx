// src/components/ui/PaymentBadge.tsx
import React from 'react';
import type { PaymentMethod } from '@/hooks/usePayment';

interface PaymentBadgeProps {
  method: string;
  size?: 'sm' | 'md';
}

const CONFIG: Record<string, { label: string; icon: string; classes: string }> = {
  cash: {
    label: 'CASH',
    icon: 'payments',
    classes: 'bg-primary-container/15 text-primary-container border-primary-container/30',
  },
  qris: {
    label: 'QRIS',
    icon: 'qr_code_2',
    classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  debit: {
    label: 'DEBIT',
    icon: 'credit_card',
    classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
};

export function PaymentBadge({ method, size = 'sm' }: PaymentBadgeProps) {
  const cfg = CONFIG[method] ?? CONFIG.cash;
  const textSize = size === 'md' ? 'text-sm' : 'text-[11px]';
  const iconSize = size === 'md' ? 'text-[16px]' : 'text-[13px]';
  const padding = size === 'md' ? 'px-3 py-1.5' : 'px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-bold tracking-wide ${textSize} ${padding} ${cfg.classes}`}
    >
      <span className={`material-symbols-outlined leading-none ${iconSize}`}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
