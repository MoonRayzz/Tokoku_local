// src/components/layout/TopBar.tsx
import React from 'react';

interface TopBarProps {
  pendingSyncCount: number;
}

export function TopBar({ pendingSyncCount }: TopBarProps) {
  const isSyncing = pendingSyncCount > 0;

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
          <button className="text-on-surface-variant hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-container-high flex items-center justify-center relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border border-surface"></span>
          </button>
          <button className="text-on-surface-variant hover:text-text-primary transition-colors p-2 rounded-lg hover:bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined">wifi</span>
          </button>
        </div>

      </div>
    </header>
  );
}