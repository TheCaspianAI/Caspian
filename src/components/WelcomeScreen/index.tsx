import { useAuthStore } from '../../stores/authStore';

export function WelcomeScreen() {
  const { startFullSetup, isLoading, error, clearError, setupProgress } = useAuthStore();

  const handleGetStarted = async () => {
    await startFullSetup();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      {/* Background - matches app gradient */}
      <div className="absolute inset-0 bg-bg-primary" />
      <div className="app-background" />
      <div className="app-vignette" />
      <div className="noise-overlay" />

      {/* Content - nudged up for optical center */}
      <div className="relative z-10 flex flex-col items-center" style={{ marginTop: '-48px' }}>

        {/* Logo with subtle glow for grounding */}
        <div className="relative mb-5">
          {/* Soft glow behind logo */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 60%)',
              filter: 'blur(20px)',
              transform: 'scale(1.5)',
            }}
          />
          <img
            src="/caspian-logo.png"
            alt="Caspian"
            className="w-28 h-28 relative"
          />
        </div>

        {/* Brand name */}
        <h1
          className="text-[36px] font-semibold text-white/[0.92] mb-2.5"
          style={{ letterSpacing: '-0.02em' }}
        >
          Caspian
        </h1>

        {/* Tagline - smaller, lower emphasis */}
        <p className="text-[14px] text-white/[0.50] mb-9 text-center">
          Ship faster, one node at a time.
        </p>

        {/* Primary CTA - pill button style */}
        <button
          onClick={handleGetStarted}
          disabled={isLoading}
          className="h-[46px] px-8 flex items-center justify-center gap-2.5 rounded-full
                     bg-white/[0.12] border border-white/[0.10]
                     hover:bg-white/[0.18] hover:border-white/[0.16] hover:-translate-y-0.5 hover:shadow-lg
                     active:translate-y-0 active:bg-white/[0.14]
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none
                     transition-all duration-150"
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 text-white/[0.70] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[14px] font-medium text-white/[0.85]">
                {setupProgress || 'Setting up...'}
              </span>
            </>
          ) : (
            <span className="text-[14px] font-semibold text-white/[0.90]">
              Get Started
            </span>
          )}
        </button>

        {/* Error message - inline feedback under button */}
        {error && (
          <div className="mt-5 px-3 py-2 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.12)] rounded-lg text-[rgba(248,113,113,0.80)] text-[12px] flex items-center gap-2 max-w-sm">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="hover:text-[rgba(248,113,113,1)] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 text-[11px] text-white/[0.40]">
        <a href="#" className="hover:text-white/[0.60] transition-colors">Privacy</a>
        <span className="text-white/[0.25]">·</span>
        <a href="#" className="hover:text-white/[0.60] transition-colors">Terms</a>
      </div>
    </div>
  );
}
