// src/app/pengaturan/actions.ts
'use server'

import prisma from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function syncToCloud() {
  try {
    // Memeriksa ketersediaan konfigurasi Supabase
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { success: false, error: 'Kredensial Supabase belum diatur di file .env' };
    }

    // Mengambil maksimal 50 antrean terlama untuk mencegah timeout
    const pendingItems = await prisma.syncQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    if (pendingItems.length === 0) {
      return { success: true, message: 'Semua data sudah tersinkronisasi dengan Cloud.' };
    }

    let syncedCount = 0;

    for (const item of pendingItems) {
      const payload = JSON.parse(item.payload);
      let syncError = null;

      try {
        if (item.tableName === 'Transaction') {
          // Pisahkan relasi nested — Supabase tidak menerima nested insert
          const { details, member, ...mainTx } = payload;

          // Set memberId ke null agar tidak gagal akibat FK ke tabel Member
          // Ganti nilai null menjadi 0/string kosong untuk payment fields yang tidak support null di Supabase lama
          const txPayload = { 
            ...mainTx, 
            memberId: null,
            cashReceived: mainTx.cashReceived ?? 0,
            change: mainTx.change ?? 0,
            approvalCode: mainTx.approvalCode ?? ''
          };

          // 1. Push Header Transaksi
          console.log('Sending txPayload to Supabase:', txPayload);
          const { error: txError } = await supabase.from('Transaction').upsert(txPayload);
          if (txError) throw txError;

          // 2. Push Detail Barang Transaksi
          if (details && Array.isArray(details) && details.length > 0) {
            // Bersihkan field relasi nested (product obj) yang tidak ada di kolom Supabase
            const detailPayload = details.map(({ product, ...d }: any) => d);
            const { error: detailsError } = await supabase.from('TransactionDetail').upsert(detailPayload);
            if (detailsError) throw detailsError;
          }
        } else {
          // Fallback untuk tabel lain (misal jika nanti Anda menambahkan sync Produk/Member)
          const { error } = await supabase.from(item.tableName).upsert(payload);
          if (error) throw error;
        }

        // Jika berhasil push ke Supabase, update status di SQLite lokal menjadi SYNCED
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: 'SYNCED', errorMessage: null }
        });
        
        syncedCount++;

      } catch (error: any) {
        console.error(`Gagal sync item ${item.id}:`, error);
        syncError = error;
        
        // Catat pesan error dari Supabase ke SQLite lokal
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { errorMessage: error.message || 'Unknown error' }
        });
      }
    }

    // Refresh semua layout yang memiliki indikator antrean
    revalidatePath('/', 'layout');
    
    if (syncedCount === pendingItems.length) {
      return { success: true, message: `Sukses! ${syncedCount} transaksi berhasil dikirim ke Supabase.` };
    } else {
      return { success: false, error: `Hanya berhasil ${syncedCount} dari ${pendingItems.length}. Cek koneksi internet.` };
    }

  } catch (error) {
    console.error('Fatal Sync Error:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menjalankan sinkronisasi.' };
  }
}