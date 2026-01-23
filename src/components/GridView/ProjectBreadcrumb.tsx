interface ProjectBreadcrumbProps {
  path: string[];
  onNavigate: (index: number) => void;
}

export function ProjectBreadcrumb({ path, onNavigate }: ProjectBreadcrumbProps) {
  if (path.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className="text-text-primary font-medium">All Projects</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {/* Home/Root button */}
      <button
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-surface-hover"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* Path segments */}
      {path.map((segment, index) => (
        <div key={index} className="flex items-center gap-1">
          <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {index === path.length - 1 ? (
            <span className="text-text-primary font-medium px-2 py-1">
              {segment}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(index)}
              className="text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded hover:bg-surface-hover"
            >
              {segment}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
