'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';

interface TopBarProps {
  pendingSyncCount: number;
  lowStockProducts?: any[];
  emptyStockProducts?: any[];
}

export function TopBar({ pendingSyncCount, lowStockProducts = [], emptyStockProducts = [] }: TopBarProps) {
  const isSyncing = pendingSyncCount > 0;
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const toast = useToast();
  
  const notifCount = lowStockProducts.length + emptyStockProducts.length;
  const prevCountRef = useRef(notifCount);

  // Pantau jika ada stok yang baru habis/menipis
  useEffect(() => {
    if (notifCount > prevCountRef.current) {
      if (emptyStockProducts.length > 0) {
        toast.error(`Perhatian! Ada ${emptyStockProducts.length} produk yang stoknya habis.`);
      } else {
        toast.warning(`Perhatian! Ada ${lowStockProducts.length} produk yang stoknya menipis.`);
      }
    }
    prevCountRef.current = notifCount;
  }, [notifCount, emptyStockProducts.length, lowStockProducts.length]);

  return (
    <header className="fixed top-0 right-0 left-0 flex justify-between items-center px-margin-desktop h-16 z-30 ml-sidebar-collapsed bg-surface border-b border-border">
      
      {/* Search Bar Area */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center w-full h-10 rounded-lg bg-background border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all overflow-hidden">
          <div className="grid place-items-center h-full w-12 text-text-secondary">
            <span className="material-symbols-outlined text-sm">search</span>
          </div>
          <input 
            type="text" 
            id="global-search" 
            placeholder="Cari menu, nama produk, atau riwayat..." 
            className="peer h-full w-full outline-none text-sm text-text-primary bg-transparent pr-4 focus:ring-0 border-none" 
          />
        </div>
      </div>

      {/* Trailing Actions & Database Status */}
      <div className="flex items-center gap-6 ml-4">
        
        {/* Dynamic Database Sync Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
          isSyncing 
            ? 'bg-warning/10 border-warning/30 text-warning' 
            : 'bg-primary-container/10 border-primary-container/30 text-primary-container'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-warning' : 'bg-primary-container animate-pulse'}`}></span>
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            {isSyncing ? `${pendingSyncCount} Tertunda` : 'ONLINE SINKRON'}
          </span>
        </div>

        <div className="flex items-center gap-2 border-l border-border pl-6">
          <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="text-on-surface-variant hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-container-high flex items-center justify-center relative"
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-danger text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-surface">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>

            {/* Dropdown Notifikasi */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-border bg-surface-container-low flex justify-between items-center">
                  <h3 className="font-bold text-sm text-text-primary">Notifikasi Stok</h3>
                  <span className="text-xs font-medium text-text-secondary bg-surface-container px-2 py-0.5 rounded-full">{notifCount} Peringatan</span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {notifCount === 0 ? (
                    <div className="p-4 text-center text-text-secondary text-sm">Stok semua produk aman.</div>
                  ) : (
                    <>
                      {emptyStockProducts.map((p: any) => (
                        <div key={p.id} className="p-3 border-b border-border hover:bg-surface-container-high transition-colors flex gap-3 items-start">
                          <span className="material-symbols-outlined text-danger text-[18px] mt-0.5">error</span>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{p.name}</p>
                            <p className="text-xs text-danger font-bold mt-1">Stok Habis (0)</p>
                          </div>
                        </div>
                      ))}
                      {lowStockProducts.map((p: any) => (
                        <div key={p.id} className="p-3 border-b border-border hover:bg-surface-container-high transition-colors flex gap-3 items-start">
                          <span className="material-symbols-outlined text-warning text-[18px] mt-0.5">warning</span>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{p.name}</p>
                            <p className="text-xs text-warning font-bold mt-1">Sisa {p.stock} pcs (Batas: {p.minStockAlert})</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="text-on-surface-variant hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined">wifi</span>
          </button>
        </div>

      </div>
    </header>
  );
}