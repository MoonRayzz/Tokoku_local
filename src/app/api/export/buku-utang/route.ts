import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const whereClause: any = {};

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.debtorName = { contains: search };
    }

    const debts = await prisma.debt.findMany({
      where: whereClause,
      include: {
        transaction: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const dataToExport = debts.map(d => {
      const kasirTerkait = d.payments.map(p => p.kasirId).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      
      return {
        'Tanggal': format(d.createdAt, 'yyyy-MM-dd HH:mm'),
        'Nama Pelanggan': d.debtorName,
        'No. HP': d.debtorPhone || '-',
        'No. Transaksi': d.transaction?.receiptNumber || '-',
        'Total Utang Awal': d.totalAmount,
        'Total Dibayar': d.paidAmount,
        'Sisa Utang': d.remaining,
        'Status': d.status === 'PAID' ? 'LUNAS' : d.status === 'PARTIAL' ? 'DICICIL' : 'BELUM LUNAS',
        'Kasir Penerima Cicilan': kasirTerkait,
        'Catatan': d.debtorNotes || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Buku Utang');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="Laporan_Buku_Utang_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    console.error('Error exporting buku utang:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
