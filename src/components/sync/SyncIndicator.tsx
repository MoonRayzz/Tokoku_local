'use client';

import React from 'react';
import { useSync } from '@/context/SyncContext';

export function SyncIndicator() {
  const { syncState, pendingCount, failedCount, triggerSync } = useSync();

  const getStatusConfig = () => {
    switch (syncState) {
      case 'SYNCED':
        return {
          icon: 'cloud_done',
          text: 'Tersinkronisasi',
          colorClass: 'text-success border-success/30 bg-success/10',
          dotColor: 'bg-success',
          showCounts: false
        };
      case 'SYNCING':
        return {
          icon: 'cloud_sync',
          text: pendingCount > 0 ? `Menyinkronkan... (${pendingCount})` : 'Menyinkronkan...',
          colorClass: 'text-warning border-warning/30 bg-warning/10',
          dotColor: 'bg-warning animate-pulse',
          showCounts: true
        };
      case 'OFFLINE':
        return {
          icon: 'cloud_off',
          text: 'Offline',
          colorClass: 'text-text-secondary border-text-secondary/30 bg-surface-container-high',
          dotColor: 'bg-text-secondary',
          showCounts: true
        };
      case 'ERROR':
        return {
          icon: 'cloud_off',
          text: failedCount > 0 ? `Gagal Sync (${failedCount})` : 'Gagal Sync',
          colorClass: 'text-danger border-danger/30 bg-danger/10',
          dotColor: 'bg-danger',
          showCounts: true
        };
      default:
        return {
          icon: 'cloud',
          text: 'Memeriksa...',
          colorClass: 'text-text-secondary border-transparent bg-transparent',
          dotColor: 'bg-transparent',
          showCounts: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex flex-col gap-2 mt-auto px-2 py-4 shrink-0 border-t border-border bg-surface-container-low">
      <div 
        className={`flex items-center gap-4 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${config.colorClass}`}
        title="Status Sinkronisasi dengan Cloud"
      >
        <div className="relative shrink-0 flex items-center justify-center w-6 h-6">
          <span className="material-symbols-outlined text-[20px]">
            {config.icon}
          </span>
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor} ${syncState === 'SYNCING' ? 'block' : 'hidden'}`}></span>
            <span className={`relative inline-flex rounded-full h-full w-full ${config.dotColor}`}></span>
          </span>
        </div>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
          {config.text}
        </span>
      </div>

      <button 
        onClick={() => triggerSync()}
        disabled={syncState === 'SYNCING'}
        className="hidden group-hover:block transition-opacity duration-300 w-full text-xs py-2 rounded bg-primary text-on-primary font-medium hover:brightness-110 disabled:opacity-50 mt-1"
      >
        {syncState === 'SYNCING' ? 'Memproses...' : 'Sync Sekarang'}
      </button>
    </div>
  );
}
