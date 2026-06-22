import React from 'react';

interface DebtPaymentReceiptProps {
  debt: any; // data dari debt yang lengkap dengan payments
  storeConfig: {
    name: string;
    address: string;
    phone: string;
    city?: string;
    logoUrl?: string;
    footer: string;
  };
  className?: string;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

export function DebtPaymentReceipt({ debt, storeConfig, className = '' }: DebtPaymentReceiptProps) {
  const dateFull = new Date().toLocaleDateString('id-ID');
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`thermal-receipt w-full text-[12px] leading-tight flex flex-col items-center ${className}`}>
      <div className="text-center mb-2 w-full">
        {storeConfig.logoUrl && (
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={storeConfig.logoUrl} alt="Logo" className="h-8 object-contain mix-blend-multiply grayscale" />
          </div>
        )}
        <div className="font-bold text-[16px] mb-1">{storeConfig.name.toUpperCase()}</div>
        <div className="break-words">{storeConfig.address}</div>
        {storeConfig.city && <div>{storeConfig.city}</div>}
        <div>Telp: {storeConfig.phone}</div>
      </div>
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="text-center font-bold mb-2">BUKTI PELUNASAN UTANG</div>
      
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Tanggal Cetak:</span>
        <span>{dateFull} {timeStr}</span>
      </div>
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>No. Trx Utang:</span>
        <span className="text-right">{debt?.transaction?.receiptNumber}</span>
      </div>
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="flex justify-between mb-1 w-full font-bold">
        <span>Pelanggan:</span>
        <span className="text-right">{debt?.debtorName}</span>
      </div>
      
      <div className="flex justify-between mb-1 w-full mt-2">
        <span>Total Utang Awal:</span>
        <span className="font-bold">{formatRp(debt?.totalAmount)}</span>
      </div>
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="w-full text-left font-bold mb-1">Riwayat Pembayaran:</div>
      {debt?.payments?.map((p: any, idx: number) => (
        <div key={p.id || idx} className="flex flex-col w-full text-xs mb-1">
          <div className="flex justify-between">
            <span>{new Date(p.paidAt).toLocaleDateString('id-ID')} (Oleh: {p.kasirId})</span>
            <span>{formatRp(p.amount)}</span>
          </div>
        </div>
      ))}

      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Total Dibayar:</span>
        <span>{formatRp(debt?.paidAmount)}</span>
      </div>
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Sisa Utang Terkini:</span>
        <span className="font-bold">{formatRp(debt?.remaining)}</span>
      </div>
      
      <div className="mt-2 text-center text-xs font-bold w-full">
        {debt?.remaining <= 0 ? 'STATUS: LUNAS' : 'STATUS: BELUM LUNAS'}
      </div>

      <div className="border-dashed-thermal my-2 w-full"></div>
      <div className="text-center mt-2 mb-2 whitespace-pre-wrap break-words italic text-xs w-full">
        {storeConfig.footer}
      </div>
    </div>
  );
}
