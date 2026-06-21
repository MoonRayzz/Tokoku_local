// src/app/transaksi/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function voidTransaction(transactionId: string, pin: string, reason: string, notes: string, employeeId: string) {
  // Ambil profil toko untuk mendapatkan PIN Void
  const storeProfile = await prisma.storeProfile.findUnique({
    where: { id: 'local-store' }
  });

  if (!storeProfile || pin !== storeProfile.voidPin) {
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
        const product = await tx.product.findUnique({ where: { id: detail.productId }});
        if (!product) continue;

        const updatedProduct = await tx.product.update({
          where: { id: detail.productId },
          data: {
            stock: { increment: detail.quantity }
          }
        });

        // Catat pengembalian stok akibat void
        const stockLog = await tx.stockLog.create({
          data: {
            productId: detail.productId,
            type: 'VOID_RETURN',
            amount: detail.quantity,
            stockBefore: product.stock,
            stockAfter: updatedProduct.stock,
            referenceId: transaction.id,
            employeeId: 'Manager', // Sesuai dengan auth pin statis di atas
            syncStatus: 'PENDING'
          }
        });

        // Queue Product update
        await tx.syncQueue.create({
          data: {
            tableName: 'Product',
            recordId: updatedProduct.id,
            operation: 'UPDATE',
            payload: JSON.stringify(updatedProduct),
            status: 'PENDING'
          }
        });

        // Queue StockLog insert
        await tx.syncQueue.create({
          data: {
            tableName: 'StockLog',
            recordId: stockLog.id,
            operation: 'INSERT',
            payload: JSON.stringify(stockLog),
            status: 'PENDING'
          }
        });
      }

      // 3. Buat VoidLog
      const voidLog = await tx.voidLog.create({
        data: {
          transactionId: transaction.id,
          reason,
          notes,
          employeeId,
          syncStatus: 'PENDING'
        }
      });

      // 4. Masukkan aktivitas Void ke dalam antrean sinkronisasi cloud
      await tx.syncQueue.create({
        data: {
          tableName: 'Transaction',
          recordId: transaction.id,
          operation: 'UPDATE', // Karena kita mengubah kolom isVoid
          payload: JSON.stringify(updatedTx),
          status: 'PENDING'
        }
      });

      // Queue VoidLog insert
      await tx.syncQueue.create({
        data: {
          tableName: 'VoidLog',
          recordId: voidLog.id,
          operation: 'INSERT',
          payload: JSON.stringify(voidLog),
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