'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPurchaseOrder } from './actions';
import { ArrowLeft, Plus, Trash2, Save, Search } from 'lucide-react';
import { useSync } from '@/context/SyncContext';

export default function PurchaseOrderManager({ products }: { products: any[] }) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; name: string; quantity: number; priceBuy: number; subtotal: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { triggerSync } = useSync();

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = (product: any) => {
    if (items.some(i => i.productId === product.id)) return;
    setItems([...items, { 
      productId: product.id, 
      name: product.name,
      quantity: 1, 
      priceBuy: product.priceBuy || 0,
      subtotal: (product.priceBuy || 0) * 1
    }]);
    setSearchTerm(''); // reset search
  };

  const updateItem = (productId: string, field: 'quantity' | 'priceBuy', value: number) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        const updatedItem = { ...item, [field]: value };
        updatedItem.subtotal = updatedItem.quantity * updatedItem.priceBuy;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return alert('Pilih minimal 1 produk');

    setIsSubmitting(true);
    const result = await createPurchaseOrder({
      supplierName,
      notes,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        priceBuy: i.priceBuy,
        subtotal: i.subtotal
      })),
      totalAmount
    });

    setIsSubmitting(false);

    if (result.success) {
      alert('Purchase Order berhasil disimpan dan stok bertambah!');
      triggerSync(); // Trigger event-based sync
      router.push('/produk');
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/produk')}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-text-secondary" />
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Terima Stok Baru (PO)</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col - Product Search & List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-card p-6 rounded-2xl border border-border-divider">
            <h2 className="font-semibold text-lg mb-4">Pilih Produk</h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
              <input 
                type="text"
                placeholder="Cari produk (nama / sku)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-background border border-border-divider rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {searchTerm && (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-border-divider divide-y divide-border-divider">
                {filteredProducts.slice(0, 10).map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 hover:bg-surface-hover transition-colors">
                    <div>
                      <p className="font-medium text-text-primary">{product.name}</p>
                      <p className="text-sm text-text-secondary">SKU: {product.sku} | Stok: {product.stock}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => addItem(product)}
                      disabled={items.some(i => i.productId === product.id)}
                      className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-lg text-sm font-medium hover:bg-brand-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {items.some(i => i.productId === product.id) ? 'Terpilih' : 'Tambah'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-card p-6 rounded-2xl border border-border-divider overflow-hidden">
            <h2 className="font-semibold text-lg mb-4">Daftar Item PO</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-background/50 border-y border-border-divider">
                  <tr>
                    <th className="p-4 font-medium text-text-secondary">Produk</th>
                    <th className="p-4 font-medium text-text-secondary w-32">Qty Masuk</th>
                    <th className="p-4 font-medium text-text-secondary w-40">Harga Modal (Rp)</th>
                    <th className="p-4 font-medium text-text-secondary text-right">Subtotal</th>
                    <th className="p-4 font-medium text-text-secondary w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-divider">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-secondary">Belum ada produk yang dipilih</td>
                    </tr>
                  ) : items.map((item, index) => (
                    <tr key={item.productId} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="p-4 font-medium text-text-primary">{index + 1}. {item.name}</td>
                      <td className="p-4">
                        <input 
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full bg-surface-background border border-border-divider rounded-lg px-3 py-2 text-center"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="number"
                          min="0"
                          value={item.priceBuy}
                          onChange={(e) => updateItem(item.productId, 'priceBuy', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-background border border-border-divider rounded-lg px-3 py-2 text-right"
                        />
                      </td>
                      <td className="p-4 text-right font-medium">
                        {item.subtotal.toLocaleString('id-ID')}
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => removeItem(item.productId)}
                          className="p-2 text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col - PO Details & Submit */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="bg-surface-card p-6 rounded-2xl border border-border-divider space-y-4 sticky top-6">
            <h2 className="font-semibold text-lg mb-2">Detail Purchase Order</h2>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Nama Supplier</label>
              <input 
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Misal: PT Indo Makmur (Opsional)"
                className="w-full bg-surface-background border border-border-divider rounded-xl px-4 py-3"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">Catatan</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan penerimaan..."
                rows={3}
                className="w-full bg-surface-background border border-border-divider rounded-xl px-4 py-3 resize-none"
              />
            </div>

            <div className="pt-4 border-t border-border-divider">
              <div className="flex items-center justify-between mb-4">
                <span className="text-text-secondary">Total PO</span>
                <span className="text-2xl font-bold text-text-primary">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </span>
              </div>
              
              <button 
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-xl font-medium hover:bg-brand-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {isSubmitting ? 'Menyimpan...' : 'Simpan & Masukkan Stok'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
