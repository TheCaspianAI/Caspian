import { memo, useMemo } from 'react';
import type { Message, LiveToolCall, LiveBlock } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AgentMessageRenderer } from './AgentMessageRenderer';
import { StructuredMessageRenderer } from './StructuredMessageRenderer';

interface MessageBubbleProps {
  message: Message;
  showHeader?: boolean;
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isNew?: boolean; // For typing animation
  isAgentRunning?: boolean; // Whether the agent is currently running
  isStreaming?: boolean; // Whether this message is actively streaming
  // Live structured data from agent store
  liveToolCalls?: LiveToolCall[];
  liveBlocks?: LiveBlock[];
}

// Memoized markdown components - using soft-white palette (0.86/0.58/0.40)
const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match;

    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[13px] text-white/[0.78] font-mono"
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
          margin: '0.75rem 0',
          borderRadius: '10px',
          fontSize: '13px',
          background: 'rgba(12, 12, 14, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px 16px',
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
    return <p className="mb-3 last:mb-0 text-[14px] text-white/[0.78] leading-[1.5]">{children}</p>;
  },
  ul({ children }: { children?: React.ReactNode }) {
    return <ul className="pl-4 mb-3 space-y-1 text-[14px] text-white/[0.78] list-disc marker:text-white/[0.40]">{children}</ul>;
  },
  ol({ children }: { children?: React.ReactNode }) {
    return <ol className="pl-4 mb-3 space-y-1 text-[14px] text-white/[0.78] list-decimal marker:text-white/[0.40]">{children}</ol>;
  },
  li({ children }: { children?: React.ReactNode }) {
    return <li className="text-[14px] text-white/[0.78] pl-0.5 leading-[1.5]">{children}</li>;
  },
  h1({ children }: { children?: React.ReactNode }) {
    return <h1 className="text-display mb-3 mt-4 first:mt-0 text-white">{children}</h1>;
  },
  h2({ children }: { children?: React.ReactNode }) {
    return <h2 className="text-title mb-2 mt-3 first:mt-0 text-white">{children}</h2>;
  },
  h3({ children }: { children?: React.ReactNode }) {
    return <h3 className="text-ui font-semibold text-white/[0.82] mb-2 mt-2 first:mt-0">{children}</h3>;
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a
        href={href}
        className="text-interactive hover:text-interactive-hover hover:underline transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return (
      <blockquote className="border-l-2 border-white/[0.15] pl-3 my-3 text-white/[0.58] italic">
        {children}
      </blockquote>
    );
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="overflow-x-auto my-3 rounded-lg border border-white/[0.06]">
        <table className="min-w-full text-[14px]">
          {children}
        </table>
      </div>
    );
  },
  th({ children }: { children?: React.ReactNode }) {
    return (
      <th className="px-3 py-2 text-left text-[12px] font-semibold text-white/[0.58] bg-white/[0.02] border-b border-white/[0.06]">
        {children}
      </th>
    );
  },
  td({ children }: { children?: React.ReactNode }) {
    return (
      <td className="px-3 py-2 text-[14px] text-white/[0.78] border-b border-white/[0.06]">
        {children}
      </td>
    );
  },
};

function MessageBubbleComponent({
  message,
  showHeader: _showHeader = true,
  isGrouped: _isGrouped = false,
  isFirstInGroup: _isFirstInGroup = false,
  isLastInGroup: _isLastInGroup = false,
  isNew: _isNew = false,
  isAgentRunning = false,
  isStreaming = false,
  liveToolCalls = [],
  liveBlocks = [],
}: MessageBubbleProps) {
  const isHuman = message.sender_type === 'human';
  const isAgent = message.sender_type === 'agent';

  // Check if we have structured live data to render
  const hasStructuredData = liveToolCalls.length > 0 || liveBlocks.length > 0;

  // Memoize markdown rendering to prevent re-renders when content hasn't changed
  const renderedMarkdown = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {message.content}
    </ReactMarkdown>
  ), [message.content]);

  // Human messages: distinct pill style, right-aligned (slightly brighter than assistant)
  if (isHuman) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] message-bubble-user px-3.5 py-2.5">
          <div className="text-[14px] text-white/[0.86] leading-[1.5] break-words whitespace-pre-wrap">
            {renderedMarkdown}
          </div>
        </div>
      </div>
    );
  }

  // Agent messages: use structured renderer if we have live data, otherwise use legacy parser
  if (isAgent) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] py-2">
          {hasStructuredData ? (
            <StructuredMessageRenderer
              blocks={liveBlocks}
              toolCalls={liveToolCalls}
              isAgentRunning={isAgentRunning}
              isStreaming={isStreaming}
            />
          ) : (
            <AgentMessageRenderer
              content={message.content}
              isAgentRunning={isAgentRunning}
              isStreaming={isStreaming}
            />
          )}
        </div>
      </div>
    );
  }

  // Assistant messages: no bubble, left-aligned, markdown rendering
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] py-2">
        <div className="text-body text-text-primary">
          {renderedMarkdown}
        </div>
      </div>
    </div>
  );
}

// Helper function to deep compare arrays
function arraysEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  // Deep compare by stringifying - handles nested objects
  return JSON.stringify(a) === JSON.stringify(b);
}

// Export memoized component to prevent re-renders when props haven't changed
export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these props change
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isAgentRunning === nextProps.isAgentRunning &&
    prevProps.isStreaming === nextProps.isStreaming &&
    arraysEqual(prevProps.liveToolCalls, nextProps.liveToolCalls) &&
    arraysEqual(prevProps.liveBlocks, nextProps.liveBlocks)
  );
});
