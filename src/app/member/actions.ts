// src/app/member/actions.ts
'use server'

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function addMember(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;

    if (!name || !phone) {
      return { success: false, error: 'Nama dan Nomor HP (WhatsApp) wajib diisi.' };
    }

    // Cek apakah nomor HP sudah terdaftar
    const existingMember = await prisma.member.findUnique({
      where: { phone }
    });

    if (existingMember) {
      return { success: false, error: 'Gagal: Nomor HP ini sudah terdaftar sebagai member.' };
    }

    // Simpan ke SQLite dan masukkan ke SyncQueue secara atomik
    await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          name,
          phone,
        }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Member',
          recordId: member.id,
          operation: 'INSERT',
          payload: JSON.stringify(member),
          status: 'PENDING'
        }
      });
    });

    revalidatePath('/member');
    return { success: true };

  } catch (error) {
    console.error('Error saat menambah member:', error);
    return { success: false, error: 'Terjadi kesalahan sistem saat menyimpan ke database.' };
  }
}

export async function deleteMember(id: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const deletedMember = await tx.member.update({
        where: { id },
        data: { isVoid: true }
      });

      await tx.syncQueue.create({
        data: {
          tableName: 'Member',
          recordId: id,
          operation: 'UPDATE', // It's an update because we are soft-deleting
          payload: JSON.stringify(deletedMember),
          status: 'PENDING'
        }
      });
    });
    revalidatePath('/member');
    return { success: true };
  } catch (error) {
    console.error('Error saat menghapus member:', error);
    return { success: false, error: 'Gagal menghapus member. Pastikan member ini tidak terikat dengan riwayat transaksi.' };
  }
}