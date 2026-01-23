interface GridPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function GridPagination({ currentPage, totalPages, onPageChange }: GridPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          transition-colors
          ${currentPage === 0
            ? 'text-text-tertiary/30 cursor-not-allowed'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`
              min-w-[32px] h-8 px-2 rounded-lg text-body font-medium
              transition-all duration-fast ease-standard
              ${currentPage === page
                ? 'bg-interactive/20 text-interactive'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }
            `}
          >
            {page + 1}
          </button>
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          transition-colors
          ${currentPage === totalPages - 1
            ? 'text-text-tertiary/30 cursor-not-allowed'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
