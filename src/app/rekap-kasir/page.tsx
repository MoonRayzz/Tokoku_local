import React from 'react';
import prisma from '@/lib/db';
import { PageTransition } from '@/components/ui/PageTransition';
import RekapClient from './RekapClient';

export default async function RekapKasirPage() {
  const [employees, shifts, activeAttendances] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.shift.findMany({
      where: { isActive: true },
    }),
    prisma.attendance.findMany({
      where: {
        checkIn: { not: null },
        checkOut: null
      },
      include: {
        employee: true,
        shift: true
      }
    }),
  ]);

  return (
    <PageTransition className="h-full">
      <RekapClient 
        employees={employees} 
        shifts={shifts} 
        activeAttendances={activeAttendances} 
      />
    </PageTransition>
  );
}
