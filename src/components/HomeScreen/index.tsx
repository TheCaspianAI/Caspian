import { open } from '@tauri-apps/plugin-dialog';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useUIStore } from '../../stores/uiStore';

// Icons - accept both className and style for flexible styling
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

function FolderIcon({ className = "w-4 h-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function GlobeIcon({ className = "w-4 h-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

function SparklesIcon({ className = "w-4 h-4", style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

export function HomeScreen() {
  // Use individual selectors to prevent cascading re-renders
  const checkGitStatus = useRepositoryStore(state => state.checkGitStatus);
  const addRepository = useRepositoryStore(state => state.addRepository);
  const setCloneDialogOpen = useUIStore(state => state.setCloneDialogOpen);
  const setQuickStartDialogOpen = useUIStore(state => state.setQuickStartDialogOpen);
  const setInitPromptDialogOpen = useUIStore(state => state.setInitPromptDialogOpen);
  const setErrorMessage = useUIStore(state => state.setErrorMessage);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select Project Folder',
      });

      if (selected) {
        const path = selected as string;
        const status = await checkGitStatus(path);

        if (!status) {
          return;
        }

        if (status.is_git_repo) {
          await addRepository(path);
        } else {
          setInitPromptDialogOpen(true, path);
        }
      }
    } catch (err) {
      setErrorMessage(String(err));
    }
  };

  const handleCloneFromUrl = () => {
    setCloneDialogOpen(true);
  };

  const handleQuickStart = () => {
    setQuickStartDialogOpen(true);
  };

  // CTA button style - 40px height, medium weight, clearer hover
  const ctaButtonStyle: React.CSSProperties = {
    height: '40px',
    padding: '0 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'transparent',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  };

  return (
    <div className="h-full flex items-center justify-center relative">
      {/* Hero block - nudged slightly left to compensate for sidebar weight */}
      <div className="flex flex-col items-center relative z-10" style={{ marginLeft: '-24px' }}>
        {/* Logo - larger for brand presence, tighter spacing */}
        <img
          src="/caspian-logo.png"
          alt="Caspian"
          style={{
            width: '150px',
            height: '150px',
            marginBottom: '8px',
          }}
        />

        {/* Brand wordmark */}
        <h1
          className="text-[34px] font-semibold text-text-primary"
          style={{ letterSpacing: '-0.02em', marginBottom: '6px' }}
        >
          Caspian
        </h1>

        {/* Tagline */}
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', marginBottom: '20px', textAlign: 'center' }}>
          Ship faster, one node at a time.
        </p>

        {/* Action buttons - 40px height, medium weight, clearer hover */}
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <button
            onClick={handleOpenProject}
            style={ctaButtonStyle}
            className="hover:bg-white/[0.06] hover:border-white/[0.14]"
          >
            <FolderIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              Open project
            </span>
          </button>

          <button
            onClick={handleCloneFromUrl}
            style={ctaButtonStyle}
            className="hover:bg-white/[0.06] hover:border-white/[0.14]"
          >
            <GlobeIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              Clone from URL
            </span>
          </button>

          <button
            onClick={handleQuickStart}
            style={ctaButtonStyle}
            className="hover:bg-white/[0.06] hover:border-white/[0.14]"
          >
            <SparklesIcon className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.75)' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
              Quick start
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
