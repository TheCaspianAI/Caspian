import { useRef, useEffect } from 'react';

interface GridHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCount: number;
  onKillSelected: () => void;
  onClose: () => void;
}

export function GridHeader({
  searchQuery,
  onSearchChange,
  selectedCount,
  onKillSelected,
  onClose,
}: GridHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on "/" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]"
      style={{
        background: 'rgba(18, 18, 20, 0.60)',
        backdropFilter: 'blur(22px) saturate(110%)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {/* Left side - Back button + Search */}
      <div className="flex items-center gap-4">
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/[0.50] hover:text-white/[0.75] hover:bg-white/[0.04] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[12px] font-medium">Back</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/[0.08]" />

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/[0.35]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes..."
            className="w-60 h-8 pl-9 pr-8 rounded-lg text-[13px] text-white/[0.90] placeholder-white/[0.40] bg-white/[0.05] border border-white/[0.08] focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)] transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/[0.35] hover:text-white/[0.55] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/[0.25] font-mono">/</span>
          )}
        </div>

        {/* Multi-select actions */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-white/[0.50] font-medium">
              {selectedCount} selected
            </span>
            <button
              onClick={onKillSelected}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[rgba(248,113,113,0.80)] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] hover:bg-[rgba(248,113,113,0.12)] transition-colors"
            >
              Kill Selected
            </button>
          </div>
        )}
      </div>

      {/* Right side - Keyboard hints */}
      <div className="hidden lg:flex items-center gap-3 mr-2">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] text-white/[0.50] bg-white/[0.06] border border-white/[0.08] font-mono">↑↓←→</kbd>
          <span className="text-[10px] text-white/[0.35]">navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] text-white/[0.50] bg-white/[0.06] border border-white/[0.08] font-mono">↵</kbd>
          <span className="text-[10px] text-white/[0.35]">open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] text-white/[0.50] bg-white/[0.06] border border-white/[0.08] font-mono">esc</kbd>
          <span className="text-[10px] text-white/[0.35]">close</span>
        </div>
      </div>
    </div>
  );
}
