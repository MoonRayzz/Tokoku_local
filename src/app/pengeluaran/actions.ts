'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';

export async function getExpenses(page: number = 1, limit: number = 20) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const whereClause = {
    date: {
      gte: today,
    },
  };

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
