interface StreamingCursorProps {
  isActive?: boolean;
  className?: string;
}

/**
 * Blinking cursor for streaming text
 */
export function StreamingCursor({ isActive = true, className = '' }: StreamingCursorProps) {
  if (!isActive) return null;

  return (
    <span
      className={`streaming-cursor ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Block cursor style (for code/terminal feel)
 */
export function BlockCursor({ isActive = true, className = '' }: StreamingCursorProps) {
  if (!isActive) return null;

  return (
    <span
      className={`block-cursor ${className}`}
      aria-hidden="true"
    >
      _
    </span>
  );
}
