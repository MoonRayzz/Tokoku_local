// src/app/member/MemberManager.tsx
'use client'

import React, { useState, useTransition, useRef } from 'react';
import { addMember, deleteMember } from './actions';
import { useConfirm } from '@/components/ui/ConfirmDialog';

// Tipe data yang turun dari Prisma, termasuk jumlah transaksi (Join Table)
type MemberWithTxCount = {
  id: string;
  name: string;
  phone: string;
  joinedAt: Date;
  _count: {
    Transaction: number;
  };
};

interface MemberManagerProps {
  initialMembers: MemberWithTxCount[];
}

export default function MemberManager({ initialMembers }: MemberManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState('');
  
  const formRef = useRef<HTMLFormElement>(null);

  // Filter pencarian reaktif
  const filteredMembers = initialMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    member.phone.includes(searchQuery)
  );

  // Penentuan Status Tier Otomatis berdasarkan jumlah transaksi
  const getMemberTier = (txCount: number) => {
    if (txCount >= 20) return { label: 'EMAS', color: 'bg-primary-container text-background' };
    if (txCount >= 5) return { label: 'PERAK', color: 'bg-warning text-on-surface' };
    return { label: 'REGULER', color: 'bg-surface-bright text-text-secondary' };
  };

  // Kalkulasi statistik untuk Progress Bar
  const totalEmas = initialMembers.filter(m => m._count.Transaction >= 20).length;
  const totalPerak = initialMembers.filter(m => m._count.Transaction >= 5 && m._count.Transaction < 20).length;
  const totalReguler = initialMembers.filter(m => m._count.Transaction < 5).length;
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

  return (
    <div className="flex-1 overflow-y-auto p-margin-desktop h-full">
      <div className="mb-8">
        <h1 className="font-headline-md text-headline-md text-text-primary">Manajemen Member</h1>
        <p className="font-body-md text-body-md text-text-secondary mt-1">Kelola data pelanggan dan tier keanggotaan</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Kolom Kiri: Tabel Data Member */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-surface p-4 border border-border rounded-lg flex items-center">
            <div className="w-full relative focus-pulse rounded">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
              <input 
                type="text" 
                placeholder="Cari nama atau nomor handphone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded h-10 pl-10 pr-4 text-text-primary font-body-md text-body-md focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-x-auto bg-surface">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-container-low">
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
                    <td colSpan={6} className="p-8 text-center text-text-secondary">Belum ada data pelanggan.</td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const tier = getMemberTier(member._count.Transaction);
                    return (
                      <tr key={member.id} className="border-b border-border hover:bg-surface-container-high transition-colors">
                        <td className="p-4 font-medium text-text-primary">{member.name}</td>
                        <td className="p-4 text-text-secondary">{member.phone}</td>
                        <td className="p-4 text-text-secondary">{new Date(member.joinedAt).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 text-center">
                          <span className="font-semibold text-text-primary">{member._count.Transaction}</span> x
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${tier.color}`}>
                            {tier.label}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button disabled={isPending} onClick={() => handleDelete(member.id, member.name)} className="p-1.5 text-text-secondary hover:text-danger transition-colors">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
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
                <div className="h-full bg-primary-container" style={{ width: `${(totalEmas / totalMembers) * 100}%` }} title={`Emas: ${totalEmas}`}></div>
                <div className="h-full bg-warning" style={{ width: `${(totalPerak / totalMembers) * 100}%` }} title={`Perak: ${totalPerak}`}></div>
                <div className="h-full bg-surface-bright" style={{ width: `${(totalReguler / totalMembers) * 100}%` }} title={`Reguler: ${totalReguler}`}></div>
              </div>
              
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <div className="w-2 h-2 rounded-full bg-primary-container"></div> Emas
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <div className="w-2 h-2 rounded-full bg-warning"></div> Perak
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <div className="w-2 h-2 rounded-full bg-surface-bright"></div> Reguler
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}