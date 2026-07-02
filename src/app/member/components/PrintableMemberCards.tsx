import React, { forwardRef } from 'react';
import { MemberCard, MemberCardProps } from './MemberCard';

interface PrintableMemberCardsProps {
  cards: MemberCardProps[];
}

export const PrintableMemberCards = forwardRef<HTMLDivElement, PrintableMemberCardsProps>(
  ({ cards }, ref) => {
    return (
      <div ref={ref} className="print-container bg-white">
        {/* Style khusus untuk cetak */}
        <style type="text/css" media="print">
          {`
            @page { size: auto; margin: 10mm; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background-color: white !important; }
            body * { visibility: visible !important; }
            
            .print-container { 
              padding: 10px; 
              background-color: white !important; 
              visibility: visible !important; 
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-container * { 
              visibility: visible !important; 
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .print-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px; 
              row-gap: 20px;
            }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          `}
        </style>
        
        <div className="print-grid">
          {cards.map((card) => (
            <div key={card.memberId} className="flex justify-center break-inside-avoid">
              <MemberCard {...card} />
            </div>
          ))}
        </div>
      </div>
    );
  }
);

PrintableMemberCards.displayName = 'PrintableMemberCards';
