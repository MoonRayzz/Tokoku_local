// src/app/produk/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import ProductManager from './ProductManager';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function ProdukPage() {
  // Query ke database lokal SQLite secara Server-Side
  // Mengambil data dan mengurutkannya berdasarkan produk yang paling baru ditambahkan
  const products = await prisma.product.findMany({
    orderBy: {
      stock: 'asc',
    },
  });

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

  return (
    // Menggunakan Wrapper Animasi Framer Motion yang kita buat di awal
    <PageTransition className="h-full">
      {/* Melempar data dari Database ke komponen interaktif Client */}
      <ProductManager initialProducts={productsWithSyncStatus as any} />
    </PageTransition>
  );
}