import prisma from '@/lib/db';
import BukuUtangClient from './BukuUtangClient';
import { getStoreProfile } from '@/app/pengaturan/actions';

export const dynamic = 'force-dynamic';

export default async function BukuUtangPage() {
  const storeProfile = await getStoreProfile();

  const debts = await prisma.debt.findMany({
    where: {
      transaction: {
        isVoid: false
      }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      transaction: true,
      payments: {
        orderBy: { paidAt: 'desc' }
      }
    }
  });

  const employees = await prisma.employee.findMany({
    where: { isActive: true }
  });

  return <BukuUtangClient initialDebts={debts} employees={employees} storeProfile={storeProfile} />;
}
