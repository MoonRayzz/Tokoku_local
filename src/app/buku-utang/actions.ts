'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function processDebtPayment(debtId: string, amount: number, kasirId: string, notes?: string) {
  try {
    if (!amount || amount <= 0) {
      return { success: false, error: 'Nominal pembayaran tidak valid.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id: debtId } });
      if (!debt) throw new Error('Data utang tidak ditemukan.');
      if (debt.remaining < amount) throw new Error('Nominal pembayaran melebihi sisa utang.');

      const newRemaining = debt.remaining - amount;
      const newPaidAmount = debt.paidAmount + amount;
      const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          remaining: newRemaining,
          paidAmount: newPaidAmount,
          status: newStatus,
          syncStatus: 'PENDING',
        }
      });

      const paymentRecord = await tx.debtPayment.create({
        data: {
          debtId,
          amount,
          kasirId,
          notes,
          syncStatus: 'PENDING',
        }
      });

      // Queue Debt update
      await tx.syncQueue.create({
        data: {
          tableName: 'Debt',
          recordId: updatedDebt.id,
          operation: 'UPDATE',
          payload: JSON.stringify(updatedDebt),
          status: 'PENDING'
        }
      });

      // Queue DebtPayment insert
      await tx.syncQueue.create({
        data: {
          tableName: 'DebtPayment',
          recordId: paymentRecord.id,
          operation: 'INSERT',
          payload: JSON.stringify(paymentRecord),
          status: 'PENDING'
        }
      });

      return { payment: paymentRecord, updatedDebt };
    });

    revalidatePath('/buku-utang');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error bayar utang:', error);
    return { success: false, error: error.message || 'Gagal memproses pembayaran.' };
  }
}
