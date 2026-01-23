interface CreateNodeCardProps {
  onClick: () => void;
  isSelected: boolean;
}

export function CreateNodeCard({ onClick, isSelected }: CreateNodeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative cursor-pointer group
        w-full h-full flex flex-col items-center justify-center gap-2
        rounded-2xl backdrop-blur-[16px] transition-all duration-150
        ${isSelected
          ? 'bg-white/[0.06] border border-white/[0.15]'
          : 'bg-[rgba(18,20,26,0.60)] border border-white/[0.06] hover:bg-[rgba(18,20,26,0.70)] hover:border-white/[0.10]'}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white/[0.15] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
      `}
      style={{
        boxShadow: isSelected
          ? '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Plus icon */}
      <div className={`
        w-9 h-9 rounded-xl flex items-center justify-center
        transition-all duration-150
        ${isSelected
          ? 'bg-white/[0.10] text-white/[0.70]'
          : 'bg-white/[0.04] text-white/[0.35] group-hover:bg-white/[0.06] group-hover:text-white/[0.50]'}
      `}>
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={`
          text-[14px] font-medium transition-colors
          ${isSelected ? 'text-white/[0.75]' : 'text-white/[0.50] group-hover:text-white/[0.65]'}
        `}>
          New Node
        </span>
        <span className={`
          text-[12px] transition-all
          ${isSelected ? 'text-white/[0.45]' : 'text-white/[0.00] group-hover:text-white/[0.35]'}
        `}>
          Create workspace
        </span>
      </div>
    </button>
  );
}
