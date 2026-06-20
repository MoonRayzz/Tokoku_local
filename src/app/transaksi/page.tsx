// src/app/transaksi/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import TransactionManager from './TransactionManager';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function TransaksiPage() {
  // Query ke database: Ambil transaksi beserta semua field payment baru
  const transactions = await prisma.transaction.findMany({
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
  });

  const shifts = await prisma.shift.findMany({ select: { id: true, name: true } });

  // Cari status sinkronisasi untuk transaksi dari SyncQueue
  const syncQueues = await prisma.syncQueue.findMany({
    where: {
      tableName: 'Transaction',
      recordId: { in: transactions.map(t => t.id) }
    }
  });

  const transactionsWithSyncStatus = transactions.map(tx => {
    const queuesForTx = syncQueues.filter(q => q.recordId === tx.id);
    const hasPending = queuesForTx.some(q => q.status === 'PENDING');
    // Jika tidak ada data di SyncQueue, asumsikan sudah disinkronisasi atau biarkan PENDING jika lebih aman
    // Di sini kita asumsikan jika tidak PENDING maka SYNCED
    return {
      ...tx,
      syncStatus: (hasPending || queuesForTx.length === 0) ? 'PENDING' : 'SYNCED'
    };
  });

  return (
    <PageTransition className="h-full">
      <TransactionManager initialTransactions={transactionsWithSyncStatus} shifts={shifts} />
    </PageTransition>
  );
}
