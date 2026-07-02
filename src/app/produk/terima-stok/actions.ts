'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function createPurchaseOrder(data: {
  supplierName: string;
  notes: string;
  items: { productId: string; quantity: number; priceBuy: number; subtotal: number }[];
  totalAmount: number;
}) {
  try {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Minimal harus ada 1 produk untuk PO.' };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Cari atau buat supplier jika nama diisi
      let supplierId = null;
      if (data.supplierName && data.supplierName.trim() !== '') {
        const existingSupplier = await tx.supplier.findFirst({
          where: { name: { equals: data.supplierName.trim() } } // simplified check
        });

        if (existingSupplier) {
          supplierId = existingSupplier.id;
        } else {
          const newSupplier = await tx.supplier.create({
            data: {
              name: data.supplierName.trim(),
            }
          });
          supplierId = newSupplier.id;

          // [FIX B2] Queue Supplier baru ke cloud
          await tx.syncQueue.create({
            data: {
              tableName: 'Supplier',
              recordId: newSupplier.id,
              operation: 'INSERT',
              payload: JSON.stringify(newSupplier),
              status: 'PENDING'
            }
          });
        }
      }

      // 2. Buat PurchaseOrder beserta PoItem
      const po = await tx.purchaseOrder.create({
        data: {
          supplierId,
          totalAmount: data.totalAmount,
          notes: data.notes,
          syncStatus: 'PENDING',
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceBuy: item.priceBuy,
              subtotal: item.subtotal
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Queue PO to cloud
      await tx.syncQueue.create({
        data: {
          tableName: 'PurchaseOrder',
          recordId: po.id,
          operation: 'INSERT',
          payload: JSON.stringify(po),
          status: 'PENDING'
        }
      });

      // 3. Update stok produk dan catat StockLog IN
      for (const item of data.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }});
        if (!product) continue;

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            priceBuy: item.priceBuy // update harga modal (HPP) terakhir
          }
        });

        const stockLog = await tx.stockLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            amount: item.quantity,
            stockBefore: product.stock,
            stockAfter: updatedProduct.stock,
            notes: `Terima stok PO. ${data.supplierName ? 'Supplier: ' + data.supplierName : ''}`,
            referenceId: po.id,
            employeeId: 'Admin',
            syncStatus: 'PENDING'
          }
        });

        // Queue Product Update
        await tx.syncQueue.create({
          data: {
            tableName: 'Product',
            recordId: updatedProduct.id,
            operation: 'UPDATE',
            payload: JSON.stringify(updatedProduct),
            status: 'PENDING'
          }
        });

        // Queue StockLog
        await tx.syncQueue.create({
          data: {
            tableName: 'StockLog',
            recordId: stockLog.id,
            operation: 'INSERT',
            payload: JSON.stringify(stockLog),
            status: 'PENDING'
          }
        });
      }
    });

    revalidatePath('/produk');
    revalidatePath('/produk/terima-stok');

    return { success: true };
  } catch (error) {
    console.error('Error createPurchaseOrder:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menyimpan PO.' };
  }
}
