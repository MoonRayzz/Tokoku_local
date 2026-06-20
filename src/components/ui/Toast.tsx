// src/components/ui/Toast.tsx
'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const STYLES: Record<ToastType, string> = {
  success: 'border-primary-container bg-primary-container/10 text-primary-container',
  error: 'border-danger bg-danger/10 text-danger',
  warning: 'border-warning bg-warning/10 text-warning',
  info: 'border-border bg-surface-container text-text-primary',
};

const PROGRESS_STYLES: Record<ToastType, string> = {
  success: 'bg-primary-container',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-border',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const duration = toast.duration ?? 4000;
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  }, [onRemove, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, duration]);

  return (
    <div
      role="alert"
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
        min-w-[280px] max-w-[420px] overflow-hidden
        transition-all duration-300 ease-out
        ${STYLES[toast.type]}
        ${exiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
      `}
    >
      {/* Icon */}
      <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0">
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <p className="text-sm font-medium leading-snug flex-1 pr-2 pt-0.5">
        {toast.message}
      </p>

      {/* Close Button */}
      <button
        onClick={dismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Tutup notifikasi"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>

      {/* Progress Bar */}
      <div
        className={`absolute bottom-0 left-0 h-[2px] ${PROGRESS_STYLES[toast.type]}`}
        style={{
          animation: `shrink ${duration}ms linear forwards`,
        }}
      />

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container — top-right, di atas semua konten */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus digunakan di dalam <ToastProvider>');
  return ctx;
}
