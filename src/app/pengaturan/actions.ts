  // src/app/pengaturan/actions.ts
'use server'

import prisma from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function syncToCloud() {
  try {
    // Memeriksa ketersediaan konfigurasi Supabase
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return { success: false, error: 'Kredensial Supabase belum diatur di file .env' };
    }

    // Mengambil maksimal 50 antrean (PENDING atau FAILED yang retry-nya < 3)
    const pendingItems = await prisma.syncQueue.findMany({
      where: { 
        status: { in: ['PENDING', 'FAILED'] },
        retryCount: { lt: 3 }
      },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    // Eksekusi PULL SYNC & HEARTBEAT secara konstan, meskipun tidak ada antrean push
    await pullUpdatesFromCloud();
    await sendHeartbeat();

    if (pendingItems.length === 0) {
      return { success: true, message: 'Semua data sudah tersinkronisasi dengan Cloud.' };
    }

    let syncedCount = 0;

    for (const item of pendingItems) {
      const payload = JSON.parse(item.payload);
      let syncError = null;

      try {
        if (item.tableName === 'Transaction') {
          // Pisahkan relasi nested — Supabase tidak menerima nested insert
          const { details, member, ...mainTx } = payload;

          // Ganti nilai null menjadi 0/string kosong untuk payment fields yang tidak support null di Supabase lama
          const txPayload = { 
            ...mainTx, 
            memberId: mainTx.memberId,
            cashReceived: mainTx.cashReceived ?? 0,
            change: mainTx.change ?? 0,
            approvalCode: mainTx.approvalCode ?? ''
          };

          // 1. Push Header Transaksi
          console.log('Sending txPayload to Supabase:', txPayload);
          const { error: txError } = await supabase.from('Transaction').upsert(txPayload);
          if (txError) throw txError;

          // 2. Push Detail Barang Transaksi
          if (details && Array.isArray(details) && details.length > 0) {
            // Bersihkan field relasi nested (product obj) yang tidak ada di kolom Supabase
            const detailPayload = details.map(({ product, ...d }: any) => d);
            const { error: detailsError } = await supabase.from('TransactionDetail').upsert(detailPayload);
            if (detailsError) throw detailsError;
          }
        } else if (item.tableName === 'PurchaseOrder') {
          // Pisahkan relasi items
          const { items, supplier, ...mainPo } = payload;
          
          const { error: poError } = await supabase.from('PurchaseOrder').upsert(mainPo);
          if (poError) throw poError;

          if (items && Array.isArray(items) && items.length > 0) {
            const itemsPayload = items.map(({ product, purchaseOrder, ...d }: any) => d);
            const { error: itemsError } = await supabase.from('PoItem').upsert(itemsPayload);
            if (itemsError) throw itemsError;
          }
        } else {
          // Fallback untuk tabel lain (misal jika nanti Anda menambahkan sync Produk/Member)
          if (item.operation === 'DELETE') {
            const { error } = await supabase.from(item.tableName).delete().eq('id', payload.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from(item.tableName).upsert(payload);
            if (error) throw error;
          }
        }

        // Jika berhasil push ke Supabase, update status di SQLite lokal menjadi SYNCED
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: 'SYNCED', errorMessage: null }
        });
        
        // Update status sinkronisasi pada tabel aslinya jika bukan operasi DELETE
        if (item.operation !== 'DELETE') {
          try {
            await prisma.$executeRawUnsafe(`UPDATE "${item.tableName}" SET "syncStatus" = 'SYNCED' WHERE id = ?`, item.recordId);
          } catch (e) {
            console.error('Failed to update source table sync status:', e);
          }
        }
        
        syncedCount++;

      } catch (error: any) {
        console.error(`Gagal sync item ${item.id}:`, error);
        syncError = error;
        
        const newRetryCount = item.retryCount + 1;
        const newStatus = newRetryCount >= 3 ? 'FAILED_PERMANENT' : 'FAILED';
        
        // Catat pesan error dari Supabase ke SQLite lokal, tambah retryCount
        await prisma.syncQueue.update({
          where: { id: item.id },
          data: { 
            status: newStatus,
            errorMessage: error.message || String(error) || 'Unknown error',
            retryCount: newRetryCount
          }
        });
      }
    }

    // Refresh semua layout yang memiliki indikator antrean
    revalidatePath('/', 'layout');
    
    if (syncedCount === pendingItems.length) {
      return { success: true, message: `Sukses! ${syncedCount} item berhasil disinkronkan.` };
    } else {
      return { success: false, error: `Hanya berhasil ${syncedCount} dari ${pendingItems.length}. Cek koneksi internet.` };
    }

  } catch (error) {
    console.error('Fatal Sync Error:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menjalankan sinkronisasi.' };
  }
}

