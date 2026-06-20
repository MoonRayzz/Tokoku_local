// src/app/produk/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addProduct(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    let sku = formData.get('sku') as string;
    const priceRetail = parseFloat(formData.get('priceRetail') as string);
    const stock = parseInt(formData.get('stock') as string) || 0;
    const priceWholesale = parseFloat(formData.get('priceWholesale') as string) || null;
    const wholesaleMinQty = parseInt(formData.get('wholesaleMinQty') as string) || 0;
    const minStockAlert = parseInt(formData.get('minStockAlert') as string) || 5;

    // Jika SKU kosong, sistem otomatis membuat (generate) SKU unik
    if (!sku || sku.trim() === '') {
      sku = `PRD-${Date.now().toString().slice(-6)}`;
    }

    // Validasi data wajib
    if (!name || isNaN(priceRetail)) {
      return { success: false, error: 'Nama dan Harga Ecer wajib diisi dengan benar.' };
    }

    // Cek apakah SKU sudah ada (karena field SKU itu @unique di database)
    const existingProduct = await prisma.product.findUnique({
      where: { sku }
    });

    if (existingProduct) {
      return { success: false, error: 'Gagal: SKU/Barcode ini sudah terdaftar di sistem.' };
    }

    // Simpan ke SQLite dan masukkan ke SyncQueue secara atomik
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          sku,
          priceRetail,
          stock,
          priceWholesale,
          wholesaleMinQty,
          minStockAlert
        }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Product',
          recordId: product.id,
          operation: 'INSERT',
          payload: JSON.stringify(product),
          status: 'PENDING'
        }
      });
    });

    // Refresh halaman produk secara instan
    revalidatePath('/produk');
    return { success: true };

  } catch (error) {
    console.error('Error saat menambah produk:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menyimpan ke database.' };
  }
}

export async function restockProduct(id: string, additionalStock: number) {
  try {
    if (additionalStock <= 0) {
      return { success: false, error: 'Jumlah stok tambahan harus lebih dari 0.' };
    }

    await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { stock: { increment: additionalStock } }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Product',
          recordId: id,
          operation: 'UPDATE',
          payload: JSON.stringify(updatedProduct),
          status: 'PENDING'
        }
      });
    });

    revalidatePath('/produk');
    return { success: true };
  } catch (error) {
    console.error('Error saat restock produk:', error);
    return { success: false, error: 'Gagal memperbarui stok di database.' };
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.delete({
        where: { id }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Product',
          recordId: id,
          operation: 'DELETE',
          payload: JSON.stringify({ id }),
          status: 'PENDING'
        }
      });
    });
    revalidatePath('/produk');
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2003') {
      return { success: false, error: 'Produk tidak bisa dihapus karena sudah tercatat dalam riwayat transaksi. Silakan ubah stok menjadi 0.' };
    }
    console.error('Error saat menghapus produk:', error);
    return { success: false, error: 'Gagal menghapus produk dari database.' };
  }
}
export async function importProductsCSV(csvData: string) {
  try {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) return { success: false, error: 'File CSV kosong atau tidak memiliki data.' };

    let successCount = 0;
    
    await prisma.$transaction(async (tx) => {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Parse basic CSV handling commas inside quotes
        const rawCols: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          if (line[j] === '"') {
            inQuotes = !inQuotes;
          } else if (line[j] === ',' && !inQuotes) {
            rawCols.push(cur);
            cur = '';
          } else {
            cur += line[j];
          }
        }
        rawCols.push(cur);

        const getCol = (idx: number) => {
          let val = rawCols[idx] || '';
          return val.trim();
        };

        const sku = getCol(0);
        const name = getCol(1);
        const priceRetail = parseFloat(getCol(2)) || 0;
        const priceWholesaleStr = getCol(3);
        const wholesaleMinQtyStr = getCol(4);
        const priceWholesale = priceWholesaleStr ? parseFloat(priceWholesaleStr) : null;
        const wholesaleMinQty = wholesaleMinQtyStr ? parseInt(wholesaleMinQtyStr) : null;
        const addedStock = parseInt(getCol(5)) || 0;
        const minStockAlertStr = getCol(6);
        const minStockAlert = minStockAlertStr ? parseInt(minStockAlertStr) : 5;

        if (!sku || !name || priceRetail <= 0) continue; // skip invalid rows

        const existing = await tx.product.findUnique({ where: { sku } });

        let finalProduct;
        if (existing) {
          finalProduct = await tx.product.update({
            where: { id: existing.id },
            data: {
              name,
              priceRetail,
              priceWholesale,
              wholesaleMinQty,
              stock: { increment: addedStock },
              minStockAlert
            }
          });
          
          await tx.syncQueue.create({
            data: {
              tableName: 'Product',
              recordId: existing.id,
              operation: 'UPDATE',
              payload: JSON.stringify(finalProduct),
              status: 'PENDING'
            }
          });
        } else {
          finalProduct = await tx.product.create({
            data: {
              sku,
              name,
              priceRetail,
              priceWholesale,
              wholesaleMinQty,
              stock: Math.max(0, addedStock),
              minStockAlert
            }
          });
          
          await tx.syncQueue.create({
            data: {
              tableName: 'Product',
              recordId: finalProduct.id,
              operation: 'INSERT',
              payload: JSON.stringify(finalProduct),
              status: 'PENDING'
            }
          });
        }
        successCount++;
      }
    });

    revalidatePath('/produk');
    return { success: true, count: successCount };
  } catch (error: any) {
    console.error('Error saat import CSV:', error);
    return { success: false, error: 'Gagal melakukan import data: ' + error.message };
  }
}
