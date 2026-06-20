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
      createdAt: 'desc',
    },
  });

  return (
    // Menggunakan Wrapper Animasi Framer Motion yang kita buat di awal
    <PageTransition className="h-full">
      {/* Melempar data dari Database ke komponen interaktif Client */}
      <ProductManager initialProducts={products} />
    </PageTransition>
  );
}