// src/app/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import PosClient from './PosClient';
import { PageTransition } from '@/components/ui/PageTransition';

export default async function POSPage() {
  // Ambil semua data secara asinkron dari SQLite
  // Di sistem POS sesungguhnya, batas pengambilan mungkin diperlukan jika data ribuan,
  // namun untuk skala lokal, mengambil semuanya memastikan respon scanner 0 milidetik.
  const [products, members] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, sku: true, name: true, priceRetail: true, priceWholesale: true, wholesaleMinQty: true, stock: true }
    }),
    prisma.member.findMany({
      select: { id: true, name: true, phone: true }
    })
  ]);

  return (
    <PageTransition className="h-full">
      <PosClient products={products} members={members} />
    </PageTransition>
  );
}