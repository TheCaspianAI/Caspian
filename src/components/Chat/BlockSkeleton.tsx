interface BlockSkeletonProps {
  /** Type of skeleton to display */
  variant?: 'text' | 'thinking' | 'tool';
  /** Number of lines for text skeleton */
  lines?: number;
  /** Whether skeleton is visible */
  isVisible?: boolean;
}

/**
 * BlockSkeleton - Loading placeholder with shimmer animation
 *
 * Shown immediately when a block starts before content arrives.
 * Provides visual feedback during "dead" periods while waiting
 * for Claude's response.
 */
export function BlockSkeleton({
  variant = 'text',
  lines = 3,
  isVisible = true,
}: BlockSkeletonProps) {
  if (!isVisible) return null;

  if (variant === 'thinking') {
    return (
      <div className="animate-skeleton-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded bg-surface-tertiary animate-shimmer" />
          <div className="h-3 w-20 rounded bg-surface-tertiary animate-shimmer" />
        </div>
        <div className="pl-6 space-y-2">
          <div className="h-3 w-full rounded bg-surface-tertiary animate-shimmer" style={{ animationDelay: '0.1s' }} />
          <div className="h-3 w-4/5 rounded bg-surface-tertiary animate-shimmer" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    );
  }

  if (variant === 'tool') {
    return (
      <div className="animate-skeleton-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-surface-tertiary animate-shimmer" />
          <div className="h-3 w-16 rounded bg-surface-tertiary animate-shimmer" style={{ animationDelay: '0.1s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-interactive animate-pulse" />
        </div>
        <div className="pl-5 mt-1">
          <div className="h-2.5 w-48 rounded bg-surface-tertiary animate-shimmer" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    );
  }

  // Text variant (default)
  return (
    <div className="space-y-2 animate-skeleton-fade-in">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 rounded bg-surface-tertiary animate-shimmer"
          style={{
            width: i === lines - 1 ? '60%' : '100%',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Inline skeleton for small loading states
 */
export function InlineSkeleton({ width = '4rem' }: { width?: string }) {
  return (
    <span
      className="inline-block h-3 rounded bg-surface-tertiary animate-shimmer align-middle"
      style={{ width }}
    />
  );
}
