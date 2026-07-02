import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// [FIX W5] Force sync yang lengkap — re-queue semua data penting ke PENDING
export async function GET() {
  try {
    // 1. Products
    const products = await prisma.product.findMany();
    for (const p of products) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Product',
          recordId: p.id,
          operation: 'INSERT',
          payload: JSON.stringify(p),
          status: 'PENDING'
        }
      });
    }

    // 2. Members
    const members = await prisma.member.findMany();
    for (const m of members) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Member',
          recordId: m.id,
          operation: 'INSERT',
          payload: JSON.stringify(m),
          status: 'PENDING'
        }
      });
    }

    // 3. Suppliers
    const suppliers = await prisma.supplier.findMany();
    for (const s of suppliers) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Supplier',
          recordId: s.id,
          operation: 'INSERT',
          payload: JSON.stringify(s),
          status: 'PENDING'
        }
      });
    }

    // 4. Expenses (non-void)
    const expenses = await prisma.expense.findMany({ where: { isVoid: false } });
    for (const e of expenses) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Expense',
          recordId: e.id,
          operation: 'INSERT',
          payload: JSON.stringify(e),
          status: 'PENDING'
        }
      });
    }

    // 5. Debts (unpaid/partial)
    const debts = await prisma.debt.findMany({ where: { status: { not: 'PAID' } } });
    for (const d of debts) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Debt',
          recordId: d.id,
          operation: 'UPSERT',
          payload: JSON.stringify(d),
          status: 'PENDING'
        }
      });
    }

    // 6. CashRegisterReports
    const reports = await prisma.cashRegisterReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    for (const r of reports) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'CashRegisterReport',
          recordId: r.id,
          operation: 'INSERT',
          payload: JSON.stringify(r),
          status: 'PENDING'
        }
      });
    }

    // 7. Reset Transaction yang FAILED agar dicoba ulang
    const resetCount = await prisma.syncQueue.updateMany({
      where: { tableName: 'Transaction', status: { in: ['FAILED', 'FAILED_PERMANENT'] } },
      data: { status: 'PENDING', retryCount: 0 }
    });

    return NextResponse.json({
      success: true,
      message: `Force sync queued: ${products.length} products, ${members.length} members, ${suppliers.length} suppliers, ${expenses.length} expenses, ${debts.length} debts, ${reports.length} reports. Reset ${resetCount.count} failed transactions.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}

