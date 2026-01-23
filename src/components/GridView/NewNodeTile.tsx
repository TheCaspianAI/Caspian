interface NewNodeTileProps {
  onClick: () => void;
  compact?: boolean;
  isSelected?: boolean;
}

export function NewNodeTile({ onClick, compact = false, isSelected = false }: NewNodeTileProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          w-full h-full flex flex-col items-center justify-center gap-1
          rounded-md border border-dashed
          ${isSelected
            ? 'border-white/[0.25] bg-white/[0.06]'
            : 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.18]'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15]
          transition-all duration-150 cursor-pointer group
        `}
      >
        <svg className="w-4 h-4 text-white/[0.35] group-hover:text-white/[0.50]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-[10px] font-medium text-white/[0.40] group-hover:text-white/[0.55]">
          New Node
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        w-full h-full flex flex-col items-center justify-center gap-2
        rounded-lg border border-dashed
        ${isSelected
          ? 'border-white/[0.25] bg-white/[0.06]'
          : 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.18]'}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15]
        transition-all duration-150 cursor-pointer group
      `}
      style={{
        boxShadow: isSelected
          ? '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.30)'
          : 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {/* Plus icon */}
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.06] group-hover:border-white/[0.12] transition-all">
        <svg className="w-4 h-4 text-white/[0.40] group-hover:text-white/[0.55]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>

      {/* Label */}
      <span className="text-[12px] font-medium text-white/[0.45] group-hover:text-white/[0.60]">
        New Node
      </span>

      {/* Helper text */}
      <span className="text-[10px] text-white/[0.30] group-hover:text-white/[0.40]">
        Create a node for this repo
      </span>
    </button>
  );
}