export async function pullUpdatesFromCloud() {
  try {
    // 1. Pull Products
    const latestLocalProduct = await prisma.product.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    const lastUpdatedAt = latestLocalProduct ? latestLocalProduct.updatedAt.toISOString() : new Date(0).toISOString();

    const { data: updatedProducts, error } = await supabase
      .from('Product')
      .select('*')
      .gt('updatedAt', lastUpdatedAt);

    if (error) throw error;

    if (updatedProducts && updatedProducts.length > 0) {
      for (const product of updatedProducts) {
        await prisma.product.upsert({
          where: { id: product.id },
          update: {
            sku: product.sku,
            barcode: product.barcode || null,
            name: product.name,
            priceBuy: product.priceBuy,
            priceRetail: product.priceRetail,
            priceWholesale: product.priceWholesale,
            wholesaleMinQty: product.wholesaleMinQty,
            minStockAlert: product.minStockAlert,
            updatedAt: new Date(product.updatedAt)
          },
          create: {
            id: product.id,
            sku: product.sku,
            barcode: product.barcode || null,
            name: product.name,
            priceBuy: product.priceBuy,
            priceRetail: product.priceRetail,
            priceWholesale: product.priceWholesale,
            wholesaleMinQty: product.wholesaleMinQty,
            stock: product.stock,
            minStockAlert: product.minStockAlert,
            createdAt: new Date(product.createdAt),
            updatedAt: new Date(product.updatedAt)
          }
        });
      }
      console.log(`Berhasil pull ${updatedProducts.length} produk dari Cloud.`);
      revalidatePath('/produk');
    }

    // 1.5 Pull Members
    const latestLocalMember = await prisma.member.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    const lastMemberUpdatedAt = latestLocalMember ? latestLocalMember.updatedAt.toISOString() : new Date(0).toISOString();

    const { data: updatedMembers, error: memberError } = await supabase
      .from('Member')
      .select('*')
      .gt('updatedAt', lastMemberUpdatedAt);

    if (memberError) throw memberError;

    if (updatedMembers && updatedMembers.length > 0) {
      for (const member of updatedMembers) {
        await prisma.member.upsert({
          where: { id: member.id },
          update: {
            name: member.name,
            phone: member.phone,
            isVoid: member.isVoid,
            updatedAt: new Date(member.updatedAt)
          },
          create: {
            id: member.id,
            name: member.name,
            phone: member.phone,
            isVoid: member.isVoid,
            joinedAt: new Date(member.joinedAt),
            updatedAt: new Date(member.updatedAt)
          }
        });
      }
      console.log(`Berhasil pull ${updatedMembers.length} member dari Cloud.`);
      revalidatePath('/member');
    }

    // 1.6 Pull MemberTiers (Full sync)
    const { data: remoteTiers, error: tierError } = await supabase.from('MemberTier').select('*');
    if (tierError) throw tierError;
    if (remoteTiers) {
      // Hapus tier lokal yang sudah dihapus di Owner/Cloud
      const remoteTierIds = remoteTiers.map((t: any) => t.id);
      await prisma.memberTier.deleteMany({
        where: { id: { notIn: remoteTierIds } }
      });

      for (const tier of remoteTiers) {
        await prisma.memberTier.upsert({
          where: { id: tier.id },
          update: {
            name: tier.name,
            minTransactions: tier.minTransactions,
            minTotalSpent: tier.minTotalSpent,
            minOrderAmount: tier.minOrderAmount,
            discountPercentage: tier.discountPercentage,
            maxDiscountAmount: tier.maxDiscountAmount,
            updatedAt: new Date(tier.updatedAt)
          },
          create: {
            id: tier.id,
            name: tier.name,
            minTransactions: tier.minTransactions,
            minTotalSpent: tier.minTotalSpent,
            minOrderAmount: tier.minOrderAmount,
            discountPercentage: tier.discountPercentage,
            maxDiscountAmount: tier.maxDiscountAmount,
            createdAt: new Date(tier.createdAt),
            updatedAt: new Date(tier.updatedAt)
          }
        });
      }
    }

    // 2. Pull StoreProfile
    const { data: remoteProfile, error: profileError } = await supabase
      .from('StoreProfile')
      .select('*')
      .eq('id', 'local-store')
      .single();

    if (!profileError && remoteProfile) {
      const localProfile = await prisma.storeProfile.findUnique({ where: { id: 'local-store' }});
      
      // Jika remote lebih baru atau lokal belum ada
      const remoteDateStr = remoteProfile.updatedAt + (remoteProfile.updatedAt.endsWith('Z') ? '' : 'Z');
      if (!localProfile || new Date(remoteDateStr) > localProfile.updatedAt) {
        await prisma.storeProfile.upsert({
          where: { id: 'local-store' },
          update: {
            name: remoteProfile.name,
            address: remoteProfile.address,
            phone: remoteProfile.phone,
            city: remoteProfile.city,
            footer: remoteProfile.footer,
            logoUrl: remoteProfile.logoUrl,
            debtEnabled: remoteProfile.debtEnabled,
            debtLimitPerPerson: remoteProfile.debtLimitPerPerson,
            debtLimitBehavior: remoteProfile.debtLimitBehavior,
            updatedAt: new Date(remoteDateStr)
          },
          create: {
            id: 'local-store',
            name: remoteProfile.name,
            address: remoteProfile.address,
            phone: remoteProfile.phone,
            city: remoteProfile.city,
            footer: remoteProfile.footer,
            logoUrl: remoteProfile.logoUrl,
            debtEnabled: remoteProfile.debtEnabled,
            debtLimitPerPerson: remoteProfile.debtLimitPerPerson,
            debtLimitBehavior: remoteProfile.debtLimitBehavior,
            updatedAt: new Date(remoteDateStr)
          }
        });
        console.log('Berhasil pull StoreProfile dari Cloud.');
        revalidatePath('/pengaturan');
      }
    }

    // 3. Pull Employee
    const latestLocalEmployee = await prisma.employee.findFirst({ orderBy: { updatedAt: 'desc' } });
    const lastEmployeeUpdatedAt = latestLocalEmployee ? latestLocalEmployee.updatedAt.toISOString() : new Date(0).toISOString();
    const { data: updatedEmployees, error: employeeError } = await supabase.from('Employee').select('*').gt('updatedAt', lastEmployeeUpdatedAt);
    if (!employeeError && updatedEmployees && updatedEmployees.length > 0) {
      for (const emp of updatedEmployees) {
        await prisma.employee.upsert({
          where: { id: emp.id },
          update: { name: emp.name, phone: emp.phone, role: emp.role, isActive: emp.isActive, wageBase: emp.wageBase, wageSolo: emp.wageSolo, updatedAt: new Date(emp.updatedAt) },
          create: { id: emp.id, name: emp.name, phone: emp.phone, role: emp.role, isActive: emp.isActive, wageBase: emp.wageBase, wageSolo: emp.wageSolo, createdAt: new Date(emp.createdAt), updatedAt: new Date(emp.updatedAt) }
        });
      }
      console.log(`Berhasil pull ${updatedEmployees.length} employee dari Cloud.`);
    }

    // 4. Pull Shift
    const { data: remoteShifts, error: shiftError } = await supabase.from('Shift').select('*');
    if (!shiftError && remoteShifts) {
      const remoteShiftIds = remoteShifts.map((s: any) => s.id);
      await prisma.shift.deleteMany({ where: { id: { notIn: remoteShiftIds } } });
      for (const shift of remoteShifts) {
        await prisma.shift.upsert({
          where: { id: shift.id },
          update: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime, isActive: shift.isActive },
          create: { id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, isActive: shift.isActive, createdAt: new Date(shift.createdAt) }
        });
      }
      console.log(`Berhasil pull ${remoteShifts.length} shift dari Cloud.`);
    }

    // 5. Pull SalaryPayout
    const { data: remotePayouts, error: payoutError } = await supabase.from('SalaryPayout').select('*');
    if (!payoutError && remotePayouts) {
      for (const p of remotePayouts) {
        await prisma.salaryPayout.upsert({
          where: { id: p.id },
          update: { amount: p.amount, month: p.month, year: p.year, notes: p.notes, paidAt: new Date(p.paidAt) },
          create: { id: p.id, employeeId: p.employeeId, amount: p.amount, month: p.month, year: p.year, notes: p.notes, paidAt: new Date(p.paidAt) }
        });
      }
      console.log(`Berhasil pull ${remotePayouts.length} salary payout dari Cloud.`);
    }

    // 6. Pull Attendance (Today only to keep local DB light, or just all that changed recently)
    // Actually we just need recent ones for cashier check. Pull all that updated recently.
    const latestLocalAttendance = await prisma.attendance.findFirst({ orderBy: { createdAt: 'desc' } });
    const lastAttendanceCreatedAt = latestLocalAttendance ? latestLocalAttendance.createdAt.toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days fallback
    
    // For attendance, it doesn't have updatedAt currently. It has createdAt. 
    // And checkOut updates it... wait! Does Attendance have updatedAt?
    // Let's check schema. Attendance has no updatedAt? No, it doesn't have updatedAt in SQLite schema!
    // Fix Timezone Bug: UTC midnight is yesterday in +08:00, so we pull from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const { data: todayAttendances, error: attError } = await supabase.from('Attendance').select('*').gte('date', yesterdayStr);
    if (!attError && todayAttendances) {
      for (const att of todayAttendances) {
        await prisma.attendance.upsert({
          where: { id: att.id },
          update: { checkIn: att.checkIn ? new Date(att.checkIn) : null, checkOut: att.checkOut ? new Date(att.checkOut) : null, shiftId: att.shiftId, notes: att.notes, hoursWorked: att.hoursWorked, wageUsed: att.wageUsed, totalWage: att.totalWage, isSolo: att.isSolo, isPaid: att.isPaid || false, salaryPayoutId: att.salaryPayoutId || null },
          create: { id: att.id, employeeId: att.employeeId, shiftId: att.shiftId, date: new Date(att.date), checkIn: att.checkIn ? new Date(att.checkIn) : null, checkOut: att.checkOut ? new Date(att.checkOut) : null, notes: att.notes, hoursWorked: att.hoursWorked, wageUsed: att.wageUsed, totalWage: att.totalWage, isSolo: att.isSolo, isPaid: att.isPaid || false, salaryPayoutId: att.salaryPayoutId || null, createdAt: new Date(att.createdAt) }
        });
      }
      console.log(`Berhasil pull ${todayAttendances.length} attendance hari ini dari Cloud.`);
    }
    // 7. Pull Expenses (Untuk Sinkronisasi Pembatalan/isVoid & Penambahan dari Owner)
    const latestLocalExpense = await prisma.expense.findFirst({ orderBy: { updatedAt: 'desc' } });
    const lastExpenseUpdatedAt = latestLocalExpense ? latestLocalExpense.updatedAt.toISOString() : new Date(0).toISOString();

    const { data: updatedExpenses, error: expError } = await supabase
      .from('Expense')
      .select('*')
      .gt('updatedAt', lastExpenseUpdatedAt);

    if (!expError && updatedExpenses && updatedExpenses.length > 0) {
      for (const e of updatedExpenses) {
        await prisma.expense.upsert({
          where: { id: e.id },
          update: { 
            date: new Date(e.date), category: e.category, amount: e.amount, notes: e.notes,
            employeeId: e.employeeId, shiftId: e.shiftId, syncStatus: 'SYNCED', isVoid: e.isVoid,
            createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt)
          },
          create: { 
            id: e.id, date: new Date(e.date), category: e.category, amount: e.amount, notes: e.notes,
            employeeId: e.employeeId, shiftId: e.shiftId, syncStatus: 'SYNCED', isVoid: e.isVoid,
            createdAt: new Date(e.createdAt), updatedAt: new Date(e.updatedAt)
          }
        });
      }
      console.log(`Berhasil pull ${updatedExpenses.length} expense dari Cloud.`);
    }

    // [FIX W4] 8. Pull Supplier (Full sync — master bisa dari Owner)
    const { data: remoteSuppliers, error: supplierError } = await supabase.from('Supplier').select('*');
    if (!supplierError && remoteSuppliers) {
      for (const s of remoteSuppliers) {
        await prisma.supplier.upsert({
          where: { id: s.id },
          update: {
            name: s.name,
            phone: s.phone || null,
            address: s.address || null,
            notes: s.notes || null,
            updatedAt: new Date(s.updatedAt)
          },
          create: {
            id: s.id,
            name: s.name,
            phone: s.phone || null,
            address: s.address || null,
            notes: s.notes || null,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt)
          }
        });
      }
      console.log(`Berhasil pull ${remoteSuppliers.length} supplier dari Cloud.`);
    }

    // [FIX W3] 9. Pull Debt (Delta sync — untuk sinkronisasi perubahan/pembatalan dari Owner)
    const latestLocalDebt = await prisma.debt.findFirst({ orderBy: { updatedAt: 'desc' } });
    const lastDebtUpdatedAt = latestLocalDebt ? latestLocalDebt.updatedAt.toISOString() : new Date(0).toISOString();
    const { data: updatedDebts, error: debtError } = await supabase
      .from('Debt')
      .select('*')
      .gt('updatedAt', lastDebtUpdatedAt);
    if (!debtError && updatedDebts && updatedDebts.length > 0) {
      for (const d of updatedDebts) {
        // Cek apakah transaksi referensi sudah ada di lokal (syarat FK)
        const txExists = await prisma.transaction.findUnique({ where: { id: d.transactionId }, select: { id: true } });
        if (!txExists) continue; // Skip jika transaksi induk belum tersinkron

        await prisma.debt.upsert({
          where: { id: d.id },
          update: {
            debtorName: d.debtorName, debtorPhone: d.debtorPhone, debtorNotes: d.debtorNotes,
            totalAmount: d.totalAmount, paidAmount: d.paidAmount, remaining: d.remaining,
            status: d.status, syncStatus: 'SYNCED', updatedAt: new Date(d.updatedAt)
          },
          create: {
            id: d.id, transactionId: d.transactionId, debtorName: d.debtorName,
            debtorPhone: d.debtorPhone, debtorNotes: d.debtorNotes, memberId: d.memberId || null,
            totalAmount: d.totalAmount, paidAmount: d.paidAmount, remaining: d.remaining,
            status: d.status, kasirId: d.kasirId, isLimitOverride: d.isLimitOverride || false,
            syncStatus: 'SYNCED', createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt)
          }
        });
      }
      console.log(`Berhasil pull ${updatedDebts.length} debt dari Cloud.`);
      revalidatePath('/buku-utang');
    }

    revalidatePath('/');

  } catch (err) {
    console.error('Pull Sync Error:', err);
  }
}

