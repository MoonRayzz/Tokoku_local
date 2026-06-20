// src/app/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type PaymentMethod = 'cash' | 'qris' | 'debit';

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
  paymentMethod: PaymentMethod;
  cashReceived?: number;   // Wajib jika cash
  approvalCode?: string;   // Wajib jika debit
}

const VALID_METHODS: PaymentMethod[] = ['cash', 'qris', 'debit'];
const APPROVAL_REGEX = /^[A-Z0-9]{4,8}$/;

export async function processCheckout(payload: CheckoutPayload) {
  try {
    const { totalAmount, paymentMethod, cashReceived, approvalCode, items } = payload;

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

      // A. Simpan Header Transaksi dengan semua field payment
      const transaction = await tx.transaction.create({
        data: {
          receiptNumber,
          memberId: payload.memberId || null,
          totalAmount,
          paymentMethod,
          cashReceived: finalCashReceived,
          change: finalChange,
          approvalCode: finalApprovalCode,
          details: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtTime: item.priceAtTime,
              subtotal: item.subtotal,
            })),
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
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // C. Masukkan ke SyncQueue (payload lengkap termasuk field payment baru)
      const syncPayload = JSON.stringify({
        id: transaction.id,
        receiptNumber: transaction.receiptNumber,
        memberId: transaction.memberId,
        totalAmount: transaction.totalAmount,
        paymentMethod: transaction.paymentMethod,
        cashReceived: transaction.cashReceived,
        change: transaction.change,
        approvalCode: transaction.approvalCode,
        isVoid: transaction.isVoid,
        createdAt: transaction.createdAt,
        details: transaction.details.map((d) => ({
          id: d.id,
          transactionId: d.transactionId,
          productId: d.productId,
          quantity: d.quantity,
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