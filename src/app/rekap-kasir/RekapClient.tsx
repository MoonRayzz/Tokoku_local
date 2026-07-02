'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, CheckCircle, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { getSystemCash, submitRekapKasir } from './actions';
import { useRouter } from 'next/navigation';

export default function RekapClient({ employees, shifts, activeAttendances }: any) {
  const toast = useToast();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [startingCash, setStartingCash] = useState<number>(0);
  const [actualCash, setActualCash] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [actionAfterClose, setActionAfterClose] = useState('KEPT_IN_DRAWER');
  
  const [systemData, setSystemData] = useState<{
    netSales: number;
    totalExpense: number;
    totalCicilan: number;
    systemCash: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Denominations for physical count
  const [denoms, setDenoms] = useState({
    100000: 0,
    50000: 0,
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0
  });

  const [step, setStep] = useState(1);

  // Automatically select active attendance if exists
  useEffect(() => {
    if (activeAttendances.length > 0) {
      setEmployeeId(activeAttendances[0].employeeId);
      if (activeAttendances[0].shiftId) {
        setShiftId(activeAttendances[0].shiftId);
      }
    }
  }, [activeAttendances]);

  // Recalculate actual cash when denoms change
  useEffect(() => {
    let total = 0;
    Object.entries(denoms).forEach(([val, count]) => {
      total += Number(val) * count;
    });
    if (showCalculator) {
      setActualCash(total);
    }
  }, [denoms, showCalculator]);

  const handleFetchSystemCash = async () => {
    if (!employeeId) return toast.error('Pilih Kasir terlebih dahulu');
    setLoading(true);
    try {
      const data = await getSystemCash(employeeId, shiftId || null);
      setSystemData(data);
      setStep(2); // Go to step 2 after fetching data
    } catch (err) {
      toast.error('Gagal mengambil data sistem');
    } finally {
      setLoading(false);
    }
  };

  const handleDenomChange = (denom: string, val: string) => {
    const num = parseInt(val) || 0;
    setDenoms(prev => ({ ...prev, [denom]: num }));
  };

  const handleCalculateVariance = () => {
    if (actualCash <= 0 && !confirm('Uang fisik 0. Lanjutkan?')) return;
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!systemData) return toast.error('Hitung Uang Sistem terlebih dahulu');
    
    setLoading(true);
    
    // Hitung ulang systemCash ditambah startingCash (Modal)
    const finalSystemCash = systemData.systemCash + startingCash;
    const variance = actualCash - finalSystemCash;

    try {
      const res = await submitRekapKasir({
        employeeId,
        shiftId: shiftId || null,
        startTime: new Date(new Date().setHours(0,0,0,0)), // Simplified, should be real start time
        startingCash,
        actualCash,
        systemCash: finalSystemCash,
        variance,
        totalSales: systemData.netSales,
        totalExpense: systemData.totalExpense,
        notes,
        actionAfterClose
      });

      if (res.success) {
        toast.success('Rekap Kasir Berhasil Disimpan!');
        router.refresh();
        // Reset
        setSystemData(null);
        setActualCash(0);
        setStartingCash(0);
        setNotes('');
        setStep(1);
      } else {
        toast.error(res.error || 'Gagal menyimpan');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const currentSystemCash = systemData ? systemData.systemCash + startingCash : 0;
  const currentVariance = systemData ? actualCash - currentSystemCash : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Tutup Shift & Hitung Laci</h1>
          <p className="text-text-secondary mt-1">Cocokkan uang di laci dengan catatan sistem sebelum pulang</p>
        </div>
      </div>

      {/* WIZARD PROGRESS BAR */}
      <div className="flex gap-2 mb-6">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-surface-variant'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-surface-variant'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-surface-variant'}`} />
      </div>
      <div className="flex justify-between text-xs font-medium text-text-secondary mb-8 px-1">
        <span className={step >= 1 ? 'text-primary' : ''}>1. Data Shift</span>
        <span className={step >= 2 ? 'text-primary' : ''}>2. Hitung Uang Laci</span>
        <span className={step >= 3 ? 'text-primary' : ''}>3. Hasil Pencocokan</span>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
        
        {/* STEP 1: DATA SHIFT */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary mb-6">
              <CheckCircle className="w-5 h-5 text-primary" />
              Langkah 1: Lengkapi Data Shift
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Nama kasir</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary focus:outline-none focus:border-primary-container"
                  value={employeeId} 
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">-- Pilih Kasir --</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Shift (Opsional)</label>
                <select 
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary focus:outline-none focus:border-primary-container"
                  value={shiftId} 
                  onChange={(e) => setShiftId(e.target.value)}
                >
                  <option value="">-- Tidak Terikat Shift --</option>
                  {shifts.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 pt-4 border-t border-border mt-4">
                <label className="text-sm font-medium text-text-secondary">Uang di laci saat shift MULAI tadi</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-3 bg-background border border-border rounded-md text-text-primary font-bold text-lg focus:outline-none focus:border-primary-container"
                  value={startingCash || ''} 
                  onChange={(e) => setStartingCash(Number(e.target.value))} 
                  placeholder="Contoh: 100000"
                />
                <p className="text-xs text-text-secondary opacity-80 mt-1">Uang receh yang dikasih untuk kembalian pelanggan di awal shift.</p>
              </div>

              <div className="flex justify-end pt-4 mt-6">
                <button 
                  onClick={handleFetchSystemCash} 
                  disabled={loading} 
                  className="px-6 bg-primary text-white py-2.5 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  Lanjut →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: HITUNG UANG FISIK */}
        {step === 2 && systemData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary mb-6">
              <Calculator className="w-5 h-5 text-secondary" />
              Langkah 2: Hitung Uang di Laci
            </h3>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 flex justify-between items-center">
              <div>
                <p className="text-sm text-text-secondary font-medium">Sistem mencatat seharusnya ada uang:</p>
                {systemData.totalCicilan > 0 && <p className="text-xs text-primary/80 mt-1">*(Termasuk pelunasan utang Rp {systemData.totalCicilan.toLocaleString('id-ID')})</p>}
              </div>
              <span className="text-2xl font-black text-primary">Rp {currentSystemCash.toLocaleString('id-ID')}</span>
            </div>

            <div className="space-y-4">
              {!showCalculator ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-secondary">Uang di laci SEKARANG (hitung dulu)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-background border border-border rounded-md text-2xl font-bold h-16 text-text-primary focus:outline-none focus:border-primary-container"
                    value={actualCash || ''} 
                    onChange={(e) => setActualCash(Number(e.target.value))} 
                  />
                  <p className="text-xs text-text-secondary mt-1">Hitung semua uang fisik yang ada di laci saat ini, lalu tulis totalnya di atas.</p>
                  
                  <div className="flex items-center gap-4 mt-4 py-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-xs font-bold text-text-secondary uppercase">ATAU</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  <button 
                    className="w-full border border-border py-3 rounded-md font-medium text-text-secondary hover:bg-surface-bright flex items-center justify-center gap-2" 
                    onClick={() => setShowCalculator(true)}
                  >
                    🧮 Bantu saya hitung per lembar uang
                  </button>
                </div>
              ) : (
                <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-border">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-text-primary flex items-center gap-2">
                      🧮 Kalkulator Pecahan
                    </span>
                    <button 
                      className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 bg-surface border border-border rounded" 
                      onClick={() => setShowCalculator(false)}
                    >
                      Batal
                    </button>
                  </div>
                  {[100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100].map(denom => (
                    <div key={denom} className="flex items-center gap-3">
                      <div className="w-24 text-right font-medium text-sm text-text-primary">Rp {denom.toLocaleString('id-ID')}</div>
                      <div className="text-text-secondary text-sm">×</div>
                      <input 
                        type="number" 
                        min="0"
                        className="w-20 h-9 px-3 bg-background border border-border rounded-md text-text-primary focus:outline-none focus:border-primary-container" 
                        value={(denoms as any)[denom] || ''} 
                        onChange={(e) => handleDenomChange(denom.toString(), e.target.value)}
                      />
                      <div className="flex-1 text-right text-sm text-text-secondary font-medium">
                        = Rp {((denoms as any)[denom] * denom).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-border mt-4 flex justify-between items-center text-text-primary bg-background -mx-4 -mb-4 p-4 rounded-b-xl">
                    <span className="font-bold">Total Dihitung Laci</span>
                    <span className="text-2xl font-black text-primary">Rp {actualCash.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 mt-6 border-t border-border">
                <button 
                  onClick={() => setStep(1)} 
                  className="px-6 border border-border py-2.5 rounded-md font-medium text-text-secondary hover:bg-surface-bright"
                >
                  ← Kembali
                </button>
                <button 
                  onClick={handleCalculateVariance} 
                  className="px-6 bg-primary text-white py-2.5 rounded-md font-medium hover:bg-primary/90"
                >
                  Lihat Hasil →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: HASIL PENCOCOKAN */}
        {step === 3 && systemData && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary mb-6">
              <CheckCircle className="w-5 h-5 text-success" />
              Langkah 3: Hasil Pencocokan
            </h3>

            <div className="bg-surface-container-low rounded-xl border border-border overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary flex items-center gap-2">✅ Sistem mencatat</span>
                  <span className="font-medium text-text-primary">Rp {currentSystemCash.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary flex items-center gap-2">📦 Fisik dihitung</span>
                  <span className="font-medium text-text-primary">Rp {actualCash.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className={`p-4 border-t ${currentVariance === 0 ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-bold ${currentVariance === 0 ? 'text-success' : currentVariance < 0 ? 'text-danger' : 'text-warning'}`}>
                    {currentVariance === 0 ? 'Uang Pas' : currentVariance < 0 ? '⚠️ Selisih Kurang' : '⚠️ Selisih Lebih'}
                  </span>
                  <span className={`text-2xl font-black ${currentVariance === 0 ? 'text-success' : currentVariance < 0 ? 'text-danger' : 'text-warning'}`}>
                    {currentVariance > 0 ? '+' : ''}Rp {currentVariance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
            
            {currentVariance !== 0 && (
              <div className="space-y-2 mt-6">
                <label className="text-sm font-bold text-danger">Wajib isi alasan selisih:</label>
                <textarea 
                  placeholder="Kenapa uangnya bisa kurang/lebih? Tolong jelaskan di sini..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-3 bg-background border rounded-md border-danger/50 text-text-primary focus:border-danger outline-none resize-none"
                />
              </div>
            )}

            {currentVariance === 0 && (
              <div className="space-y-2 mt-6">
                <label className="text-sm font-bold text-text-secondary">Catatan tambahan (opsional):</label>
                <textarea 
                  placeholder="Ada pesan untuk owner/manajer?" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-text-primary outline-none focus:border-primary-container resize-none"
                />
              </div>
            )}
            <div className="space-y-3 mt-6">
              <label className="text-sm font-bold text-text-primary">Status Uang Fisik Laci (Wajib Pilih):</label>
              <div className="flex flex-col gap-3">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${actionAfterClose === 'KEPT_IN_DRAWER' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-surface-bright'}`}>
                  <input 
                    type="radio" 
                    name="actionAfterClose" 
                    value="KEPT_IN_DRAWER" 
                    checked={actionAfterClose === 'KEPT_IN_DRAWER'} 
                    onChange={(e) => setActionAfterClose(e.target.value)}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-bold text-text-primary text-sm">🔒 Tinggal di Laci (Nyambung ke shift selanjutnya)</p>
                    <p className="text-xs text-text-secondary mt-1">Uang fisik dibiarkan di laci. Shift selanjutnya akan mencatat nominal ini sebagai modal awal.</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${actionAfterClose === 'DEPOSITED' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-surface-bright'}`}>
                  <input 
                    type="radio" 
                    name="actionAfterClose" 
                    value="DEPOSITED" 
                    checked={actionAfterClose === 'DEPOSITED'} 
                    onChange={(e) => setActionAfterClose(e.target.value)}
                    className="w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-bold text-text-primary text-sm">📥 Setor ke Owner / Brankas (Laci dikosongkan)</p>
                    <p className="text-xs text-text-secondary mt-1">Uang fisik diserahkan ke manajer/owner. Shift selanjutnya akan mulai dengan laci kosong (Rp 0).</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-6 mt-6 border-t border-border">
              <button 
                onClick={() => setStep(2)} 
                className="px-6 border border-border py-2.5 rounded-md font-medium text-text-secondary hover:bg-surface-bright"
              >
                ← Kembali
              </button>
              <button 
                onClick={handleSubmit} 
                disabled={loading || (currentVariance !== 0 && notes.trim() === '')} 
                className={`px-6 py-2.5 rounded-md font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 ${currentVariance === 0 ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}`}
              >
                <Save className="w-5 h-5" />
                Simpan & Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
