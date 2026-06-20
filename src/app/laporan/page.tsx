// src/app/laporan/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import ReportManager from './ReportManager';
import { PageTransition } from '@/components/ui/PageTransition';

type Props = {
  searchParams: Promise<{ start?: string; end?: string }>;
};

export default async function LaporanPage(props: Props) {
  const params = await props.searchParams;
  
  // 1. Menentukan Batas Waktu berdasarkan filter
  let currentStart = new Date();
  currentStart.setHours(0, 0, 0, 0);
  
  let currentEnd = new Date(currentStart);
  currentEnd.setDate(currentEnd.getDate() + 1);

  if (params?.start) {
    const parsedStart = new Date(params.start);
    if (!isNaN(parsedStart.getTime())) {
      currentStart = parsedStart;
      currentStart.setHours(0, 0, 0, 0);
      
      currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 1);
    }
  }

  if (params?.end) {
    const parsedEnd = new Date(params.end);
    if (!isNaN(parsedEnd.getTime())) {
      // Pastikan rentangnya sampai jam 23:59:59 di hari terakhir
      parsedEnd.setHours(23, 59, 59, 999);
      currentEnd = new Date(parsedEnd.getTime() + 1); // eksklusif `< currentEnd`
    }
  }

  // Menentukan periode sebelumnya (untuk metrik perbandingan/growth)
  const diffTime = currentEnd.getTime() - currentStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - diffDays);
  
  const previousEnd = new Date(currentStart);

  // 2. Query Transaksi Saat Ini (Abaikan transaksi yang berstatus Void/Batal)
  const currentTx = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: currentStart, lt: currentEnd },
      isVoid: false,
    },
    include: { 
      details: { include: { product: true } } 
    }
  });

  // 3. Query Transaksi Sebelumnya (Untuk metrik pertumbuhan %)
  const previousTx = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: previousStart, lt: previousEnd },
      isVoid: false,
    }
  });

  // 4. Kalkulasi KPI Utama
  const totalSales = currentTx.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const txCount = currentTx.length;
  const avgOrder = txCount > 0 ? totalSales / txCount : 0;

  const yTotalSales = previousTx.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const yTxCount = previousTx.length;
  const yAvgOrder = yTxCount > 0 ? yTotalSales / yTxCount : 0;

  // 5. Kalkulasi Pertumbuhan (%)
  const calcGrowth = (current: number, previous: number) => {
    if (previous === 0 && current > 0) return 100;
    if (previous === 0 && current === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const salesGrowth = calcGrowth(totalSales, yTotalSales);
  const txGrowth = calcGrowth(txCount, yTxCount);
  const avgGrowth = calcGrowth(avgOrder, yAvgOrder);

  // 6. Kalkulasi Produk Terlaris Hari Ini
  const productSalesMap: Record<string, { name: string, sku: string, qty: number, revenue: number }> = {};
  
  currentTx.forEach(tx => {
    tx.details.forEach(detail => {
      if (!productSalesMap[detail.productId]) {
        productSalesMap[detail.productId] = { 
          name: detail.product.name, 
          sku: detail.product.sku, 
          qty: 0, 
          revenue: 0 
        };
      }
      productSalesMap[detail.productId].qty += detail.quantity;
      productSalesMap[detail.productId].revenue += detail.subtotal;
    });
  });

  // Urutkan berdasarkan kuantitas terbanyak dan ambil Top 5
  const topSellers = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 7. Kalkulasi Pendapatan Per Jam (Hanya relevan jika filter 1 hari)
  // Jika rentang lebih dari 1 hari, chart 24 jam kurang relevan, namun kita biarkan memetakan per jam dari semua hari
  const hourlySales = Array(24).fill(0);
  currentTx.forEach(tx => {
    const hour = new Date(tx.createdAt).getHours();
    hourlySales[hour] += tx.totalAmount;
  });

  // Format string untuk dipassing ke komponen client
  const activeStartDate = params?.start || currentStart.toISOString().split('T')[0];
  const activeEndDate = params?.end || activeStartDate; // Jika tidak ada end, end adalah start

  // Susun dan bungkus datanya
  const reportData = {
    today: { totalSales, txCount, avgOrder },
    growth: { salesGrowth, txGrowth, avgGrowth },
    topSellers,
    hourlySales,
    startDate: activeStartDate,
    endDate: activeEndDate,
    diffDays
  };

  return (
    <PageTransition className="h-full">
      <ReportManager data={reportData} />
    </PageTransition>
  );
}