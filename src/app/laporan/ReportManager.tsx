// src/app/laporan/ReportManager.tsx
'use client'

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

type TopSeller = {
  name: string;
  sku: string;
  qty: number;
  revenue: number;
};

type ReportData = {
  today: { totalSales: number; txCount: number; avgOrder: number };
  growth: { salesGrowth: number; txGrowth: number; avgGrowth: number };
  topSellers: TopSeller[];
  hourlySales: number[];
  startDate: string;
  endDate: string;
  diffDays: number;
};

export default function ReportManager({ data }: { data: ReportData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [startDate, setStartDate] = useState(data.startDate);
  const [endDate, setEndDate] = useState(data.endDate);
  const [showFilter, setShowFilter] = useState(false);

  const handleFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (startDate) params.set('start', startDate);
    else params.delete('start');
    
    if (endDate) params.set('end', endDate);
    else params.delete('end');
    
    router.push(`/laporan?${params.toString()}`);
  };

  const handleReset = () => {
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    router.push('/laporan');
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    
    window.location.href = `/api/export/laporan?${params.toString()}`;
  };

  // Format mata uang standar
  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  
  // Format mata uang singkatan untuk sumbu Y pada grafik (Contoh: 1.5jt, 500rb)
  const formatShortRp = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}jt`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}rb`;
    if (num === 0) return '0';
    return `${num}`;
  };

  // Format persentase pertumbuhan (+ / -)
  const formatGrowth = (val: number) => {
    const sign = val > 0 ? '+' : '';
    const periodText = data.diffDays > 1 ? `vs ${data.diffDays} hari sblmnya` : 'vs kemarin';
    return `${sign}${val.toFixed(1)}% ${periodText}`;
  };

  // ---------------------------------------------------------
  // FORMAT DATA UNTUK RECHARTS
  // Mengubah array angka menjadi array of objects { time, sales }
  // ---------------------------------------------------------
  const chartData = data.hourlySales.map((sales, index) => ({
    time: `${index.toString().padStart(2, '0')}:00`,
    sales: sales
  }));

  // Komponen Tooltip Kustom saat grafik di-hover
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-container-high border border-border p-3 rounded-lg shadow-xl">
          <p className="text-text-secondary font-label-sm text-label-sm mb-1">Pukul {label}</p>
          <p className="text-primary-container font-headline-sm font-bold">
            {formatRp(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto p-gutter lg:p-margin-desktop space-y-gutter h-full">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-4 border-b border-border gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-text-primary tracking-tight">Ringkasan Penjualan</h2>
          <p className="font-body-md text-body-md text-text-secondary mt-1">
            {data.startDate === data.endDate 
              ? `Data penjualan tanggal ${data.startDate}` 
              : `Data penjualan dari ${data.startDate} hingga ${data.endDate}`}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {showFilter && (
            <>
              <input 
                type="date" 
                className="bg-surface border border-border text-text-primary px-3 py-2 rounded focus:outline-none focus:border-primary"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-text-secondary"> - </span>
              <input 
                type="date" 
                className="bg-surface border border-border text-text-primary px-3 py-2 rounded focus:outline-none focus:border-primary"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button 
                onClick={handleFilter}
                className="bg-surface border border-border hover:border-primary text-text-primary font-label-md text-label-md px-4 py-2 rounded transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check</span>
                Terapkan
              </button>
            </>
          )}

          {!showFilter && (
            <button 
              onClick={handleReset}
              className="bg-surface border border-border hover:border-primary text-text-primary font-label-md text-label-md px-4 py-2 rounded transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">today</span>
              Hari Ini
            </button>
          )}

          <button 
            onClick={() => setShowFilter(!showFilter)}
            className={`bg-surface border border-border hover:border-primary text-text-primary font-label-md text-label-md px-4 py-2 rounded transition-all flex items-center gap-2 ${showFilter ? 'bg-surface-container-high' : ''}`}>
            <span className="material-symbols-outlined text-[16px]">
              {showFilter ? 'close' : 'filter_alt'}
            </span>
            {showFilter ? 'Tutup' : 'Filter Tanggal'}
          </button>

          <button 
            onClick={handleExport}
            className="bg-primary-container hover:bg-primary-fixed-dim text-on-primary-fixed font-label-md text-label-md px-4 py-2 rounded transition-all font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* KPIs (Bento Grid Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        
        {/* KPI 1: Daily Sales */}
        <div className="bg-surface border border-border rounded-lg p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-primary-container" style={{ fontSize: '64px' }}>payments</span>
          </div>
          <p className="font-label-md text-label-md text-text-secondary uppercase tracking-wider mb-2">Total Penjualan</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-primary-fixed tracking-tight">{formatRp(data.today.totalSales)}</span>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${data.growth.salesGrowth >= 0 ? 'text-primary' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">
              {data.growth.salesGrowth >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span>{formatGrowth(data.growth.salesGrowth)}</span>
          </div>
        </div>

        {/* KPI 2: Transaction Count */}
        <div className="bg-surface border border-border rounded-lg p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '64px' }}>receipt_long</span>
          </div>
          <p className="font-label-md text-label-md text-text-secondary uppercase tracking-wider mb-2">Jumlah Transaksi</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-text-primary">{data.today.txCount}</span>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${data.growth.txGrowth >= 0 ? 'text-primary' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">
              {data.growth.txGrowth >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span>{formatGrowth(data.growth.txGrowth)}</span>
          </div>
        </div>

        {/* KPI 3: Average Order Value */}
        <div className="bg-surface border border-border rounded-lg p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '64px' }}>shopping_basket</span>
          </div>
          <p className="font-label-md text-label-md text-text-secondary uppercase tracking-wider mb-2">Rata-rata Pesanan</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-text-primary tracking-tight">{formatRp(data.today.avgOrder)}</span>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-sm font-medium ${data.growth.avgGrowth >= 0 ? 'text-primary' : 'text-danger'}`}>
            <span className="material-symbols-outlined text-[16px]">
              {data.growth.avgGrowth >= 0 ? 'trending_up' : 'trending_down'}
            </span>
            <span>{formatGrowth(data.growth.avgGrowth)}</span>
          </div>
        </div>
      </div>

      {/* Charts & Top Sellers Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mt-gutter pb-8">
        
        {/* Main Chart Area (Recharts) */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-lg p-6 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-sm text-headline-sm text-text-primary">Penjualan 24 Jam (Hari Terakhir)</h3>
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full bg-primary-container inline-block self-center"></span>
              <span className="font-label-sm text-label-sm text-text-secondary">Pendapatan Kotor</span>
            </div>
          </div>
          
          {/* Recharts Responsive Container */}
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#30363D" />
                <XAxis 
                  dataKey="time" 
                  stroke="#8B949E" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis 
                  stroke="#8B949E" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatShortRp}
                  tickMargin={10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                  activeDot={{ r: 6, fill: "#161B22", stroke: "#10B981", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Sellers List */}
        <div className="bg-surface border border-border rounded-lg p-0 flex flex-col max-h-[400px]">
          <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
            <h3 className="font-headline-sm text-headline-sm text-text-primary">Produk Terlaris</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col">
              
              {data.topSellers.length === 0 ? (
                <div className="p-8 text-center text-text-secondary font-body-md text-body-md">
                  Belum ada penjualan hari ini.
                </div>
              ) : (
                data.topSellers.map((product, index) => (
                  <div key={product.sku} className="flex items-center justify-between p-4 border-b border-border hover:bg-surface-container-high transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 shrink-0 rounded bg-surface-container border border-border flex items-center justify-center font-bold ${index === 0 ? 'text-primary-container' : 'text-text-secondary'}`}>
                        {index + 1}
                      </div>
                      <div className="truncate">
                        <p className="font-body-md text-body-md text-text-primary font-medium truncate">{product.name}</p>
                        <p className="font-label-sm text-label-sm text-text-secondary font-mono truncate">SKU: {product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-body-md text-body-md text-text-primary">{product.qty} pcs</p>
                      <p className="font-label-sm text-label-sm text-primary-container">+{formatRp(product.revenue)}</p>
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}