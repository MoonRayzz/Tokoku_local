'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-surface border border-border p-8 rounded-xl shadow-sm text-center max-w-md w-full">
        <span className="material-symbols-outlined text-error text-[48px] mb-4">error</span>
        <h2 className="text-xl font-bold text-text-primary mb-2">Terjadi Kesalahan</h2>
        <p className="text-sm text-text-secondary mb-6">
          Maaf, sistem mengalami gangguan teknis saat memuat halaman ini.
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-primary-container text-on-primary-container hover:bg-primary font-semibold py-2.5 px-4 rounded-lg transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
