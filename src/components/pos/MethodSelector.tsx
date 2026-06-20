// src/components/pos/MethodSelector.tsx
import React from 'react';
import type { PaymentMethod } from '@/hooks/usePayment';

interface MethodSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (m: PaymentMethod) => void;
  disabled?: boolean;
}

const METHODS: {
  id: PaymentMethod;
  label: string;
  sublabel: string;
  icon: string;
  activeClasses: string;
}[] = [
  {
    id: 'cash',
    label: 'Cash',
    sublabel: 'Uang Tunai',
    icon: 'payments',
    activeClasses: 'border-primary-container bg-primary-container/10 text-primary-container',
  },
  {
    id: 'qris',
    label: 'QRIS',
    sublabel: 'Scan QR Sticker',
    icon: 'qr_code_2',
    activeClasses: 'border-blue-500 bg-blue-500/10 text-blue-400',
  },
  {
    id: 'debit',
    label: 'Debit',
    sublabel: 'Kartu / EDC',
    icon: 'credit_card',
    activeClasses: 'border-orange-500 bg-orange-500/10 text-orange-400',
  },
];

export function MethodSelector({ selected, onSelect, disabled }: MethodSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {METHODS.map((m) => {
        const isActive = selected === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(m.id)}
            className={`
              flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-150
              ${isActive
                ? `${m.activeClasses} shadow-lg scale-[1.02]`
                : 'border-border bg-surface text-text-secondary hover:bg-surface-container-high hover:text-text-primary hover:border-border'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            <span
              className={`material-symbols-outlined text-[28px] transition-all ${
                isActive ? '' : 'text-text-secondary'
              }`}
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {m.icon}
            </span>
            <span className="font-bold text-sm leading-none">{m.label}</span>
            <span className="text-[10px] opacity-70 leading-none">{m.sublabel}</span>
          </button>
        );
      })}
    </div>
  );
}
