import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) pages.push('...');

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages - 1) pages.push('...');

    pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-center gap-2 mt-8 p-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrev}
        className="h-10 w-10 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        title={t('Previous')}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex gap-1">
        {pages.map((page, idx) => (
          <button
            key={idx}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={`h-10 w-10 rounded-lg text-sm font-bold transition-all ${
              page === currentPage
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : page === '...'
                ? 'cursor-not-allowed text-muted-foreground'
                : 'border border-border bg-card hover:bg-muted text-foreground'
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNext}
        className="h-10 w-10 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        title={t('Next')}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="ms-auto text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {t('Page')} {currentPage} {t('of')} {totalPages}
      </div>
    </div>
  );
}
