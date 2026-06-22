'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';

export async function getExpenses(page: number = 1, limit: number = 20, dateFilter?: string) {
  const skip = (page - 1) * limit;

  let whereClause: any = {};
  if (dateFilter) {
    const startOfDay = new Date(dateFilter);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateFilter);
    endOfDay.setHours(23, 59, 59, 999);
    whereClause.date = { gte: startOfDay, lte: endOfDay };
  }

  const [expenses, totalCount] = await Promise.all([
    prisma.expense.findMany({
      where: whereClause,
      include: {
        employee: true,
        shift: true,
      },
      orderBy: {
        date: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where: whereClause })
  ]);

  return { expenses, totalCount };
}

export async function addExpense(formData: FormData) {
  try {
    const category = formData.get('category') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const notes = formData.get('notes') as string | null;

    const employeeId = formData.get('employeeId') as string;
    const shiftId = formData.get('shiftId') as string;

    if (!category || !amount || isNaN(amount) || amount <= 0 || !employeeId || !shiftId) {
      return { success: false, error: 'Semua field (Kategori, Nominal, Karyawan, Sesi) wajib diisi.' };
    }

    const expense = await prisma.$transaction(async (tx) => {
      // 1. Simpan pengeluaran
      const newExpense = await tx.expense.create({
        data: {
          category,
          amount,
          notes,
          employeeId: employeeId,
          shiftId: shiftId,
          syncStatus: 'PENDING',
        }
      });

      // 2. Tambahkan ke SyncQueue
      await tx.syncQueue.create({
        data: {
          tableName: 'Expense',
          recordId: newExpense.id,
          operation: 'INSERT',
          payload: JSON.stringify(newExpense),
          status: 'PENDING'
        }
      });

      return newExpense;
    });

    revalidatePath('/pengeluaran');
    revalidatePath('/laporan'); // Update laporan shift
    return { success: true, data: expense };
  } catch (error: any) {
    console.error('Error addExpense:', error);
    return { success: false, error: error.message };
  }
}

export async function voidExpense(expenseId: string, pin: string) {
  try {
    const profile = await prisma.storeProfile.findFirst();
    if (!profile) return { success: false, error: 'Profil toko tidak ditemukan' };
    if (profile.voidPin !== pin) return { success: false, error: 'PIN Pembatalan salah' };

    const expense = await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findUnique({ where: { id: expenseId } });
      if (!existing) throw new Error('Pengeluaran tidak ditemukan');
      if (existing.isVoid) throw new Error('Pengeluaran sudah dibatalkan');

      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          isVoid: true,
          syncStatus: 'PENDING'
        }
      });

      // 2. Tambahkan ke SyncQueue agar perubahan isVoid tersinkron ke cloud
      await tx.syncQueue.create({
        data: {
          tableName: 'Expense',
          recordId: updated.id,
          operation: 'UPDATE',
          payload: JSON.stringify(updated),
          status: 'PENDING'
        }
      });

      return updated;
    });

    revalidatePath('/pengeluaran');
    revalidatePath('/laporan');
    return { success: true, data: expense };
  } catch (error: any) {
    console.error('Error voidExpense:', error);
    return { success: false, error: error.message };
  }
}
