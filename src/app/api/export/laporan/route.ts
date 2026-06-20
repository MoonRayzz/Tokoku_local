import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');

    let currentStart = new Date();
    currentStart.setHours(0, 0, 0, 0);

    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 1);

    if (startStr) {
      const parsedStart = new Date(startStr);
      if (!isNaN(parsedStart.getTime())) {
        currentStart = parsedStart;
        currentStart.setHours(0, 0, 0, 0);
        
        currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + 1);
      }
    }

    if (endStr) {
      const parsedEnd = new Date(endStr);
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        currentEnd = new Date(parsedEnd.getTime() + 1);
      }
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: currentStart, lt: currentEnd }
      },
      include: {
        member: true,
        details: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Buat Header CSV
    const headers = [
      'No. Resi',
      'Tanggal',
      'Jam',
      'Member',
      'Metode Pembayaran',
      'Total Amount',
      'Status',
      'Item Detail'
    ];

    const rows = transactions.map(tx => {
      const date = new Date(tx.createdAt);
      const tanggal = date.toISOString().split('T')[0];
      const jam = date.toTimeString().split(' ')[0];
      const memberName = tx.member ? tx.member.name : '-';
      const status = tx.isVoid ? 'VOID' : 'BERHASIL';
      
      const itemDetail = tx.details.map(d => {
        return `${d.quantity}x ${d.product.name} (@${d.priceAtTime})`;
      }).join('; ');

      return [
        tx.receiptNumber,
        tanggal,
        jam,
        memberName,
        tx.paymentMethod.toUpperCase(),
        tx.totalAmount,
        status,
        `"${itemDetail}"` // Quote to prevent issues with commas inside the string
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Laporan_Penjualan_${startStr || 'hari_ini'}.csv"`,
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: 'Gagal melakukan ekspor data' }, { status: 500 });
  }
}
