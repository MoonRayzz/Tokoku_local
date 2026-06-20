// src/components/ui/ConfirmDialog.tsx
'use client'

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const VARIANT_STYLES = {
  danger: {
    icon: 'delete_forever',
    iconBg: 'bg-danger/10 text-danger border-danger/20',
    btn: 'bg-danger hover:bg-red-600 text-white',
  },
  warning: {
    icon: 'warning',
    iconBg: 'bg-warning/10 text-warning border-warning/20',
    btn: 'bg-warning hover:brightness-110 text-black font-bold',
  },
  info: {
    icon: 'info',
    iconBg: 'bg-primary-container/10 text-primary-container border-primary-container/20',
    btn: 'bg-primary-container hover:brightness-110 text-on-primary-fixed font-bold',
  },
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmDialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const variant = dialog?.variant ?? 'info';
  const styles = VARIANT_STYLES[variant];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          />

          {/* Dialog Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative bg-surface border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in"
            style={{ animation: 'dialogIn 0.2s ease-out' }}
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${styles.iconBg}`}>
              <span className="material-symbols-outlined text-[28px]">{styles.icon}</span>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              {dialog.title && (
                <h2 className="font-headline-sm text-headline-sm text-text-primary mb-2">
                  {dialog.title}
                </h2>
              )}
              <p className="text-text-secondary text-sm leading-relaxed">
                {dialog.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 h-11 rounded-lg border border-border text-text-primary hover:bg-surface-container-high transition-colors font-medium text-sm"
              >
                {dialog.cancelLabel ?? 'Batal'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 h-11 rounded-lg transition-colors text-sm ${styles.btn}`}
              >
                {dialog.confirmLabel ?? 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes dialogIn {
              from { opacity: 0; transform: scale(0.95) translateY(8px); }
              to   { opacity: 1; transform: scale(1)    translateY(0); }
            }
          `}</style>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm harus digunakan di dalam <ConfirmDialogProvider>');
  return ctx;
}
