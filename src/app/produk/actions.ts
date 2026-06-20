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

    // Simpan ke SQLite
    await prisma.product.create({
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

    await prisma.product.update({
      where: { id },
      data: { stock: { increment: additionalStock } }
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
    await prisma.product.delete({
      where: { id }
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