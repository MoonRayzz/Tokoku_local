// src/app/member/MemberManager.tsx
'use client'

import React, { useState, useTransition, useRef } from 'react';
import { addMember, deleteMember } from './actions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useReactToPrint } from 'react-to-print';
import { PrintableMemberCards } from './components/PrintableMemberCards';
import { MemberCardProps } from './components/MemberCard';

type MemberType = {
  id: string;
  name: string;
  phone: string;
  joinedAt: Date;
};

type MemberTier = {
  id: string;
  name: string;
  minTransactions: number;
  minTotalSpent: number;
  minOrderAmount: number;
  discountPercentage: number;
  maxDiscountAmount: number;
};

interface MemberManagerProps {
  initialMembers: MemberType[];
  tiers: MemberTier[];
  memberStats: Record<string, { txCount: number, totalSpent: number }>;
  storeProfile: { name: string; logoUrl: string | null };
}

export default function MemberManager({ initialMembers, tiers, memberStats, storeProfile }: MemberManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  
  const formRef = useRef<HTMLFormElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Kartu Member TokoKu',
  });

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length && filteredMembers.length > 0) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedMembers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMembers(newSet);
  };

  // Filter pencarian reaktif
  const filteredMembers = initialMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    member.phone.includes(searchQuery)
  );

  // Penentuan Status Tier Otomatis berdasarkan jumlah transaksi
  const getMemberTier = (memberId: string) => {
    const stats = memberStats[memberId] || { txCount: 0, totalSpent: 0 };
    const activeTier = tiers.find((t) => {
      const meetsTx = t.minTransactions > 0 && stats.txCount >= t.minTransactions;
      const meetsSpent = t.minTotalSpent > 0 && stats.totalSpent >= t.minTotalSpent;
      if (t.minTransactions === 0 && t.minTotalSpent === 0) return true;
      return meetsTx || meetsSpent;
    }) || (tiers.length > 0 ? tiers[tiers.length - 1] : null);

    if (!activeTier) return { label: 'TANPA LEVEL', color: 'bg-surface-bright text-text-secondary', name: 'Tanpa Level' };

    const colors = [
      'bg-emerald-500 text-white',
      'bg-amber-500 text-white',
      'bg-blue-500 text-white',
      'bg-purple-500 text-white',
      'bg-pink-500 text-white',
    ];
    const idx = tiers.findIndex(t => t.id === activeTier.id);
    return { label: activeTier.name.toUpperCase(), color: colors[idx % colors.length], name: activeTier.name };
  };

  // Kalkulasi statistik untuk Progress Bar
  const tierCount: Record<string, number> = {};
  tiers.forEach(t => tierCount[t.name] = 0);
  tierCount['Tanpa Level'] = 0;
  
  initialMembers.forEach(m => {
    const tier = getMemberTier(m.id);
    tierCount[tier.name]++;
  });

  const totalMembers = initialMembers.length || 1; // Hindari pembagian 0

  const { confirm } = useConfirm();

  const clientAction = (formData: FormData) => {
    setErrorMessage('');
    startTransition(async () => {
      const result = await addMember(formData);
      if (result.success) {
        formRef.current?.reset();
      } else {
        setErrorMessage(result.error || 'Terjadi kesalahan.');
      }
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Hapus Member',
      message: `Hapus data pelanggan "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
    });
    if (ok) {
      startTransition(async () => {
        await deleteMember(id);
      });
    }
  };

  const printCardsData: MemberCardProps[] = Array.from(selectedMembers).map(id => {
    const member = initialMembers.find(m => m.id === id);
    if (!member) return null;
    const tier = getMemberTier(member.id);
    return {
      memberId: member.id,
      name: member.name,
      phone: member.phone,
      tierName: tier.name,
      tierColorClass: tier.color,
      storeName: storeProfile?.name || 'TokoKu',
      logoUrl: storeProfile?.logoUrl,
    };
  }).filter(Boolean) as MemberCardProps[];

  return (
    <div className="flex-1 overflow-y-auto p-margin-desktop h-full">
      <div className="mb-8">
        <h1 className="font-headline-md text-headline-md text-text-primary">Manajemen Member</h1>
        <p className="font-body-md text-body-md text-text-secondary mt-1">Kelola data pelanggan dan tier keanggotaan</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Kolom Kiri: Tabel Data Member */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-surface p-4 border border-border rounded-lg flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-1/2 relative focus-pulse rounded">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
              <input 
                type="text" 
                placeholder="Cari nama atau nomor handphone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded h-10 pl-10 pr-4 text-text-primary font-body-md text-body-md focus:outline-none transition-all"
              />
            </div>
            {selectedMembers.size > 0 && (
              <button onClick={() => handlePrint()} className="px-4 py-2 bg-primary-container hover:brightness-110 text-on-primary-container rounded text-sm font-bold flex items-center gap-2 transition-all">
                <span className="material-symbols-outlined text-[18px]">print</span>
                Cetak {selectedMembers.size} Member Terpilih
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-x-auto bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-container-low">
                  <th className="p-4 w-10 text-center">
                    <input type="checkbox" onChange={toggleSelectAll} checked={filteredMembers.length > 0 && selectedMembers.size === filteredMembers.length} className="w-4 h-4 cursor-pointer" />
                  </th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium">Pelanggan</th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium">Kontak</th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium">Tanggal Gabung</th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium text-center">Total Belanja</th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium">Tier</th>
                  <th className="p-4 font-label-md text-label-md text-text-secondary font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-text-secondary">Belum ada data pelanggan.</td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const tier = getMemberTier(member.id);
                    return (
                      <tr key={member.id} className="border-b border-border hover:bg-surface-container-high transition-colors">
                        <td className="p-4 text-center">
                          <input type="checkbox" onChange={() => toggleSelect(member.id)} checked={selectedMembers.has(member.id)} className="w-4 h-4 cursor-pointer" />
                        </td>
                        <td className="p-4 font-medium text-text-primary">{member.name}</td>
                        <td className="p-4 text-text-secondary">{member.phone}</td>
                        <td className="p-4 text-text-secondary">{new Date(member.joinedAt).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-text-primary">
                              Rp {(memberStats[member.id]?.totalSpent || 0).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              ({memberStats[member.id]?.txCount || 0} Trx)
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${tier.color}`}>
                            {tier.label}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setSelectedMembers(new Set([member.id])); setTimeout(() => handlePrint(), 100); }} className="p-1.5 text-text-secondary hover:text-primary transition-colors" title="Cetak Kartu">
                              <span className="material-symbols-outlined text-[20px]">print</span>
                            </button>
                            <button disabled={isPending} onClick={() => handleDelete(member.id, member.name)} className="p-1.5 text-text-secondary hover:text-danger transition-colors" title="Hapus Member">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan: Form Pendaftaran Cepat & Statistik */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-headline-sm text-headline-sm text-text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">person_add</span>
              Daftar Member Baru
            </h2>
            
            <form action={clientAction} ref={formRef} className="flex flex-col gap-4">
              {errorMessage && (
                <div className="bg-danger/10 border border-danger text-danger px-3 py-2 rounded text-sm mb-2">
                  {errorMessage}
                </div>
              )}
              
              <div className="focus-pulse">
                <label className="block text-text-secondary mb-1.5 font-label-md text-label-md">Nama Lengkap</label>
                <input name="name" required type="text" className="w-full bg-background border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all" placeholder="Misal: Budi Santoso" />
              </div>
              
              <div className="focus-pulse">
                <label className="block text-text-secondary mb-1.5 font-label-md text-label-md">Nomor WhatsApp</label>
                <input name="phone" required type="text" className="w-full bg-background border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all" placeholder="Misal: 08123456789" />
              </div>

              <div className="mt-2 p-3 bg-surface-container-low border border-border rounded-lg">
                <p className="text-[11px] text-text-secondary">
                  <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
                  Level/Tier member akan otomatis ditingkatkan oleh sistem berdasarkan rutinitas belanja pelanggan.
                </p>
              </div>

              <button type="submit" disabled={isPending} className="w-full bg-primary-container hover:brightness-110 text-on-primary-fixed font-bold font-label-md px-6 py-3 rounded transition-colors flex items-center justify-center gap-2 h-11 mt-2 disabled:opacity-50">
                {isPending ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Daftarkan Sekarang'}
              </button>
            </form>

            {/* Area Statistik (Sesuai Mockup) */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex justify-between items-end mb-3">
                <span className="font-label-md text-text-secondary">Total Member Aktif:</span>
                <span className="font-headline-md text-text-primary">{initialMembers.length}</span>
              </div>
              
              <div className="h-2 w-full flex rounded-full overflow-hidden gap-0.5">
                {Object.keys(tierCount).map((tierName, idx) => {
                  const count = tierCount[tierName];
                  if (count === 0) return null;
                  const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                  const bgColor = tierName === 'Tanpa Level' ? 'bg-surface-bright' : colors[idx % colors.length];
                  return (
                    <div key={tierName} className={`h-full ${bgColor}`} style={{ width: `${(count / totalMembers) * 100}%` }} title={`${tierName}: ${count}`}></div>
                  );
                })}
              </div>
              
              <div className="flex flex-wrap gap-4 mt-3">
                {Object.keys(tierCount).map((tierName, idx) => {
                  const count = tierCount[tierName];
                  if (count === 0 && tierName !== 'Tanpa Level') return null;
                  const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                  const bgColor = tierName === 'Tanpa Level' ? 'bg-surface-bright' : colors[idx % colors.length];
                  return (
                    <div key={tierName} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <div className={`w-2 h-2 rounded-full ${bgColor}`}></div> {tierName}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden Printable Component */}
      <div className="absolute opacity-0 -left-[9999px] -top-[9999px]">
        <PrintableMemberCards ref={printRef} cards={printCardsData} />
      </div>
    </div>
  );
}