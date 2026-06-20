import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const products = await prisma.product.findMany();
    for (const p of products) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Product',
          recordId: p.id,
          operation: 'INSERT',
          payload: JSON.stringify(p),
          status: 'PENDING'
        }
      });
    }

    const members = await prisma.member.findMany();
    for (const m of members) {
      await prisma.syncQueue.create({
        data: {
          tableName: 'Member',
          recordId: m.id,
          operation: 'INSERT',
          payload: JSON.stringify(m),
          status: 'PENDING'
        }
      });
    }

    await prisma.syncQueue.updateMany({
      where: { tableName: 'Transaction' },
      data: { status: 'PENDING' }
    });

    return NextResponse.json({ success: true, message: `Queued ${products.length} products and ${members.length} members for sync. Reset transactions.` });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}
