// src/app/produk/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import ProductManager from './ProductManager';
import { PageTransition } from '@/components/ui/PageTransition';
import { PAGE_SIZE } from '@/lib/constants';

export default async function ProdukPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  const pageParam = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const searchParam = typeof resolvedParams.search === 'string' ? resolvedParams.search : '';

  const limit = PAGE_SIZE.PRODUK;

  const whereClause: any = searchParam ? {
    OR: [
      { name: { contains: searchParam } },
      { sku: { contains: searchParam } },
      { barcode: { contains: searchParam } }
    ]
  } : {};

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      orderBy: { stock: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: whereClause })
  ]);

  const syncQueues = await prisma.syncQueue.findMany({
    where: {
      tableName: 'Product',
      recordId: { in: products.map(p => p.id) }
    }
  });

  const productsWithSyncStatus = products.map(prod => {
    const queuesForProd = syncQueues.filter(q => q.recordId === prod.id);
    const hasPending = queuesForProd.some(q => q.status === 'PENDING');
    return {
      ...prod,
      syncStatus: (hasPending || queuesForProd.length === 0) ? 'PENDING' : 'SYNCED'
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <PageTransition className="h-full">
      <ProductManager 
        initialProducts={productsWithSyncStatus as any} 
        totalPages={totalPages}
        totalCount={totalCount}
        currentPage={page}
        limit={limit}
        initialSearch={searchParam}
      />
    </PageTransition>
  );
}