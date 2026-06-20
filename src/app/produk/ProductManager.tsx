// src/app/produk/ProductManager.tsx
'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react';
import { addProduct, deleteProduct, restockProduct } from './actions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

// Mendefinisikan tipe data yang turun dari Prisma Database
type Product = {
  id: string;
  sku: string;
  name: string;
  priceRetail: number;
  priceWholesale: number | null;
  wholesaleMinQty: number | null;
  stock: number;
  minStockAlert: number;
};

interface ProductManagerProps {
  initialProducts: Product[];
}

export default function ProductManager({ initialProducts }: ProductManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState('');
  
  // State baru untuk Smart Restock & Auto-fill
  const [skuInput, setSkuInput] = useState('');
  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const { confirm } = useConfirm();
  const toast = useToast();
  
  // Ref untuk mengontrol form dari luar event
  const formRef = useRef<HTMLFormElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus ke input SKU saat modal dibuka
  useEffect(() => {
    if (isModalOpen) {
      setSkuInput('');
      setExistingProduct(null);
      setErrorMessage('');
      setTimeout(() => skuInputRef.current?.focus(), 100);
    }
  }, [isModalOpen]);

  // Efek untuk memantau perubahan SKU (Debounce & Auto-detect)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const sku = skuInput.trim();
      if (!sku) {
        setExistingProduct(null);
        return;
      }
      
      // 1. Cek DB Lokal (Smart Restock)
      const found = initialProducts.find(p => p.sku === sku);
      if (found) {
        setExistingProduct(found);
        if (formRef.current) {
          const form = formRef.current;
          (form.elements.namedItem('name') as HTMLInputElement).value = found.name;
          (form.elements.namedItem('priceRetail') as HTMLInputElement).value = found.priceRetail.toString();
          (form.elements.namedItem('minStockAlert') as HTMLInputElement).value = found.minStockAlert.toString();
          if (found.priceWholesale) (form.elements.namedItem('priceWholesale') as HTMLInputElement).value = found.priceWholesale.toString();
          if (found.wholesaleMinQty) (form.elements.namedItem('wholesaleMinQty') as HTMLInputElement).value = found.wholesaleMinQty.toString();
        }
        return;
      }

      // 2. Cek API OpenFoodFacts jika tidak ada di lokal (hanya jika barcode angka >= 8 digit)
      setExistingProduct(null);
      if (sku.length >= 8 && /^\d+$/.test(sku)) {
        setIsLoadingApi(true);
        try {
          const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${sku}.json`);
          const data = await res.json();
          if (data.status === 1 && data.product && data.product.product_name) {
            if (formRef.current) {
              const nameInput = formRef.current.elements.namedItem('name') as HTMLInputElement;
              if (!nameInput.value) { // Auto-fill hanya jika kosong
                nameInput.value = data.product.product_name;
              }
            }
          }
        } catch (err) {
          console.error("Gagal memanggil API OpenFoodFacts", err);
        } finally {
          setIsLoadingApi(false);
        }
      }
    }, 400); // 400ms debounce agar tidak nge-spam

    return () => clearTimeout(timer);
  }, [skuInput, initialProducts]);

  // Fungsi utilitas format mata uang Rupiah
  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  };

  // Filter pencarian reaktif (tanpa loading database)
  const filteredProducts = initialProducts.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fungsi Action Form (Disesuaikan untuk Next.js Server Actions)
  const clientAction = (formData: FormData) => {
    setErrorMessage('');
    
    startTransition(async () => {
      if (existingProduct) {
        // MODE: RESTOCK PRODUK LAMA
        const addedStock = parseInt(formData.get('stock') as string) || 0;
        const result = await restockProduct(existingProduct.id, addedStock);
        if (result.success) {
          toast.success(`Stok produk "${existingProduct.name}" berhasil ditambah sebanyak ${addedStock} pcs.`);
          setIsModalOpen(false);
        } else {
          setErrorMessage(result.error || 'Terjadi kesalahan.');
        }
      } else {
        // MODE: TAMBAH PRODUK BARU
        const result = await addProduct(formData);
        if (result.success) {
          toast.success('Produk baru berhasil ditambahkan.');
          setIsModalOpen(false);
          formRef.current?.reset();
        } else {
          setErrorMessage(result.error || 'Terjadi kesalahan.');
        }
      }
    });
  };

  // Fungsi Hapus Produk
  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Hapus Produk',
      message: `Apakah Anda yakin ingin menghapus produk "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
    });
    if (ok) {
      startTransition(async () => {
        const result = await deleteProduct(id);
        if (result.success) {
          toast.success(`Produk "${name}" berhasil dihapus.`);
        } else {
          toast.error(result.error || 'Gagal menghapus produk.');
        }
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-margin-desktop h-full">
      
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-text-primary">Produk</h1>
          <p className="font-body-md text-body-md text-text-secondary mt-1">Kelola data master barang & stok toko lokal</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-11 px-4 flex items-center gap-2 rounded border border-border bg-surface text-text-primary font-label-md text-label-md hover:bg-surface-container-highest transition-colors">
            <span className="material-symbols-outlined text-text-secondary text-[18px]">table</span>
            Import Excel
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="h-11 px-4 flex items-center gap-2 rounded bg-primary-container text-on-primary-fixed font-label-md text-label-md font-bold hover:brightness-110 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-surface p-4 border border-border rounded-t-lg gap-4">
        <div className="w-full md:w-96 relative focus-pulse rounded">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
          <input 
            type="text" 
            placeholder="Cari nama produk atau SKU/Barcode..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded h-10 pl-10 pr-4 text-text-primary font-body-md text-body-md focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
          />
        </div>
      </div>

      {/* Tabel Produk (Terhubung ke SQLite) */}
      <div className="w-full border-x border-b border-border rounded-b-lg overflow-x-auto bg-surface mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-container-low">
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider">Produk & SKU</th>
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider w-48">Stok Tersedia</th>
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider">Harga Ecer</th>
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider">Harga Grosir</th>
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider">Batas Stok Peringatan</th>
              <th className="p-4 font-label-md text-label-md text-text-secondary font-medium tracking-wider text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="font-body-md text-body-md">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-text-secondary">
                  Belum ada data produk yang cocok.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                // Logika Peringatan Stok (Sesuai crosscheck database)
                const isLowStock = product.stock <= product.minStockAlert;
                const isOutOfStock = product.stock === 0;
                const rowClass = isOutOfStock 
                  ? 'border-l-2 border-l-danger bg-danger/5' 
                  : isLowStock 
                    ? 'border-l-2 border-l-warning bg-warning/5' 
                    : 'hover:bg-surface-container-high';

                return (
                  <tr key={product.id} className={`border-b border-border transition-colors ${rowClass}`}>
                    <td className="p-4 pl-3">
                      <div className="font-semibold text-text-primary">{product.name}</div>
                      <div className="text-text-secondary font-label-sm text-label-sm mt-0.5 font-mono">SKU: {product.sku}</div>
                    </td>
                    <td className="p-4">
                      <div className={`flex items-center gap-2 mb-1 ${isLowStock ? 'text-warning font-bold' : isOutOfStock ? 'text-danger font-bold' : ''}`}>
                        {isLowStock && !isOutOfStock && <span className="material-symbols-outlined text-[16px]">warning</span>}
                        {isOutOfStock && <span className="material-symbols-outlined text-[16px]">error</span>}
                        <span className="text-text-primary font-medium">{product.stock}</span>
                        <span className="text-text-secondary text-[10px] opacity-80">pcs</span>
                      </div>
                      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${isOutOfStock ? 'bg-danger' : isLowStock ? 'bg-warning' : 'bg-primary-container'}`} 
                          style={{ width: `${Math.min((product.stock / (product.minStockAlert * 3)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="p-4 text-text-primary font-medium">{formatRupiah(product.priceRetail)}</td>
                    <td className="p-4 text-text-secondary">
                      {product.priceWholesale ? (
                        <>
                          <div className="text-text-primary">{formatRupiah(product.priceWholesale)}</div>
                          <div className="text-[10px] mt-0.5">Min beli: {product.wholesaleMinQty}</div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-surface-container-highest border border-border text-text-secondary font-label-sm text-label-sm">
                        Menipis jika ≤ {product.minStockAlert}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button disabled={isPending} onClick={() => handleDelete(product.id, product.name)} className="p-1.5 text-text-secondary hover:text-danger transition-colors ml-1" title="Hapus Produk">
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

      {/* Modal Tambah Produk Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-surface border border-border rounded-lg shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="font-headline-sm text-headline-sm text-text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">
                  {existingProduct ? 'autorenew' : 'inventory_2'}
                </span>
                {existingProduct ? 'Restock Produk' : 'Tambah Produk Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Action menggunakan clientAction dan ditambahkan ref */}
            <form action={clientAction} ref={formRef} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 font-body-md text-body-md grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {errorMessage && (
                  <div className="col-span-1 md:col-span-2 bg-danger/10 border border-danger text-danger px-4 py-3 rounded text-sm">
                    {errorMessage}
                  </div>
                )}
                
                <div className="col-span-1 md:col-span-2 focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md flex items-center gap-2">
                    SKU / Barcode
                    {isLoadingApi && <span className="text-primary text-[10px] animate-pulse">(Mencari di internet...)</span>}
                  </label>
                  <input 
                    name="sku" 
                    type="text" 
                    ref={skuInputRef}
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value)}
                    className={`w-full border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-primary-container/20 border-primary-container' : 'bg-background border-border'}`}
                    placeholder="Scan barcode di sini..." 
                  />
                  {existingProduct && (
                    <p className="text-primary text-xs mt-1">✓ Produk ditemukan di database. Beralih ke mode Restock.</p>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2 focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md">Nama Produk *</label>
                  <input name="name" required type="text" readOnly={!!existingProduct} className={`w-full border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-surface-container opacity-70' : 'bg-background'}`} placeholder="Contoh: Kopi Gayo 200g" />
                </div>
                
                <div className="focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md">Batas Alert Stok Menipis *</label>
                  <input name="minStockAlert" type="number" defaultValue="5" min="0" required readOnly={!!existingProduct} className={`w-full border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-surface-container opacity-70' : 'bg-background'}`} />
                </div>
                
                <div className="col-span-1 md:col-span-2 mt-2 pt-6 border-t border-border">
                  <h3 className="font-label-md text-label-md text-text-primary uppercase tracking-wider text-text-secondary">Harga & Kuantitas Fisik</h3>
                </div>
                
                <div className="focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md">Harga Ecer (Rp) *</label>
                  <input name="priceRetail" type="number" required readOnly={!!existingProduct} className={`w-full border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-surface-container opacity-70' : 'bg-background'}`} placeholder="Misal: 15000" />
                </div>
                
                <div className="focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md font-bold text-primary">
                    {existingProduct ? `Tambah Stok Baru (Stok Saat Ini: ${existingProduct.stock} pcs) *` : 'Stok Awal Fisik *'}
                  </label>
                  <input name="stock" type="number" defaultValue="0" min={existingProduct ? "1" : "0"} required className="w-full bg-background border-2 border-primary-container rounded h-11 px-4 text-text-primary focus:outline-none transition-all" />
                </div>
                
                <div className="focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md">Harga Grosir (Opsional)</label>
                  <input name="priceWholesale" type="number" readOnly={!!existingProduct} className={`w-full border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-surface-container opacity-70' : 'bg-background'}`} placeholder="Harga untuk pembelian banyak" />
                </div>
                
                <div className="focus-pulse">
                  <label className="block text-text-secondary mb-2 font-label-md text-label-md">Minimal Qty Grosir</label>
                  <input name="wholesaleMinQty" type="number" defaultValue="0" min="0" readOnly={!!existingProduct} className={`w-full border border-border rounded h-11 px-4 text-text-primary focus:outline-none transition-all ${existingProduct ? 'bg-surface-container opacity-70' : 'bg-background'}`} placeholder="Misal: 12" />
                </div>
              </div>

              <div className="p-6 border-t border-border bg-surface-container flex justify-end gap-3 rounded-b-lg shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isPending} className="h-11 px-6 rounded border border-border text-text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md">
                  Batal
                </button>
                <button type="submit" disabled={isPending} className="h-11 px-6 rounded bg-primary-container text-on-primary-fixed hover:bg-primary-fixed-dim transition-colors font-label-md text-label-md font-bold disabled:opacity-50 flex items-center gap-2">
                  {isPending ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Simpan ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}