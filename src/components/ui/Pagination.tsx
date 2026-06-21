'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationProps = {
  totalPages: number;
  totalItems: number;
  currentPage: number;
  pageSize: number;
};

export default function Pagination({ totalPages, totalItems, currentPage, pageSize }: PaginationProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  if (totalPages <= 1) return null;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center bg-surface p-4 border-t border-border gap-4">
      <div className="text-sm text-text-secondary font-medium">
        Menampilkan {totalItems > 0 ? startItem : 0} - {endItem} dari {totalItems} data
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={createPageURL(currentPage - 1)}
          className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
            currentPage <= 1
              ? 'border-border/50 text-text-secondary/50 pointer-events-none'
              : 'border-border text-text-primary hover:bg-surface-container'
          }`}
          aria-disabled={currentPage <= 1}
        >
          <ChevronLeft size={18} />
        </Link>

        <div className="flex items-center gap-1">
          {visiblePages.map((p, idx) => (
            <React.Fragment key={idx}>
              {p === '...' ? (
                <span className="px-3 py-2 text-text-secondary">...</span>
              ) : (
                <Link
                  href={createPageURL(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                    currentPage === p
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'border-border text-text-primary hover:bg-surface-container'
                  }`}
                >
                  {p}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>

        <Link
          href={createPageURL(currentPage + 1)}
          className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
            currentPage >= totalPages
              ? 'border-border/50 text-text-secondary/50 pointer-events-none'
              : 'border-border text-text-primary hover:bg-surface-container'
          }`}
          aria-disabled={currentPage >= totalPages}
        >
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}
