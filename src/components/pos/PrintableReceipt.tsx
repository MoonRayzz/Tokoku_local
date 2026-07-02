import React from 'react';
import type { CompletedTransaction, CartItem } from '@/hooks/usePayment';

interface PrintableReceiptProps {
  transaction: CompletedTransaction | any; // To support both PaymentSuccess and TransactionManager shapes
  items: { name: string; price: number; quantity: number; subtotal: number }[];
  storeConfig: {
    name: string;
    address: string;
    phone: string;
    city?: string;
    logoUrl?: string;
    footer: string;
    qrisProvider: string;
    edcBank: string;
  };
  className?: string;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);

export function PrintableReceipt({ transaction, items, storeConfig, className = '' }: PrintableReceiptProps) {
  const dateStr = transaction.createdAt 
    ? new Date(transaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`thermal-receipt w-full text-[12px] leading-tight flex flex-col items-center ${className}`}>
      <div className="text-center mb-2 w-full">
        {storeConfig.logoUrl && (
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={storeConfig.logoUrl} alt="Logo" className="h-8 object-contain mix-blend-multiply grayscale" />
          </div>
        )}
        <div className="font-bold text-[16px] mb-1">{storeConfig.name}</div>
        <div className="break-words">{storeConfig.address}</div>
        {storeConfig.city && <div>{storeConfig.city}</div>}
        <div>Telp: {storeConfig.phone}</div>
      </div>
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      <div className="flex justify-between mb-1 w-full text-xs">
        <span>Kasir: {transaction.cashierName || 'Admin'}</span>
        <span>{dateStr}</span>
      </div>
      {transaction.receiptNumber && (
        <div className="flex justify-between mb-1 w-full text-xs">
          <span>Nota:</span>
          <span>{transaction.receiptNumber}</span>
        </div>
      )}
      {transaction.memberName && (
        <div className="flex justify-between mb-1 w-full text-xs">
          <span>Member:</span>
          <span>{transaction.memberName}</span>
        </div>
      )}
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      {items.map((item, idx) => (
        <div key={idx} className="w-full mb-1">
          <div className="flex justify-between w-full">
            <span className="truncate pr-2">{item.name}</span>
            <span>{formatRp(item.subtotal)}</span>
          </div>
          {item.quantity > 1 && (
            <div className="text-[10px] text-gray-500">
              {item.quantity} x {formatRp(item.price)}
            </div>
          )}
        </div>
      ))}
      
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      {transaction.discountAmount ? (
        <>
          <div className="flex justify-between w-full">
            <span>Subtotal</span>
            <span>{formatRp(transaction.totalAmount + transaction.discountAmount)}</span>
          </div>
          <div className="flex justify-between w-full mt-1">
            <span>Diskon Member</span>
            <span>-{formatRp(transaction.discountAmount)}</span>
          </div>
          <div className="text-[9px] italic text-gray-500 w-full text-right mt-0.5">
            *Hanya berlaku untuk barang reguler
          </div>
        </>
      ) : null}

      <div className="flex justify-between font-bold text-[14px] w-full mt-1">
        <span>TOTAL</span>
        <span>{formatRp(transaction.totalAmount)}</span>
      </div>
      <div className="border-dashed-thermal my-2 w-full"></div>
      
      {/* Blok Metode Pembayaran */}
      <div className="w-full space-y-1">
        {transaction.paymentMethod === 'cash' && (
          <>
            <div className="flex justify-between w-full"><span>Metode Bayar</span><span>CASH</span></div>
            <div className="flex justify-between w-full"><span>Uang Diterima</span><span>{formatRp(transaction.cashReceived ?? 0)}</span></div>
            <div className="flex justify-between w-full"><span>Kembalian</span><span>{formatRp(transaction.change ?? 0)}</span></div>
          </>
        )}
        
        {transaction.paymentMethod === 'qris' && (
          <>
            <div className="flex justify-between w-full"><span>Metode Bayar</span><span>QRIS</span></div>
            {storeConfig.qrisProvider && (
              <div className="flex justify-between w-full"><span>Penyedia</span><span>{storeConfig.qrisProvider}</span></div>
            )}
            <div className="flex justify-between w-full"><span>Status</span><span>LUNAS</span></div>
          </>
        )}
        
        {transaction.paymentMethod === 'debit' && (
          <>
            <div className="flex justify-between w-full"><span>Metode Bayar</span><span>DEBIT / KARTU</span></div>
            {storeConfig.edcBank && (
              <div className="flex justify-between w-full"><span>Bank EDC</span><span>{storeConfig.edcBank}</span></div>
            )}
            {transaction.approvalCode && (
              <div className="flex justify-between w-full"><span>Kode Approval</span><span>{transaction.approvalCode}</span></div>
            )}
            <div className="flex justify-between w-full"><span>Status</span><span>LUNAS</span></div>
          </>
        )}

        {transaction.paymentMethod === 'utang' && (
          <>
            <div className="flex justify-between w-full font-bold"><span>Metode Bayar</span><span>UTANG / PIUTANG</span></div>
            <div className="flex justify-between w-full font-bold mt-1 border border-black px-1 py-0.5 text-center justify-center">
              <span>* BELUM LUNAS *</span>
            </div>
            {transaction.debtorName && (
              <div className="flex justify-between w-full mt-1"><span>Nama</span><span>{transaction.debtorName}</span></div>
            )}
          </>
        )}
      </div>

      <div className="border-dashed-thermal my-2 w-full"></div>
      <div className="text-center mt-2 mb-2 whitespace-pre-wrap break-words italic text-xs w-full">
        {storeConfig.footer}
      </div>
    </div>
  );
}
