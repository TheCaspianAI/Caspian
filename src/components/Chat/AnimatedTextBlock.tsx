import { useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTypingAnimation } from '../../hooks/useTypingAnimation';
import type { TypingSpeed } from '../../hooks/useTypingAnimation';
import { useAnimationStore } from '../../stores/animationStore';

interface AnimatedTextBlockProps {
  /** The full text content to animate */
  content: string;
  /** Unique identifier for this block (used to track if already animated) */
  blockId?: string;
  /** Whether content may still be streaming (appending) */
  isStreaming?: boolean;
  /** Speed preset for the typing animation */
  speed?: TypingSpeed;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** Skip animation and show full text immediately */
  skipAnimation?: boolean;
}

/**
 * AnimatedTextBlock - Renders text with typing animation effect
 *
 * Wraps markdown content and reveals it character-by-character
 * for a smooth streaming feel.
 *
 * Features:
 * - Character-by-character reveal
 * - Code blocks render instantly (no partial code)
 * - Subtle background glow during animation
 * - Supports content updates (appending while animating)
 */
export function AnimatedTextBlock({
  content,
  blockId,
  isStreaming = false,
  speed = 'fast',
  onAnimationComplete,
  skipAnimation = false,
}: AnimatedTextBlockProps) {
  const { hasMessageBeenAnimated, markMessageAnimated } = useAnimationStore();

  // Check if this block has already been animated
  const shouldSkipAnimation = skipAnimation || (blockId ? hasMessageBeenAnimated(blockId) : false);

  const { text: displayedText, isComplete } = useTypingAnimation(content, {
    speed: shouldSkipAnimation ? 'instant' : speed,
    skip: shouldSkipAnimation,
    onComplete: onAnimationComplete,
    respectCodeBlocks: true,
    allowContentUpdates: isStreaming,
  });

  // Mark as animated when animation completes
  useEffect(() => {
    if (isComplete && blockId && !shouldSkipAnimation) {
      markMessageAnimated(blockId);
    }
  }, [isComplete, blockId, shouldSkipAnimation, markMessageAnimated]);

  // Show subtle glow during active animation
  const isAnimating = !isComplete && !shouldSkipAnimation;

  // Memoize markdown components to avoid recreating on each render
  const markdownComponents = useMemo(
    () => ({
      code({
        className,
        children,
        ...props
      }: {
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || '');
        const isInline = !match;

        if (isInline) {
          return (
            <code
              className="px-1 py-0.5 bg-surface-tertiary rounded text-body font-mono text-text-primary"
              {...props}
            >
              {children}
            </code>
          );
        }

        return (
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: '0.5rem 0',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              background: '#141414',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      },
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },
      p({ children }: { children?: React.ReactNode }) {
        return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
      },
      ul({ children }: { children?: React.ReactNode }) {
        return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
      },
      ol({ children }: { children?: React.ReactNode }) {
        return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li>{children}</li>;
      },
      a({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) {
        return (
          <a
            href={href}
            className="text-interactive hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );
      },
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote className="border-l-2 border-border-secondary pl-3 my-2 text-text-secondary">
            {children}
          </blockquote>
        );
      },
    }),
    []
  );

  return (
    <div
      className={`
        text-text-primary text-body
        transition-all duration-medium ease-standard
        ${isAnimating ? 'animate-text-streaming' : ''}
      `}
    >
      {/* Show plain text during animation to avoid ~120-180 ReactMarkdown parses/sec.
          Only render markdown when animation completes for massive performance gain. */}
      {isComplete ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayedText}
        </ReactMarkdown>
      ) : (
        <div className="whitespace-pre-wrap">{displayedText}</div>
      )}
    </div>
  );
}

/**
 * Simpler non-animated text block for completed messages
 * (Matches AnimatedTextBlock styling but without animation overhead)
 */
export function StaticTextBlock({ content }: { content: string }) {
  const markdownComponents = useMemo(
    () => ({
      code({
        className,
        children,
        ...props
      }: {
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(className || '');
        const isInline = !match;

        if (isInline) {
          return (
            <code
              className="px-1 py-0.5 bg-surface-tertiary rounded text-body font-mono text-text-primary"
              {...props}
            >
              {children}
            </code>
          );
        }

        return (
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: '0.5rem 0',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              background: '#141414',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      },
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },
      p({ children }: { children?: React.ReactNode }) {
        return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
      },
      ul({ children }: { children?: React.ReactNode }) {
        return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
      },
      ol({ children }: { children?: React.ReactNode }) {
        return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li>{children}</li>;
      },
      a({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) {
        return (
          <a
            href={href}
            className="text-interactive hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );
      },
      blockquote({ children }: { children?: React.ReactNode }) {
        return (
          <blockquote className="border-l-2 border-border-secondary pl-3 my-2 text-text-secondary">
            {children}
          </blockquote>
        );
      },
    }),
    []
  );

  return (
    <div className="text-text-primary text-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
