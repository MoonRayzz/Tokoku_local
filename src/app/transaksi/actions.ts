// src/app/transaksi/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function voidTransaction(transactionId: string, pin: string) {
  // Dalam sistem nyata, PIN ini dicocokkan dengan tabel User/Admin.
  // Untuk arsitektur lokal ini, kita set statis "123456" sebagai PIN Manajer Toko.
  if (pin !== '123456') {
    return { success: false, error: 'Gagal: PIN Otorisasi tidak valid!' };
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { details: true }
    });

    if (!transaction) return { success: false, error: 'Transaksi tidak ditemukan.' };
    if (transaction.isVoid) return { success: false, error: 'Transaksi ini sudah dibatalkan sebelumnya.' };

    // Eksekusi pengembalian stok dan update status secara atomik
    await prisma.$transaction(async (tx) => {
      // 1. Tandai transaksi sebagai Void
      const updatedTx = await tx.transaction.update({
        where: { id: transactionId },
        data: { isVoid: true }
      });

      // 2. Kembalikan stok fisik untuk setiap barang yang ada di nota
      for (const detail of transaction.details) {
        await tx.product.update({
          where: { id: detail.productId },
          data: {
            stock: { increment: detail.quantity }
          }
        });
      }

      // 3. Masukkan aktivitas Void ini ke dalam antrean sinkronisasi cloud
      await tx.syncQueue.create({
        data: {
          tableName: 'Transaction',
          recordId: transaction.id,
          operation: 'UPDATE', // Karena kita mengubah kolom isVoid
          payload: JSON.stringify(updatedTx),
          status: 'PENDING'
        }
      });
    });

    // Refresh halaman agar tabel dan stok ter-update secara instan
    revalidatePath('/transaksi');
    revalidatePath('/produk');
    revalidatePath('/');

    return { success: true };
  } catch (error) {
    console.error('Error saat Void transaksi:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat membatalkan transaksi.' };
  }
}