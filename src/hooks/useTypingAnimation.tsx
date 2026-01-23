import { useState, useEffect, useRef, useCallback } from 'react';

/** Speed presets for different content types */
export type TypingSpeed = 'fast' | 'normal' | 'slow' | 'instant';

const SPEED_VALUES: Record<TypingSpeed, number> = {
  instant: Infinity,
  fast: 3,      // Fast for regular text (visible but quick)
  normal: 2,    // Default balanced speed
  slow: 1,      // Slow for deliberate feel
};

interface UseTypingAnimationOptions {
  /** Speed preset or characters per frame */
  speed?: TypingSpeed | number;
  /** Whether to skip animation and show full text immediately */
  skip?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
  /** Whether to respect code blocks (show them instantly) */
  respectCodeBlocks?: boolean;
  /** Whether content may be updated while animating (appending mode) */
  allowContentUpdates?: boolean;
}

/**
 * Hook for creating a typing animation effect
 * Returns the progressively revealed text
 *
 * Features:
 * - Speed presets: 'fast', 'normal', 'slow', 'instant'
 * - Content updates: Can handle text being appended during animation
 * - Pause/resume: Control animation flow
 * - Code block awareness: Shows code blocks instantly
 */
export function useTypingAnimation(
  fullText: string,
  options: UseTypingAnimationOptions = {}
) {
  const {
    speed = 'normal',
    skip = false,
    onComplete,
    respectCodeBlocks = true,
    allowContentUpdates = false,
  } = options;

  // Resolve speed to a number
  const resolvedSpeed = typeof speed === 'string' ? SPEED_VALUES[speed] : speed;

  const [displayedText, setDisplayedText] = useState(skip || resolvedSpeed === Infinity ? fullText : '');
  const [isComplete, setIsComplete] = useState(skip || resolvedSpeed === Infinity);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndexRef = useRef(skip || resolvedSpeed === Infinity ? fullText.length : 0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const previousTextRef = useRef(fullText);
  const isPausedRef = useRef(false);

  // Track if animation is actively running
  const isAnimatingRef = useRef(false);

  // Store fullText in ref to avoid recreating animate callback on every text change
  const fullTextRef = useRef(fullText);
  fullTextRef.current = fullText;

  const animate = useCallback(() => {
    if (isPausedRef.current) {
      // If paused, don't schedule next frame but keep the animation "alive"
      isAnimatingRef.current = false;
      return;
    }

    // Use ref to get current fullText value without recreating callback
    const currentFullText = fullTextRef.current;

    if (currentIndexRef.current >= currentFullText.length) {
      setIsComplete(true);
      isAnimatingRef.current = false;
      onComplete?.();
      return;
    }

    let charsToAdd = resolvedSpeed;

    // If we're respecting code blocks, check if we're entering one
    if (respectCodeBlocks) {
      const remaining = currentFullText.slice(currentIndexRef.current);

      // Check for code block start
      if (remaining.startsWith('```')) {
        // Find the end of this code block
        const endIndex = remaining.indexOf('```', 3);
        if (endIndex !== -1) {
          // Show the entire code block at once
          charsToAdd = endIndex + 6; // Include closing ```
        }
      }

      // Check for inline code
      if (remaining.startsWith('`') && !remaining.startsWith('```')) {
        const endIndex = remaining.indexOf('`', 1);
        if (endIndex !== -1) {
          charsToAdd = endIndex + 1;
        }
      }
    }

    currentIndexRef.current = Math.min(
      currentIndexRef.current + charsToAdd,
      currentFullText.length
    );

    setDisplayedText(currentFullText.slice(0, currentIndexRef.current));

    if (currentIndexRef.current < currentFullText.length) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      setIsComplete(true);
      isAnimatingRef.current = false;
      onComplete?.();
    }
  }, [resolvedSpeed, onComplete, respectCodeBlocks]); // Removed fullText dependency

  useEffect(() => {
    // If skip is true or instant speed, show full text immediately
    if (skip || resolvedSpeed === Infinity) {
      setDisplayedText(fullText);
      setIsComplete(true);
      currentIndexRef.current = fullText.length;
      previousTextRef.current = fullText;
      return;
    }

    // Check if this is the same text (re-render with no change)
    if (fullText === previousTextRef.current) {
      // Same text, don't restart animation
      // If we're still animating, continue; if complete, stay complete
      return;
    }

    // Handle content updates (appending mode)
    if (allowContentUpdates && fullText.startsWith(previousTextRef.current) && previousTextRef.current.length > 0) {
      // Text was appended, continue from current position
      previousTextRef.current = fullText;

      // If animation completed but new content arrived, continue animation
      if (isComplete && fullText.length > currentIndexRef.current) {
        setIsComplete(false);
        if (!isAnimatingRef.current && !isPausedRef.current) {
          isAnimatingRef.current = true;
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      }
      return;
    }

    // Full reset for completely new text
    previousTextRef.current = fullText;
    currentIndexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Start animation on next frame - guard against starting if already running
    if (!isPausedRef.current && !isAnimatingRef.current) {
      isAnimatingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [fullText, resolvedSpeed, skip, allowContentUpdates, animate, isComplete]);

  // Handle pause state changes
  useEffect(() => {
    isPausedRef.current = isPaused;

    // Resume animation if unpaused and not complete
    if (!isPaused && !isComplete && !isAnimatingRef.current && currentIndexRef.current < fullText.length) {
      isAnimatingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isPaused, isComplete, fullText.length, animate]);

  const pause = useCallback(() => {
    setIsPaused(true);
    isPausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
  }, []);

  const skipToEnd = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    currentIndexRef.current = fullText.length;
    setDisplayedText(fullText);
    setIsComplete(true);
    isAnimatingRef.current = false;
    onComplete?.();
  }, [fullText, onComplete]);

  return {
    /** Currently displayed (partially revealed) text */
    text: displayedText,
    /** Whether the full text has been revealed */
    isComplete,
    /** Whether animation is paused */
    isPaused,
    /** Animation progress as percentage (0-100) */
    progress: fullText.length > 0 ? Math.round((currentIndexRef.current / fullText.length) * 100) : 100,
    /** Skip remaining animation and show full text */
    skipToEnd,
    /** Pause the animation */
    pause,
    /** Resume the animation */
    resume,
  };
}
