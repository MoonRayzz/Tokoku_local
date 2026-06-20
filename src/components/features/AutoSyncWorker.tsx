// src/components/features/AutoSyncWorker.tsx
'use client'

import { useEffect, useRef } from 'react';
import { syncToCloud } from '@/app/pengaturan/actions';

export function AutoSyncWorker() {
  const isSyncing = useRef(false);

  useEffect(() => {
    // Mengatur interval detak pekerja setiap 15 detik (15000 milidetik)
    const interval = setInterval(async () => {
      
      // Pekerja hanya akan mengeksekusi sinkronisasi JIKA:
      // 1. Browser mendeteksi adanya koneksi internet (navigator.onLine === true)
      // 2. Tidak ada proses sinkronisasi lain yang sedang berjalan (mencegah bentrok/spam data)
      if (navigator.onLine && !isSyncing.current) {
        isSyncing.current = true;
        
        try {
          // Memanggil fungsi sinkronisasi utama kita secara diam-diam
          await syncToCloud();
        } catch (error) {
          console.error('Pekerja Latar Belakang: Gagal melakukan auto-sync', error);
        } finally {
          // Lepaskan kunci setelah selesai atau gagal, agar 15 detik berikutnya bisa mencoba lagi
          isSyncing.current = false;
        }
      }
      
    }, 15000);

    // Membersihkan interval jika aplikasi ditutup untuk mencegah memory leak
    return () => clearInterval(interval);
  }, []);

  // Komponen ini adalah "Pekerja Bayangan", jadi tidak ada elemen HTML yang dirender
  return null;
}