import prisma from '@/lib/db';
import PurchaseOrderManager from './PurchaseOrderManager';
import { PageTransition } from '@/components/ui/PageTransition';

export const dynamic = 'force-dynamic';

export default async function TerimaStokPage() {
  const products = await prisma.product.findMany({
    orderBy: {
      name: 'asc'
    }
  });

  return (
    <PageTransition>
      <PurchaseOrderManager products={products} />
    </PageTransition>
  );
}
