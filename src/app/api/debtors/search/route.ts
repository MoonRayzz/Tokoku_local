import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      return NextResponse.json({ debtors: [] });
    }

    // Cari debtor berdasarkan nama yang mirip
    const debtors = await prisma.debt.groupBy({
      by: ['debtorName', 'debtorPhone'],
      where: {
        debtorName: {
          contains: q
        },
        status: {
          not: 'PAID'
        }
      },
      _sum: {
        remaining: true
      },
      orderBy: {
        debtorName: 'asc'
      },
      take: 5
    });

    const formatted = debtors.map(d => ({
      debtorName: d.debtorName,
      debtorPhone: d.debtorPhone,
      remaining: d._sum.remaining || 0
    }));

    return NextResponse.json({ debtors: formatted });
  } catch (error) {
    console.error('Debtor search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
