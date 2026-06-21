'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSync } from '@/context/SyncContext';
import { syncToCloud, getPendingSyncCount, getFailedSyncItems } from '@/app/pengaturan/actions';

// Debounce helper
function useDebounce(callback: () => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current();
    }, delay);
  }, [delay]);
}

export function SyncEngine() {
  const { setSyncState, setPendingCount, setFailedCount, registerSyncFunction } = useSync();
  const isSyncingRef = useRef(false);

  // Fungsi sinkronisasi utama
  const executeSync = async () => {
    // Hindari sinkronisasi bertumpuk
    if (isSyncingRef.current) return;
    
    // Cek koneksi internet browser
    if (!navigator.onLine) {
      setSyncState('OFFLINE');
      return;
    }

    try {
      isSyncingRef.current = true;
      setSyncState('SYNCING');

      // 1. Dapatkan antrean saat ini
      const pendingCount = await getPendingSyncCount();
      setPendingCount(pendingCount);

      // 2. Jalankan Server Action sinkronisasi ke Supabase
      const result = await syncToCloud();

      // 3. Evaluasi hasil
      const remainingPending = await getPendingSyncCount();
      const failedItems = await getFailedSyncItems();
      
      setPendingCount(remainingPending);
      setFailedCount(failedItems.length);

      if (!result.success && failedItems.length > 0) {
        setSyncState('ERROR');
      } else if (remainingPending > 0) {
        // Jika masih ada sisa antrean (misal karena batch limit 50)
        setSyncState('SYNCING');
        // Akan dipanggil lagi di cycle berikutnya
      } else {
        setSyncState('SYNCED');
      }

    } catch (error) {
      console.error('Error executing sync:', error);
      setSyncState('ERROR');
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Daftarkan fungsi ke Context agar komponen lain bisa panggil (Manual / Event Trigger)
  const debouncedSync = useDebounce(executeSync, 5000); // 5 detik debounce untuk event-based
  
  useEffect(() => {
    registerSyncFunction(async () => {
      debouncedSync();
    });
  }, [registerSyncFunction, debouncedSync]);

  // Interval Polling (30 detik)
  useEffect(() => {
    // Initial fetch to get status
    executeSync();

    const interval = setInterval(() => {
      executeSync();
    }, 30000); // 30 detik

    // Event listener untuk offline/online
    const handleOnline = () => {
      setSyncState('SYNCING');
      executeSync(); // Segera sync saat internet kembali
    };
    const handleOffline = () => setSyncState('OFFLINE');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Komponen siluman (tidak merender UI apapun)
  return null;
}
