import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const shiftStr = searchParams.get('shift');

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
        createdAt: { gte: currentStart, lt: currentEnd },
        ...(shiftStr ? { shiftId: shiftStr } : {})
      },
      select: {
        createdAt: true,
        receiptNumber: true,
        cashierName: true,
        paymentMethod: true,
        totalAmount: true,
        isVoid: true,
        member: { select: { name: true } },
        details: {
          select: {
            quantity: true,
            priceAtTime: true,
            product: { select: { name: true } }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map to array of objects untuk xlsx
    const data = transactions.map(tx => {
      const date = new Date(tx.createdAt);
      return {
        'No. Resi': tx.receiptNumber,
        'Tanggal': date.toISOString().split('T')[0],
        'Jam': date.toTimeString().split(' ')[0],
        'Kasir': tx.cashierName,
        'Member': tx.member ? tx.member.name : '-',
        'Metode Pembayaran': tx.paymentMethod.toUpperCase(),
        'Total Amount': tx.totalAmount,
        'Status': tx.isVoid ? 'VOID' : 'BERHASIL',
        'Item Detail': tx.details.map(d => `${d.quantity}x ${d.product.name} (@${d.priceAtTime})`).join('; ')
      };
    });

    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: currentStart, lt: currentEnd },
        isVoid: false,
        ...(shiftStr ? { shiftId: shiftStr } : {})
      },
      select: {
        date: true,
        category: true,
        amount: true,
        notes: true,
        employee: { select: { name: true } }
      },
      orderBy: {
        date: 'desc'
      }
    });

    const expenseData = expenses.map(exp => {
      const date = new Date(exp.date);
      return {
        'Tanggal': date.toISOString().split('T')[0],
        'Jam': date.toTimeString().split(' ')[0],
        'Kategori': exp.category,
        'Nominal': exp.amount,
        'Keterangan': exp.notes || '-',
        'Kasir / PIC': exp.employee.name
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const expenseWorksheet = XLSX.utils.json_to_sheet(expenseData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');
    XLSX.utils.book_append_sheet(workbook, expenseWorksheet, 'Pengeluaran');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan_Penjualan_${startStr || 'hari_ini'}.xlsx"`,
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: 'Gagal melakukan ekspor data' }, { status: 500 });
  }
}
