import { useViewRouter } from '../../hooks/useViewRouter';

/**
 * NavButtons - Primary navigation buttons (Home, Control Room)
 *
 * Uses useViewRouter for navigation and highlighting state.
 */
export function NavButtons() {
  const {
    isHome,
    isControlRoom,
    navigateHome,
    toggleControlRoom,
  } = useViewRouter();

  return (
    <div className="pt-3 px-3 space-y-1">
      {/* Home button - highlighted when on home screen */}
      <button
        onClick={navigateHome}
        className={`w-full h-[38px] pl-3.5 pr-3 flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-colors text-left ${
          isHome
            ? 'bg-white/[0.08] text-white/[0.95]'
            : 'text-white/[0.65] hover:bg-white/[0.04] hover:text-white/[0.85]'
        }`}
        title="Go to Home"
      >
        <svg className={`w-4 h-4 ${isHome ? 'text-white/[0.85]' : 'text-white/[0.50]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Home
      </button>

      {/* Control Room - highlighted when open */}
      <button
        onClick={toggleControlRoom}
        className={`w-full h-[38px] pl-3.5 pr-3 flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-colors text-left ${
          isControlRoom
            ? 'bg-white/[0.08] text-white/[0.95]'
            : 'text-white/[0.65] hover:bg-white/[0.04] hover:text-white/[0.85]'
        }`}
        title="Open Control Room (Cmd+0)"
      >
        <svg className={`w-4 h-4 ${isControlRoom ? 'text-white/[0.85]' : 'text-white/[0.50]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        Control Room
      </button>
    </div>
  );
}
