// src/app/transaksi/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import TransactionManager from './TransactionManager';
import { PageTransition } from '@/components/ui/PageTransition';
import { PAGE_SIZE } from '@/lib/constants';

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const pageParam = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const searchParam = typeof resolvedParams.search === 'string' ? resolvedParams.search : '';
  const methodParam = typeof resolvedParams.method === 'string' ? resolvedParams.method : 'all';

  const limit = PAGE_SIZE.TRANSAKSI;

  const whereClause: any = {};
  if (searchParam) {
    whereClause.OR = [
      { receiptNumber: { contains: searchParam } },
      { member: { name: { contains: searchParam } } }
    ];
  }
  if (methodParam !== 'all') {
    whereClause.paymentMethod = methodParam;
  }

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where: whereClause,
      include: {
        member: {
          select: { name: true, phone: true }
        },
        details: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where: whereClause })
  ]);

  // Hitung summary global (bukan per halaman)
  // Summary biasanya hanya untuk filter yang aktif saat ini, atau total keseluruhan?
  // Kita buat total keseluruhan yang tidak di-void
  const [cash, qris, debit, grand] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { totalAmount: true }, where: { isVoid: false, paymentMethod: 'cash' } }),
    prisma.transaction.aggregate({ _sum: { totalAmount: true }, where: { isVoid: false, paymentMethod: 'qris' } }),
    prisma.transaction.aggregate({ _sum: { totalAmount: true }, where: { isVoid: false, paymentMethod: 'debit' } }),
    prisma.transaction.aggregate({ _sum: { totalAmount: true }, where: { isVoid: false } })
  ]);

  const dbSummary = {
    cash: cash._sum.totalAmount || 0,
    qris: qris._sum.totalAmount || 0,
    debit: debit._sum.totalAmount || 0,
    grand: grand._sum.totalAmount || 0,
  };

  const shifts = await prisma.shift.findMany({ select: { id: true, name: true } });

  const storeProfile = await prisma.storeProfile.findUnique({
    where: { id: 'local-store' }
  });

  const syncQueues = await prisma.syncQueue.findMany({
    where: {
      tableName: 'Transaction',
      recordId: { in: transactions.map(t => t.id) }
    }
  });

  const transactionsWithSyncStatus = transactions.map(tx => {
    const queuesForTx = syncQueues.filter(q => q.recordId === tx.id);
    const hasPending = queuesForTx.some(q => q.status === 'PENDING');
    return {
      ...tx,
      syncStatus: (hasPending || queuesForTx.length === 0) ? 'PENDING' : 'SYNCED'
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <PageTransition className="h-full">
      <TransactionManager 
        initialTransactions={transactionsWithSyncStatus} 
        shifts={shifts} 
        storeProfile={storeProfile} 
        dbSummary={dbSummary}
        totalPages={totalPages}
        totalCount={totalCount}
        currentPage={page}
        limit={limit}
        initialSearch={searchParam}
        initialMethod={methodParam as any}
      />
    </PageTransition>
  );
}
