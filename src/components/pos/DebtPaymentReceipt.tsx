import React from 'react';

interface DebtPaymentReceiptProps {
  payment: any; // data dari debt payment
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

export function DebtPaymentReceipt({ payment, storeConfig, className = '' }: DebtPaymentReceiptProps) {
  const dateStr = payment.paidAt 
    ? new Date(payment.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateFull = payment.paidAt 
    ? new Date(payment.paidAt).toLocaleDateString('id-ID')
    : new Date().toLocaleDateString('id-ID');

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
      
      <div className="text-center font-bold mb-2">TANDA TERIMA CICILAN</div>
      
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Kasir: {payment.kasirId || 'Admin'}</span>
        <span>{dateFull} {dateStr}</span>
      </div>
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>No. Trx Utang:</span>
        <span className="text-right">{payment.debt?.transaction?.receiptNumber}</span>
      </div>
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="flex justify-between mb-1 w-full font-bold">
        <span>Terima Dari:</span>
        <span className="text-right">{payment.debt?.debtorName}</span>
      </div>
      
      <div className="flex justify-between mb-1 w-full mt-2">
        <span>Nominal Pembayaran:</span>
        <span className="font-bold">{formatRp(payment.amount)}</span>
      </div>
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Total Utang Awal:</span>
        <span>{formatRp(payment.debt?.totalAmount)}</span>
      </div>
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Sisa Utang Terkini:</span>
        <span className="font-bold">{formatRp(payment.debt?.remaining)}</span>
      </div>
      
      <div className="mt-2 text-center text-xs font-bold w-full">
        {payment.debt?.remaining <= 0 ? 'STATUS: LUNAS' : 'STATUS: BELUM LUNAS'}
      </div>

      <div className="border-dashed-thermal my-2 w-full"></div>
      <div className="text-center mt-2 mb-2 whitespace-pre-wrap break-words italic text-xs w-full">
        {storeConfig.footer}
      </div>
    </div>
  );
}
