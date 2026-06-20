// src/app/member/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import MemberManager from './MemberManager';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function MemberPage() {
  // Query ke SQLite lokal: Mengambil data member DAN menghitung jumlah relasi transaksinya
  const members = await prisma.member.findMany({
    include: {
      _count: {
        select: { Transaction: true }
      }
    },
    orderBy: {
      joinedAt: 'desc',
    },
  });

  return (
    <PageTransition className="h-full">
      <MemberManager initialMembers={members} />
    </PageTransition>
  );
}