// src/app/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import PosClient from './PosClient';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function POSPage() {
  const [products, members, tiers, txGrouped, allEmployees, shifts, activeAttendances, storeProfile] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, sku: true, name: true, priceRetail: true, priceWholesale: true, wholesaleMinQty: true, stock: true }
    }),
    prisma.member.findMany({
      select: { id: true, name: true, phone: true }
    }),
    prisma.memberTier.findMany({
      orderBy: [
        { minTransactions: 'desc' },
        { minTotalSpent: 'desc' }
      ]
    }),
    prisma.transaction.groupBy({
      by: ['memberId'],
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
      where: { memberId: { not: null }, isVoid: false }
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true }
    }),
    prisma.shift.findMany({
      where: { isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true }
    }),
    prisma.attendance.findMany({
      where: {
        checkIn: { not: null },
        checkOut: null
      },
      select: { employeeId: true }
    }),
    prisma.storeProfile.findUnique({
      where: { id: 'local-store' }
    })
  ]);

  const activeEmployeeIds = new Set(activeAttendances.map(a => a.employeeId));
  const employees = allEmployees.filter(e => activeEmployeeIds.has(e.id));

  const memberStats: Record<string, { txCount: number, totalSpent: number, lastTxDate: string | null }> = {};
  txGrouped.forEach(group => {
    if (group.memberId) {
      memberStats[group.memberId] = {
        txCount: group._count.id,
        totalSpent: group._sum.totalAmount || 0,
        lastTxDate: group._max.createdAt ? group._max.createdAt.toISOString() : null
      };
    }
  });

  return (
    <PageTransition className="h-full">
      <PosClient 
        products={products} 
        members={members} 
        tiers={tiers}
        memberStats={memberStats}
        employees={employees}
        shifts={shifts}
        storeProfile={storeProfile}
      />
    </PageTransition>
  );
}