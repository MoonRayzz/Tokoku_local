// src/components/layout/Sidebar.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoreProfile } from '@/app/pengaturan/actions';
import { SyncIndicator } from '../sync/SyncIndicator';

export function Sidebar() {
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState('');
  const [storeName, setStoreName] = useState('TokoKu POS');

  useEffect(() => {
    getStoreProfile().then(profile => {
      if (profile) {
        if (profile.logoUrl) setLogoUrl(profile.logoUrl);
        if (profile.name) setStoreName(profile.name);
      }
    });
  }, []);

  const navItems = [
    { name: 'Kasir', href: '/', icon: 'point_of_sale' },
    { name: 'Produk', href: '/produk', icon: 'inventory_2' },
    { name: 'Transaksi', href: '/transaksi', icon: 'receipt_long' },
    { name: 'Buku Utang', href: '/buku-utang', icon: 'menu_book' },
    { name: 'Pengeluaran', href: '/pengeluaran', icon: 'account_balance_wallet' },
    { name: 'Member', href: '/member', icon: 'group' },
    { name: 'Laporan', href: '/laporan', icon: 'analytics' },
    { name: 'Pengaturan', href: '/pengaturan', icon: 'settings' },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full flex flex-col z-50 bg-surface border-r border-border w-sidebar-collapsed hover:w-sidebar-expanded transition-all duration-300 group overflow-hidden">
      
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-background font-bold text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              storefront
            </span>
          )}
        </div>
        <div className="flex flex-col ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 min-w-0 pr-2">
          <span className="text-base font-bold text-primary leading-tight break-words whitespace-normal line-clamp-2">{storeName}</span>
          <span className="text-[11px] font-semibold text-text-secondary tracking-wide mt-0.5">Terminal 01</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 flex flex-col gap-2 overflow-y-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-4 px-3 py-3 rounded-lg transition-transform scale-95 active:scale-90 ${
                isActive 
                  ? 'text-primary border-l-4 border-primary bg-primary-container/10 font-medium' 
                  : 'text-on-surface-variant hover:text-text-primary hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined shrink-0" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap text-sm">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      <SyncIndicator />
    </nav>
  );
}