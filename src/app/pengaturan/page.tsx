// src/app/pengaturan/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import SettingsManager from './SettingsManager';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function PengaturanPage() {
  // Query ke database lokal SQLite untuk mengecek sisa antrean yang tertunda
  let pendingCount = 0;
  
  try {
    pendingCount = await prisma.syncQueue.count({
      where: { status: 'PENDING' }
    });
  } catch (error) {
    console.error("Gagal menghitung SyncQueue:", error);
  }

  return (
    <PageTransition className="h-full">
      <SettingsManager pendingSyncCount={pendingCount} />
    </PageTransition>
  );
}