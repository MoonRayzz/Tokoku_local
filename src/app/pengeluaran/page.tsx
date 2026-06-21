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

  const { expenses, totalCount } = await getExpenses(page, limit);

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

  return (
    <ExpenseManager 
      expenses={expensesWithSyncStatus as any} 
      totalPages={totalPages}
      totalCount={totalCount}
      currentPage={page}
      limit={limit}
    />
  );
}
