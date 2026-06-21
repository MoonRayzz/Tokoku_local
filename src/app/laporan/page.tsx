// src/app/laporan/page.tsx
import React from 'react';
import prisma from '@/lib/db';
import ReportManager from './ReportManager';
import { PageTransition } from '@/components/ui/PageTransition';

type Props = {
  searchParams: Promise<{ start?: string; end?: string; shift?: string }>;
};

export default async function LaporanPage(props: Props) {
  const params = await props.searchParams;
  
  // Ambil daftar shift untuk UI filter
  const shifts = await prisma.shift.findMany({ where: { isActive: true } });
  
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

  const txFilter = {
    createdAt: { gte: currentStart, lt: currentEnd },
    isVoid: false,
    ...(params?.shift ? { shiftId: params.shift } : {})
  };

  const prevTxFilter = {
    createdAt: { gte: previousStart, lt: previousEnd },
    isVoid: false,
    ...(params?.shift ? { shiftId: params.shift } : {})
  };

  const expenseFilter = {
    date: { gte: currentStart, lt: currentEnd },
    ...(params?.shift ? { shiftId: params.shift } : {})
  };

  // Gunakan Promise.all untuk paralel eksekusi agregasi
  const [
    currentTxAgg,
    prevTxAgg,
    expenseAgg,
    hourlyTxData,
    topSellersRaw
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: txFilter,
      _sum: { totalAmount: true },
      _count: { id: true }
    }),
    prisma.transaction.aggregate({
      where: prevTxFilter,
      _sum: { totalAmount: true },
      _count: { id: true }
    }),
    prisma.expense.aggregate({
      where: expenseFilter,
      _sum: { amount: true }
    }),
    // Fetch minimal untuk grafik per jam
    prisma.transaction.findMany({
      where: txFilter,
      select: { createdAt: true, totalAmount: true }
    }),
    // Fetch minimal untuk top sellers
    prisma.transactionDetail.groupBy({
      by: ['productId'],
      where: { transaction: txFilter },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    })
  ]);

  // 4. Kalkulasi KPI Utama
  const totalSales = currentTxAgg._sum.totalAmount || 0;
  const txCount = currentTxAgg._count.id;
  const avgOrder = txCount > 0 ? totalSales / txCount : 0;
  
  const totalExpense = expenseAgg._sum.amount || 0;
  const netBalance = totalSales - totalExpense;

  const yTotalSales = prevTxAgg._sum.totalAmount || 0;
  const yTxCount = prevTxAgg._count.id;
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

  // 6. Lengkapi data produk untuk topSellers
  const productIds = topSellersRaw.map(t => t.productId);
  const productsData = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true }
  });
  
  const productMap = Object.fromEntries(productsData.map(p => [p.id, p]));
  const topSellers = topSellersRaw.map(item => ({
    name: productMap[item.productId]?.name || 'Unknown',
    sku: productMap[item.productId]?.sku || '-',
    qty: item._sum.quantity || 0,
    revenue: item._sum.subtotal || 0
  }));

  // 7. Kalkulasi Pendapatan Per Jam
  const hourlySales = Array(24).fill(0);
  hourlyTxData.forEach(tx => {
    const hour = new Date(tx.createdAt).getHours();
    hourlySales[hour] += tx.totalAmount;
  });

  // Format string untuk dipassing ke komponen client
  const activeStartDate = params?.start || currentStart.toISOString().split('T')[0];
  const activeEndDate = params?.end || activeStartDate; // Jika tidak ada end, end adalah start

  // Susun dan bungkus datanya
  const reportData = {
    today: { totalSales, txCount, avgOrder, totalExpense, netBalance },
    growth: { salesGrowth, txGrowth, avgGrowth },
    topSellers,
    hourlySales,
    startDate: activeStartDate,
    endDate: activeEndDate,
    shift: params?.shift || '',
    diffDays
  };

  return (
    <PageTransition className="h-full">
      <ReportManager data={reportData} shifts={shifts} />
    </PageTransition>
  );
}