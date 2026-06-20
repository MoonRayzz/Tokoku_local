'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';

export async function getExpenses() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await prisma.expense.findMany({
    where: {
      date: {
        gte: today,
      },
    },
    include: {
      employee: true,
      shift: true,
    },
    orderBy: {
      date: 'desc',
    },
  });
}

export async function addExpense(formData: FormData) {
  try {
    const category = formData.get('category') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const notes = formData.get('notes') as string | null;

    if (!category || !amount || isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Data pengeluaran tidak valid.' };
    }

    // Karena belum ada sistem login, kita ambil atau buat employee dummy
    let employee = await prisma.employee.findFirst();
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          name: 'Admin',
          role: 'kasir',
          isActive: true,
        }
      });
    }

    // Ambil shift aktif (jika ada)
    const activeShift = await prisma.shift.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const expense = await prisma.$transaction(async (tx) => {
      // 1. Simpan pengeluaran
      const newExpense = await tx.expense.create({
        data: {
          category,
          amount,
          notes,
          employeeId: employee.id,
          shiftId: activeShift?.id || null,
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
