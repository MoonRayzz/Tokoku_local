// src/app/api/seed/route.ts
import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Daftar produk ujicoba realistis (Diambil dari referensi mockup Anda)
    const seedProducts = [
      { sku: 'KAG-200-01', name: 'Kopi Arabika Gayo 200g', priceRetail: 85000, priceWholesale: 80000, wholesaleMinQty: 10, stock: 45, minStockAlert: 5 },
      { sku: 'HAR-V60-100', name: 'Filter Kertas V60 Hario', priceRetail: 45000, priceWholesale: 42000, wholesaleMinQty: 5, stock: 120, minStockAlert: 15 },
      { sku: 'AQA-600-01', name: 'Aqua Botol 600ml', priceRetail: 3000, priceWholesale: 2800, wholesaleMinQty: 24, stock: 12, minStockAlert: 24 }, // Stok sengaja diset rendah untuk tes indikator kuning
      { sku: 'IND-GRG-01', name: 'Indomie Goreng Original', priceRetail: 3500, priceWholesale: 3300, wholesaleMinQty: 40, stock: 145, minStockAlert: 20 },
      { sku: 'MRB-RED-01', name: 'Marlboro Merah', priceRetail: 42000, priceWholesale: 40500, wholesaleMinQty: 10, stock: 56, minStockAlert: 10 },
      { sku: 'KB-PRO-001', name: 'Mech Keyboard Pro X', priceRetail: 1490000, priceWholesale: 1400000, wholesaleMinQty: 3, stock: 14, minStockAlert: 5 },
      { sku: 'AU-HD-099', name: 'Studio Monitor Headphones', priceRetail: 1990000, priceWholesale: null, wholesaleMinQty: 0, stock: 0, minStockAlert: 2 }, // Stok 0 untuk tes indikator merah
      { sku: 'AP-HD-BLK-M', name: 'Developer Hoodie - Black (M)', priceRetail: 450000, priceWholesale: null, wholesaleMinQty: 0, stock: 8, minStockAlert: 10 },
      { sku: 'WE-SW-G4', name: 'Smartwatch Gen 4', priceRetail: 2995000, priceWholesale: 2800000, wholesaleMinQty: 5, stock: 45, minStockAlert: 10 },
      { sku: 'AC-MS-WL', name: 'Ergo Mouse Wireless', priceRetail: 750000, priceWholesale: 700000, wholesaleMinQty: 5, stock: 32, minStockAlert: 5 },
      { sku: 'ESP-BLND-01', name: 'Espresso Blend 500g', priceRetail: 120000, priceWholesale: 110000, wholesaleMinQty: 5, stock: 25, minStockAlert: 5 },
      { sku: 'CRS-BTR-01', name: 'Croissant Butter', priceRetail: 25000, priceWholesale: 20000, wholesaleMinQty: 10, stock: 15, minStockAlert: 5 },
      { sku: 'CLB-SND-01', name: 'Club Sandwich', priceRetail: 65000, priceWholesale: null, wholesaleMinQty: 0, stock: 20, minStockAlert: 5 },
      { sku: 'VNL-CNE-01', name: 'Vanilla Cone Ice Cream', priceRetail: 25000, priceWholesale: null, wholesaleMinQty: 0, stock: 50, minStockAlert: 10 }
    ];

    let insertedCount = 0;

    // Menggunakan fungsi upsert agar jika Anda me-refresh halaman ini berkali-kali, 
    // datanya tidak akan menjadi ganda (duplikat) karena ia mengecek SKU-nya.
    for (const product of seedProducts) {
      const result = await prisma.product.upsert({
        where: { sku: product.sku },
        update: {}, // Jika SKU sudah ada, abaikan (jangan diubah)
        create: product
      });
      if (result) insertedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil menyuntikkan ${insertedCount} produk ujicoba ke database SQLite lokal Anda!` 
    });

  } catch (error: any) {
    console.error('Seeding Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}