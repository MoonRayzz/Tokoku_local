'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type SyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR';

interface SyncContextProps {
  syncState: SyncState;
  pendingCount: number;
  failedCount: number;
  setSyncState: (state: SyncState) => void;
  setPendingCount: (count: number) => void;
  setFailedCount: (count: number) => void;
  triggerSync: () => void;
  // Ini fungsi callback yang didaftarkan oleh SyncEngine untuk dijalankan secara manual
  registerSyncFunction: (fn: () => Promise<void>) => void;
}

const SyncContext = createContext<SyncContextProps | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>('SYNCED');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncFn, setSyncFn] = useState<(() => Promise<void>) | null>(null);

  const registerSyncFunction = useCallback((fn: () => Promise<void>) => {
    setSyncFn(() => fn);
  }, []);

  const triggerSync = useCallback(() => {
    if (syncFn) {
      syncFn();
    }
  }, [syncFn]);

  return (
    <SyncContext.Provider 
      value={{
        syncState,
        pendingCount,
        failedCount,
        setSyncState,
        setPendingCount,
        setFailedCount,
        triggerSync,
        registerSyncFunction
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
