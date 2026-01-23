import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

// GitHub icon
function GitHubIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export function WelcomeScreen() {
  const { startFullSetup, isLoading, error, clearError, setupProgress } = useAuthStore();
  const [showWhyModal, setShowWhyModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      {/* Background - matches app gradient */}
      <div className="absolute inset-0 bg-bg-primary" />
      <div className="app-background" />
      <div className="app-vignette" />
      <div className="noise-overlay" />

      {/* Content - nudged up for optical center */}
      <div className="relative z-10 flex flex-col items-center" style={{ marginTop: '-48px' }}>
        {/* Subtle center glow behind brand block */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Logo - larger for brand presence */}
        <img
          src="/caspian-logo.png"
          alt="Caspian"
          className="w-28 h-28 mb-4 relative"
        />

        {/* Brand name */}
        <h1
          className="text-[36px] font-semibold text-white/[0.92] mb-2"
          style={{ letterSpacing: '-0.02em' }}
        >
          Caspian
        </h1>

        {/* Subtitle */}
        <p className="text-[15px] text-white/[0.55] mb-8 text-center">
          Ship faster, one node at a time.
        </p>

        {/* Primary CTA - Continue with GitHub */}
        <button
          onClick={startFullSetup}
          disabled={isLoading}
          className="h-11 px-6 flex items-center gap-3 rounded-xl
                     bg-white/[0.20] border border-white/[0.22]
                     hover:bg-white/[0.28] hover:border-white/[0.32] hover:-translate-y-1 hover:shadow-xl
                     active:translate-y-0 active:bg-white/[0.22]
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none
                     transition-all duration-150"
          style={{
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {isLoading ? (
            <>
              <svg className="w-5 h-5 text-white/[0.80] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[14px] font-medium text-white/[0.90]">
                {setupProgress || 'Setting up...'}
              </span>
            </>
          ) : (
            <>
              <GitHubIcon className="w-5 h-5 text-white/[0.90]" />
              <span className="text-[14px] font-medium text-white/[0.95]">
                Continue with GitHub
              </span>
            </>
          )}
        </button>

        {/* Helper text with learn more icon */}
        <p className="mt-3 text-[12px] text-white/[0.65] flex items-center gap-1.5">
          <span>We'll install and set up GitHub CLI</span>
          <button
            onClick={() => setShowWhyModal(true)}
            className="text-white/[0.40] hover:text-white/[0.70] transition-colors"
            title="Learn more"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </p>

        {/* Error message - inline feedback under button */}
        {error && (
          <div className="mt-3 px-3 py-2 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] rounded-lg text-[rgba(248,113,113,0.85)] text-[12px] flex items-center gap-2">
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

      {/* Footer - raised and more visible */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 text-[11px] text-white/[0.50]">
        <a href="#" className="hover:text-white/[0.70] transition-colors">Privacy</a>
        <span className="text-white/[0.30]">•</span>
        <a href="#" className="hover:text-white/[0.70] transition-colors">Terms</a>
      </div>

      {/* Why modal */}
      {showWhyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWhyModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-[#1a1a1c] border border-white/[0.12] rounded-xl shadow-2xl max-w-md mx-4 p-6">
            {/* Close button */}
            <button
              onClick={() => setShowWhyModal(false)}
              className="absolute top-4 right-4 text-white/[0.50] hover:text-white/[0.80] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <h2 className="text-[18px] font-semibold text-white/[0.92] mb-3">
              Why GitHub CLI?
            </h2>

            <div className="space-y-3 text-[13px] text-white/[0.70] leading-relaxed">
              <p>
                Caspian uses the GitHub CLI (gh) to manage your repositories, branches, and pull requests securely.
              </p>

              <div className="pt-2">
                <p className="text-white/[0.85] font-medium mb-2">What happens:</p>
                <ul className="space-y-1.5 text-white/[0.60]">
                  <li className="flex items-start gap-2">
                    <span className="text-white/[0.40] mt-0.5">1.</span>
                    <span><span className="text-white/[0.75]">Install gh CLI</span> — via Homebrew if not installed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/[0.40] mt-0.5">2.</span>
                    <span><span className="text-white/[0.75]">Browser login</span> — authenticate with GitHub in your browser</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-white/[0.40] mt-0.5">3.</span>
                    <span><span className="text-white/[0.75]">Ready to go</span> — Caspian uses gh for all git operations</span>
                  </li>
                </ul>
              </div>

              <p className="pt-2 text-[12px] text-white/[0.50]">
                Your credentials are managed by GitHub CLI and never stored by Caspian.
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => setShowWhyModal(false)}
              className="mt-5 w-full h-9 rounded-lg bg-white/[0.10] hover:bg-white/[0.15] text-[13px] font-medium text-white/[0.85] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
