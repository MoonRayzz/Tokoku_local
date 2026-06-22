import { getExpenses } from './actions';
import ExpenseManager from './ExpenseManager';
import prisma from '@/lib/db';
import { PAGE_SIZE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const pageParam = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const limit = PAGE_SIZE.PENGELUARAN;

  const dateParam = typeof resolvedParams.date === 'string' ? resolvedParams.date : undefined;

  const { expenses, totalCount } = await getExpenses(page, limit, dateParam);

  const syncQueues = await prisma.syncQueue.findMany({
    where: {
      tableName: 'Expense',
      recordId: { in: expenses.map(e => e.id) }
    }
  });

  const expensesWithSyncStatus = expenses.map(exp => {
    const queuesForExp = syncQueues.filter(q => q.recordId === exp.id);
    const hasPending = queuesForExp.some(q => q.status === 'PENDING');
    return {
      ...exp,
      syncStatus: (hasPending || queuesForExp.length === 0) ? 'PENDING' : 'SYNCED'
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  // Ambil daftar karyawan yang sedang absen masuk (checkOut masih null)
  const activeAttendances = await prisma.attendance.findMany({
    where: { checkOut: null },
    include: { employee: true },
    orderBy: { checkIn: 'desc' }
  });
  
  // Ekstrak data employee saja, hapus duplikat jika ada (meski jarang)
  const activeEmployees = Array.from(new Map(activeAttendances.map(a => [a.employee.id, a.employee])).values());

  // Ambil daftar shift (sesi) yang aktif
  const activeShifts = await prisma.shift.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <ExpenseManager 
      expenses={expensesWithSyncStatus as any} 
      totalPages={totalPages}
      totalCount={totalCount}
      currentPage={page}
      limit={limit}
      activeEmployees={activeEmployees}
      activeShifts={activeShifts}
    />
  );
}
