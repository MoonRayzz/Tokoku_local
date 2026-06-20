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

    // Simpan ke SQLite
    await prisma.member.create({
      data: {
        name,
        phone,
      }
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
    await prisma.member.delete({
      where: { id }
    });
    revalidatePath('/member');
    return { success: true };
  } catch (error) {
    console.error('Error saat menghapus member:', error);
    return { success: false, error: 'Gagal menghapus member. Pastikan member ini tidak terikat dengan riwayat transaksi.' };
  }
}