export async function sendHeartbeat() {
  try {
    const { error } = await supabase
      .from('StoreStatus')
      .upsert({
        id: 'local-store',
        lastPing: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
    if (error) throw error;
  } catch (err) {
    console.error('Failed to send heartbeat:', err);
  }
}

export async function getStoreProfile() {
  const profile = await prisma.storeProfile.findUnique({
    where: { id: 'local-store' }
  });
  return profile;
}

export async function saveStoreProfile(data: any) {
  try {
    const profile = await prisma.storeProfile.upsert({
      where: { id: 'local-store' },
      update: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        city: data.city,
        footer: data.footer,
        logoUrl: data.logoUrl || null,
        debtEnabled: data.debtEnabled,
        debtLimitPerPerson: data.debtLimitPerPerson,
        debtLimitBehavior: data.debtLimitBehavior,
        updatedAt: new Date()
      },
      create: {
        id: 'local-store',
        name: data.name,
        address: data.address,
        phone: data.phone,
        city: data.city,
        footer: data.footer,
        logoUrl: data.logoUrl || null,
        debtEnabled: data.debtEnabled,
        debtLimitPerPerson: data.debtLimitPerPerson,
        debtLimitBehavior: data.debtLimitBehavior,
        updatedAt: new Date()
      }
    });

    // Tambahkan ke SyncQueue
    await prisma.syncQueue.create({
      data: {
        tableName: 'StoreProfile',
        recordId: 'local-store',
        operation: 'UPSERT',
        payload: JSON.stringify(profile)
      }
    });

    revalidatePath('/pengaturan');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save store profile:', err);
    return { success: false, error: err.message };
  }
}

export async function clearSyncQueue() {
  await prisma.syncQueue.deleteMany({
    where: { status: 'SYNCED' }
  });
  revalidatePath('/pengaturan');
  return { success: true };
}

export async function getPendingSyncCount() {
  const count = await prisma.syncQueue.count({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      retryCount: { lt: 3 }
    }
  });
  return count;
}

export async function getFailedSyncItems() {
  const items = await prisma.syncQueue.findMany({
    where: {
      status: 'FAILED_PERMANENT'
    },
    orderBy: { updatedAt: 'desc' }
  });
  return items;
}