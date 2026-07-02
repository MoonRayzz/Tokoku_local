// src/app/member/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import MemberManager from './MemberManager';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function MemberPage() {
  const [members, tiers, txGrouped, storeProfile] = await Promise.all([
    prisma.member.findMany({
      where: { isVoid: false },
      orderBy: { joinedAt: 'desc' },
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
      where: { memberId: { not: null }, isVoid: false }
    }),
    prisma.storeProfile.findUnique({ where: { id: 'local-store' } })
  ]);

  const memberStats: Record<string, { txCount: number, totalSpent: number }> = {};
  txGrouped.forEach(group => {
    if (group.memberId) {
      memberStats[group.memberId] = {
        txCount: group._count.id,
        totalSpent: group._sum.totalAmount || 0
      };
    }
  });

  return (
    <PageTransition className="h-full">
      <MemberManager 
        initialMembers={members} 
        tiers={tiers} 
        memberStats={memberStats} 
        storeProfile={storeProfile || { name: 'TokoKu', logoUrl: null }}
      />
    </PageTransition>
  );
}