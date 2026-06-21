// src/app/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type PaymentMethod = 'cash' | 'qris' | 'debit' | 'utang';

// Interface payload checkout dari client
interface CheckoutPayload {
  memberId?: string;
  items: {
    productId: string;
    priceAtTime: number;
    quantity: number;
    subtotal: number;
  }[];
  totalAmount: number;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;   // Wajib jika cash
  approvalCode?: string;   // Wajib jika debit
  cashierName: string;
  shiftId: string | null;
  debtorInfo?: {
    debtorName: string;
    debtorPhone?: string;
    debtorNotes?: string;
    memberId?: string;
    isLimitOverride?: boolean;
  };
}

const VALID_METHODS: PaymentMethod[] = ['cash', 'qris', 'debit', 'utang'];
const APPROVAL_REGEX = /^[A-Z0-9]{4,8}$/;

export async function processCheckout(payload: CheckoutPayload) {
  try {
    const { totalAmount, discountAmount = 0, paymentMethod, cashReceived, approvalCode, debtorInfo, items, cashierName, shiftId } = payload;

    // ═══════════════════════════════════════════
    // VALIDASI SERVER-SIDE (tidak percaya client)
    // ═══════════════════════════════════════════

    // 1. Metode pembayaran harus valid
    if (!VALID_METHODS.includes(paymentMethod)) {
      return { success: false, error: 'Metode pembayaran tidak valid.' };
    }

    // 2. Harus ada minimal 1 item
    if (!items || items.length === 0) {
      return { success: false, error: 'Keranjang belanja kosong.' };
    }

    // 3. Validasi khusus per metode
    if (paymentMethod === 'cash') {
      if (cashReceived == null || cashReceived <= 0) {
        return { success: false, error: 'Nominal uang tunai tidak valid.' };
      }
      if (cashReceived < totalAmount) {
        return { success: false, error: 'Uang tunai kurang dari total belanja.' };
      }
    }

    if (paymentMethod === 'debit') {
      if (!approvalCode) {
        return { success: false, error: 'Kode approval EDC wajib diisi untuk pembayaran Debit.' };
      }
      const cleanCode = approvalCode.toUpperCase().trim();
      if (!APPROVAL_REGEX.test(cleanCode)) {
        return { success: false, error: 'Kode approval harus 4–8 karakter alphanumeric (A–Z, 0–9).' };
      }
    }

    if (paymentMethod === 'utang') {
      if (!debtorInfo || !debtorInfo.debtorName) {
        return { success: false, error: 'Informasi pengutang (nama) wajib diisi untuk transaksi utang.' };
      }
    }

    // ═══════════════════════════════════════════
    // HITUNG NILAI FINAL DI SERVER
    // ═══════════════════════════════════════════
    const finalCashReceived = paymentMethod === 'cash' ? cashReceived! : null;
    const finalChange = paymentMethod === 'cash' ? cashReceived! - totalAmount : null;
    const finalApprovalCode = paymentMethod === 'debit'
      ? approvalCode!.toUpperCase().trim()
      : null;

    // ═══════════════════════════════════════════
    // EKSEKUSI DATABASE ATOMIK
    // ═══════════════════════════════════════════
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeString = date.toTimeString().slice(0, 8).replace(/:/g, '');
    const receiptNumber = `TRX-${dateString}-${timeString}`;

    const result = await prisma.$transaction(async (tx) => {
      // Ambil data produk terbaru untuk mendapatkan harga beli (HPP)
      const productsData = await tx.product.findMany({
        where: { id: { in: items.map(i => i.productId) } }
      });
      const productMap = new Map(productsData.map(p => [p.id, p]));

      // A. Simpan Header Transaksi dengan semua field payment
      const transaction = await tx.transaction.create({
        data: {
          receiptNumber,
          memberId: payload.memberId || null,
          totalAmount,
          discountAmount,
          paymentMethod,
          cashReceived: finalCashReceived,
          change: finalChange,
          approvalCode: finalApprovalCode,
          cashierName,
          shiftId,
          details: {
            create: items.map((item) => {
              const pData = productMap.get(item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                priceBuyAtTime: pData?.priceBuy || 0, // Fallback ke 0 jika tidak ada
                priceAtTime: item.priceAtTime,
                subtotal: item.subtotal,
              };
            }),
          },
        },
        include: {
          details: { include: { product: true } },
          member: true,
        },
      });

      // B. Kurangi stok produk secara sekuensial (dengan validasi)
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stok ${product.name} tidak mencukupi (Sisa: ${product.stock}).`);
        }
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        const stockLog = await tx.stockLog.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            amount: item.quantity,
            stockBefore: product.stock,
            stockAfter: updatedProduct.stock,
            referenceId: transaction.id,
            employeeId: cashierName || 'Kasir',
            syncStatus: 'PENDING'
          }
        });

        // Queue Product update to Cloud
        await tx.syncQueue.create({
          data: {
            tableName: 'Product',
            recordId: updatedProduct.id,
            operation: 'UPDATE',
            payload: JSON.stringify(updatedProduct),
            status: 'PENDING'
          }
        });

        // Queue StockLog insert to Cloud
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

      // D. Buat Record Utang jika metode pembayaran adalah utang
      let debtRecord = null;
      if (paymentMethod === 'utang' && debtorInfo) {
        debtRecord = await tx.debt.create({
          data: {
            transactionId: transaction.id,
            debtorName: debtorInfo.debtorName,
            debtorPhone: debtorInfo.debtorPhone || null,
            debtorNotes: debtorInfo.debtorNotes || null,
            memberId: debtorInfo.memberId || null,
            totalAmount: totalAmount - discountAmount, // hutang netto
            paidAmount: 0,
            remaining: totalAmount - discountAmount,
            status: 'UNPAID',
            kasirId: cashierName || 'Kasir',
            isLimitOverride: debtorInfo.isLimitOverride || false,
            syncStatus: 'PENDING'
          }
        });

        // Queue Debt insert to Cloud
        await tx.syncQueue.create({
          data: {
            tableName: 'Debt',
            recordId: debtRecord.id,
            operation: 'INSERT',
            payload: JSON.stringify(debtRecord),
            status: 'PENDING'
          }
        });
      }

      // C. Masukkan ke SyncQueue (payload lengkap termasuk field payment baru)
      const syncPayload = JSON.stringify({
        id: transaction.id,
        receiptNumber: transaction.receiptNumber,
        memberId: transaction.memberId,
        totalAmount: transaction.totalAmount,
        discountAmount: transaction.discountAmount,
        paymentMethod: transaction.paymentMethod,
        cashReceived: transaction.cashReceived,
        change: transaction.change,
        approvalCode: transaction.approvalCode,
        cashierName: transaction.cashierName,
        shiftId: transaction.shiftId,
        isVoid: transaction.isVoid,
        createdAt: transaction.createdAt,
        details: transaction.details.map((d) => ({
          id: d.id,
          transactionId: d.transactionId,
          productId: d.productId,
          quantity: d.quantity,
          priceBuyAtTime: d.priceBuyAtTime,
          priceAtTime: d.priceAtTime,
          subtotal: d.subtotal,
        })),
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Transaction',
          recordId: transaction.id,
          operation: 'INSERT',
          payload: syncPayload,
          status: 'PENDING',
        },
      });

      return transaction;
    });

    // Refresh halaman yang terdampak
    revalidatePath('/');
    revalidatePath('/produk');
    revalidatePath('/transaksi');

    return { success: true, receiptNumber: result.receiptNumber };

  } catch (error) {
    console.error('Error proses kasir:', error);
    return { success: false, error: 'Gagal memproses transaksi. Silakan coba lagi.' };
  }
}