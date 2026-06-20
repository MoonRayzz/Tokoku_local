import { getExpenses } from './actions';
import ExpenseManager from './ExpenseManager';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PengeluaranPage() {
  const expenses = await getExpenses();

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

  return (
    <ExpenseManager expenses={expensesWithSyncStatus as any} />
  );
}
