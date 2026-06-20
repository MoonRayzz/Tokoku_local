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

  return (
    <PageTransition className="h-full">
      <TransactionManager initialTransactions={transactions} shifts={shifts} />
    </PageTransition>
  );
}
