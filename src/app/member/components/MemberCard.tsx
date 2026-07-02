import React from 'react';
import Barcode from 'react-barcode';

export interface MemberCardProps {
  memberId: string;
  name: string;
  phone: string;
  tierName: string;
  storeName: string;
  logoUrl?: string | null;
  tierColorClass?: string;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  memberId,
  name,
  phone,
  tierName,
  storeName,
  logoUrl,
  tierColorClass = 'bg-primary-container text-on-primary-container'
}) => {
  return (
    <div className="relative w-[340px] h-[215px] rounded-2xl overflow-hidden shadow-lg border border-border bg-gradient-to-br from-surface to-surface-container-high flex flex-col p-5 font-sans break-inside-avoid">
      {/* Background Decor */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-secondary/10 rounded-full blur-2xl"></div>

      {/* Header: Store Info & Tier */}
      <div className="flex justify-between items-start z-10">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
            </div>
          )}
          <span className="font-bold text-text-primary text-sm tracking-tight">{storeName}</span>
        </div>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${tierColorClass}`}>
          {tierName}
        </div>
      </div>

      {/* Body: Member Name */}
      <div className="mt-5 mb-auto z-10 flex flex-col">
        <span className="text-[10px] text-text-secondary uppercase tracking-widest mb-0.5">Member Name</span>
        <h2 className="text-xl font-bold text-text-primary leading-tight truncate">{name}</h2>
      </div>

      {/* Footer: Barcode */}
      <div className="mt-3 bg-white p-2 rounded-xl flex items-center justify-center z-10 shadow-inner">
        <div className="scale-[0.85] origin-center -my-2">
          <Barcode 
            value={phone} 
            format="CODE128" 
            height={40} 
            width={1.8} 
            displayValue={true}
            fontSize={14}
            margin={0}
            background="transparent"
          />
        </div>
      </div>
    </div>
  );
};
