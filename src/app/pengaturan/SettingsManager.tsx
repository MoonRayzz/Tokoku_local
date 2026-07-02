// src/app/pengaturan/SettingsManager.tsx
'use client'

import React, { useState, useEffect, useTransition } from 'react';
import { syncToCloud, getStoreProfile, saveStoreProfile } from './actions';
import { useToast } from '@/components/ui/Toast';

interface SettingsManagerProps {
  pendingSyncCount: number;
}

export default function SettingsManager({ pendingSyncCount }: SettingsManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });
  const toast = useToast();

  const [storeConfig, setStoreConfig] = useState({
    name: 'TOKOKU POS LOKAL',
    address: 'Jl. Pendidikan Raya No. 1, Jakarta',
    phone: '08123456789',
    city: 'Jakarta',
    footer: 'Terima kasih atas kunjungan Anda!',
    logoUrl: '',
    qrisProvider: 'GoPay Merchant',
    edcBank: 'BCA',
  });

  const [isClient, setIsClient] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load config dari LocalStorage untuk payment methods
    const savedConfig = localStorage.getItem('tokoku_config');
    let loadedPayment = {};
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      loadedPayment = { qrisProvider: parsed.qrisProvider || 'GoPay Merchant', edcBank: parsed.edcBank || 'BCA' };
    }
    
    // Load Store Profile dari DB
    getStoreProfile().then(profile => {
      if (profile) {
        setStoreConfig(prev => ({
          ...prev,
          name: profile.name || '',
          address: profile.address || '',
          phone: profile.phone || '',
          city: profile.city || '',
          footer: profile.footer || '',
          logoUrl: profile.logoUrl || '',
          ...loadedPayment
        }));
      } else {
        setStoreConfig(prev => ({...prev, ...loadedPayment}));
      }
    });
  }, []);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStoreConfig(prev => ({ ...prev, [name]: value }));
  };

  const saveConfig = async () => {
    setIsSavingStore(true);
    // Simpan parameter lokal ke LocalStorage
    localStorage.setItem('tokoku_config', JSON.stringify({
      qrisProvider: storeConfig.qrisProvider,
      edcBank: storeConfig.edcBank
    }));

    // Simpan StoreProfile ke DB (dan masuk ke SyncQueue)
    const result = await saveStoreProfile({
      name: storeConfig.name,
      address: storeConfig.address,
      phone: storeConfig.phone,
      city: storeConfig.city,
      footer: storeConfig.footer,
      logoUrl: storeConfig.logoUrl
    });

    setIsSavingStore(false);
    if (result.success) {
      toast.success('Pengaturan toko berhasil disimpan!');
      window.dispatchEvent(new Event('storeProfileUpdated'));
    } else {
      toast.error('Gagal menyimpan profil toko!');
    }
  };

  const handleManualSync = () => {
    setSyncStatus({ type: 'idle', msg: '' });
    startTransition(async () => {
      const result = await syncToCloud();
      if (result.success) {
        setSyncStatus({ type: 'success', msg: result.message || 'Sinkronisasi berhasil.' });
      } else {
        setSyncStatus({ type: 'error', msg: result.error || 'Gagal sinkronisasi.' });
      }
    });
  };

  if (!isClient) return null;

  return (
    <div className="flex-1 overflow-y-auto p-margin-desktop h-full">
      <div className="max-w-[1000px] mx-auto space-y-6">
        
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary mb-1">Status & Pengaturan</h1>
          <p className="font-body-md text-body-md text-text-secondary">Kelola preferensi toko dan pantau status sinkronisasi Supabase.</p>
        </div>

        {/* Notifikasi Sinkronisasi */}
        {syncStatus.msg && (
          <div className={`p-4 rounded-lg border ${syncStatus.type === 'success' ? 'bg-primary-container/10 border-primary-container text-primary-container' : 'bg-danger/10 border-danger text-danger'}`}>
            {syncStatus.msg}
          </div>
        )}

        {/* Panel Status Sistem */}
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="font-headline-sm text-headline-sm text-text-primary mb-4 border-b border-border pb-2">Status Database</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="flex items-center space-x-4 bg-surface-container p-4 rounded border border-border">
              <div className="relative flex items-center justify-center w-12 h-12">
                <div className={`absolute inset-0 rounded-full opacity-20 scale-150 ${pendingSyncCount === 0 ? 'bg-primary-container animate-pulse' : 'bg-warning animate-pulse'}`}></div>
                <div className={`relative w-4 h-4 rounded-full shadow-lg ${pendingSyncCount === 0 ? 'bg-primary-container' : 'bg-warning'}`}></div>
              </div>
              <div>
                <div className={`font-headline-sm text-headline-sm font-bold tracking-wide ${pendingSyncCount === 0 ? 'text-primary-container' : 'text-warning'}`}>
                  {pendingSyncCount === 0 ? 'SINKRON' : 'TERTUNDA'}
                </div>
                <div className="font-body-md text-body-md text-text-secondary mt-1">Sistem Offline-First Aktif</div>
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-3 bg-surface-container p-4 rounded border border-border">
              <div className="flex items-center text-text-primary font-body-lg text-body-lg">
                <span className={`material-symbols-outlined mr-2 ${pendingSyncCount === 0 ? 'text-primary-container' : 'text-warning'}`}>
                  {pendingSyncCount === 0 ? 'check_circle' : 'pending_actions'}
                </span>
                <span>Antrean ke Supabase: <strong className="font-bold text-xl ml-1">{pendingSyncCount}</strong> Transaksi</span>
              </div>
              <button 
                onClick={handleManualSync}
                disabled={isPending || pendingSyncCount === 0}
                className="flex items-center justify-center space-x-2 border border-border bg-surface hover:bg-surface-variant text-text-primary px-4 py-2 rounded min-h-[44px] transition-colors font-label-md text-label-md font-bold disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${isPending ? 'animate-spin' : ''}`}>sync</span>
                <span>{isPending ? 'MENGIRIM DATA...' : 'SINKRONISASI MANUAL SEKARANG'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Status Metode Pembayaran */}
        <section className="bg-surface border border-border rounded-lg p-6">
          <h2 className="font-headline-sm text-headline-sm text-text-primary mb-4 border-b border-border pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-text-secondary">payments</span>
            Status Metode Pembayaran
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-text-secondary font-medium">Metode</th>
                  <th className="text-center py-2 px-4 text-text-secondary font-medium">Status Offline</th>
                  <th className="text-center py-2 px-4 text-text-secondary font-medium">Status Online</th>
                  <th className="text-left py-2 pl-4 text-text-secondary font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'Cash',
                    icon: 'payments',
                    iconColor: 'text-primary-container',
                    offlineStatus: 'Operasional Penuh',
                    onlineStatus: 'Operasional Penuh',
                    note: 'Tidak bergantung pada koneksi apapun',
                  },
                  {
                    label: 'QRIS Fisik',
                    icon: 'qr_code_2',
                    iconColor: 'text-blue-400',
                    offlineStatus: 'Operasional',
                    onlineStatus: 'Operasional',
                    note: 'Verifikasi manual via notif HP kasir',
                  },
                  {
                    label: 'Debit / EDC',
                    icon: 'credit_card',
                    iconColor: 'text-orange-400',
                    offlineStatus: 'Operasional',
                    onlineStatus: 'Operasional Penuh',
                    note: 'EDC memiliki koneksi sim card sendiri',
                  },
                ].map((m) => (
                  <tr key={m.label} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[18px] ${m.iconColor}`}>{m.icon}</span>
                        <span className="font-medium text-text-primary">{m.label}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-primary-container text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container inline-block" />
                        {m.offlineStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-primary-container text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container inline-block" />
                        {m.onlineStatus}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-text-secondary text-xs">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Panel Pengaturan & Preview Struk */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <section className="lg:col-span-3 bg-surface border border-border rounded-lg p-6">
            <h2 className="font-headline-sm text-headline-sm text-text-primary mb-4 border-b border-border pb-2 flex items-center">
              <span className="material-symbols-outlined mr-2 text-text-secondary">store</span>
              Detail Toko & Struk
            </h2>
            
            <div className="space-y-4">
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">Nama Toko</label>
                <input name="name" value={storeConfig.name} onChange={handleConfigChange} type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
              </div>
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">Alamat Lengkap</label>
                <textarea name="address" value={storeConfig.address} onChange={handleConfigChange} rows={2} className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none resize-none"></textarea>
              </div>
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">Nomor Telepon</label>
                <input name="phone" value={storeConfig.phone} onChange={handleConfigChange} type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
              </div>
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">Kota</label>
                <input name="city" value={storeConfig.city} onChange={handleConfigChange} type="text" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
              </div>
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">URL Logo (Opsional)</label>
                <input name="logoUrl" value={storeConfig.logoUrl} onChange={handleConfigChange} type="text" placeholder="https://example.com/logo.png" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
              </div>
              <div className="focus-pulse">
                <label className="block font-label-md text-label-md text-text-secondary mb-1">Pesan Penutup (Footer)</label>
                <textarea name="footer" value={storeConfig.footer} onChange={handleConfigChange} rows={3} className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none resize-none"></textarea>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-3">Identitas Pembayaran (Tampil di Struk)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="focus-pulse">
                    <label className="block font-label-md text-label-md text-text-secondary mb-1">Penyedia QRIS</label>
                    <input name="qrisProvider" value={storeConfig.qrisProvider} onChange={handleConfigChange} type="text" placeholder="Contoh: GoPay Merchant" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
                  </div>
                  <div className="focus-pulse">
                    <label className="block font-label-md text-label-md text-text-secondary mb-1">Bank EDC</label>
                    <input name="edcBank" value={storeConfig.edcBank} onChange={handleConfigChange} type="text" placeholder="Contoh: BCA" className="w-full bg-background border border-border rounded px-3 py-2 text-text-primary font-body-md text-body-md focus:outline-none min-h-[44px]" />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-border mt-2">
                <button onClick={saveConfig} disabled={isSavingStore} className="w-full bg-primary-container text-[#000000] font-headline-sm text-headline-sm font-bold rounded px-4 py-2 min-h-[44px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined">save</span>
                  {isSavingStore ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN'}
                </button>
              </div>
            </div>
          </section>

          <section className="lg:col-span-2 bg-surface border border-border rounded-lg p-6 flex flex-col">
            <h2 className="font-headline-sm text-headline-sm text-text-primary mb-4 border-b border-border pb-2 flex items-center">
              <span className="material-symbols-outlined mr-2 text-text-secondary">receipt</span>
              Pratinjau Kertas
            </h2>
            <div className="flex-1 flex items-center justify-center bg-background rounded border border-border p-4 overflow-hidden">
              <div className="thermal-receipt w-full max-w-[280px] text-[12px] leading-tight flex flex-col items-center">
                <div className="text-center mb-2 w-full">
                  {storeConfig.logoUrl && (
                    <div className="flex justify-center mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={storeConfig.logoUrl} alt="Logo" className="h-8 object-contain mix-blend-multiply grayscale" />
                    </div>
                  )}
                  <div className="font-bold text-[16px] mb-1">{storeConfig.name}</div>
                  <div className="break-words">{storeConfig.address}</div>
                  <div>{storeConfig.city}</div>
                  <div>Telp: {storeConfig.phone}</div>
                </div>
                <div className="border-dashed-thermal my-2 w-full"></div>
                <div className="flex justify-between mb-1 w-full text-xs"><span>Kasir: Admin</span><span>14:30</span></div>
                <div className="border-dashed-thermal my-2 w-full"></div>
                
                <div className="flex justify-between mb-1 w-full"><span className="truncate">Kopi Susu</span><span>15.000</span></div>
                <div className="flex justify-between mb-1 w-full"><span className="truncate">Roti Bakar</span><span>20.000</span></div>
                
                <div className="border-dashed-thermal my-2 w-full"></div>
                <div className="flex justify-between font-bold text-[14px] w-full"><span>TOTAL</span><span>Rp 35.000</span></div>
                <div className="border-dashed-thermal my-2 w-full"></div>
                
                {/* Preview: Blok Metode Pembayaran */}
                <div className="w-full space-y-1">
                  <div className="flex justify-between w-full"><span>Metode Bayar</span><span>CASH</span></div>
                  <div className="flex justify-between w-full"><span>Uang Diterima</span><span>Rp 40.000</span></div>
                  <div className="flex justify-between w-full"><span>Kembalian</span><span>Rp 5.000</span></div>
                </div>
                {/* Contoh QRIS */}
                <div className="border-dashed-thermal my-2 w-full opacity-40"></div>
                <div className="w-full space-y-1 opacity-40 text-[10px]">
                  <div className="flex justify-between w-full"><span>Alt: QRIS / {storeConfig.qrisProvider}</span><span>LUNAS</span></div>
                  <div className="flex justify-between w-full"><span>Alt: DEBIT / {storeConfig.edcBank}</span><span>LUNAS</span></div>
                </div>

                <div className="border-dashed-thermal my-2 w-full"></div>
                <div className="text-center mt-2 mb-2 whitespace-pre-wrap break-words italic text-xs w-full">
                  {storeConfig.footer}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}