'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { startOfDay, endOfDay } from 'date-fns';

export async function getSystemCash(employeeId: string, shiftId: string | null) {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);

  // Get starting cash (modal laci) for this employee today
  // Assumes starting cash is 0 if not tracked elsewhere, or we can fetch the last closed report
  // Let's assume startingCash is provided by the UI or fetched as 0 for now.
  const startingCash = 0; // The cashier will input this for now

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true }
  });

  if (!employee) {
    throw new Error("Kasir tidak ditemukan");
  }

  // Calculate Total Tunai (Cash transactions only)
  const txAgg = await prisma.transaction.aggregate({
    where: {
      cashierName: employee.name,
      createdAt: { gte: start, lte: end },
      paymentMethod: 'cash',
      isVoid: false,
      ...(shiftId ? { shiftId } : {})
    },
    _sum: {
      totalAmount: true,
      discountAmount: true
    }
  });
  
  // Actually, wait, Transaction doesn't have cashierId relation, it uses cashierName string.
  // And it has shiftId. Let's fetch all cash transactions for the shift.
  
  const rawSales = txAgg._sum.totalAmount || 0;
  const totalDiscount = txAgg._sum.discountAmount || 0;
  const netSales = rawSales; // totalAmount sudah merupakan harga akhir (net) setelah diskon

  // Calculate Expenses (Tunai out)
  const expenseAgg = await prisma.expense.aggregate({
    where: {
      employeeId: employeeId,
      date: { gte: start, lte: end },
      isVoid: false,
      ...(shiftId ? { shiftId } : {})
    },
    _sum: {
      amount: true
    }
  });

  const totalExpense = expenseAgg._sum.amount || 0;

  // Calculate Cicilan Piutang Masuk (DebtPayments)
  // DebtPayment currently doesn't track cashier or shift directly.
  // We'll approximate by time
  const debtPaymentAgg = await prisma.debtPayment.aggregate({
    where: {
      paidAt: { gte: start, lte: end }
    },
    _sum: { amount: true }
  });

  const totalCicilan = debtPaymentAgg._sum.amount || 0;

  const systemCash = netSales + totalCicilan - totalExpense;

  return {
    netSales,
    totalExpense,
    totalCicilan,
    systemCash
  };
}

export async function submitRekapKasir(data: {
  employeeId: string;
  shiftId: string | null;
  startTime: Date;
  startingCash: number;
  actualCash: number;
  systemCash: number;
  variance: number;
  totalSales: number;
  totalExpense: number;
  notes: string;
  actionAfterClose: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const report = await tx.cashRegisterReport.create({
        data: {
          employeeId: data.employeeId,
          shiftId: data.shiftId,
          startTime: data.startTime,
          endTime: new Date(),
          startingCash: data.startingCash,
          actualCash: data.actualCash,
          systemCash: data.systemCash,
          variance: data.variance,
          totalSales: data.totalSales,
          totalExpense: data.totalExpense,
          notes: data.notes,
          status: 'CLOSED',
          actionAfterClose: data.actionAfterClose,
          syncStatus: 'PENDING'
        }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'CashRegisterReport',
          recordId: report.id,
          operation: 'INSERT',
          payload: JSON.stringify(report),
          status: 'PENDING'
        }
      });
    });

    revalidatePath('/rekap-kasir');
    return { success: true };
  } catch (error) {
    console.error('Error submitting rekap:', error);
    return { success: false, error: 'Gagal menyimpan rekap kasir' };
  }
}
