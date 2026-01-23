import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { parseAgentOutput, type ParsedBlock, type ParsedToolCall } from './AgentOutputParser';
import { StreamingCursor } from './StreamingCursor';
import { useNodeStore, selectActiveNodeId } from '../../stores/nodeStore';

interface AgentMessageRendererProps {
  content: string;
  isAgentRunning?: boolean;
  isStreaming?: boolean;
  isLatest?: boolean; // Whether this is the latest message (only latest can trigger notifications)
}

// Regex to match context marker - captures a short phrase (2-6 words)
const CONTEXT_REGEX = /\[CONTEXT:\s*([^\]]+)\]/gi;

export function AgentMessageRenderer({
  content,
  isAgentRunning = false,
  isStreaming = false,
  isLatest = false,
}: AgentMessageRendererProps) {
  const activeNodeId = useNodeStore(selectActiveNodeId);
  const { updateNodeContext } = useNodeStore();
  const lastContextRef = useRef<string | null>(null);

  // Extract context and clean content
  const { cleanedContent, nodeContext } = useMemo(() => {
    const matches = [...content.matchAll(CONTEXT_REGEX)];
    const extractedContext = matches.length > 0 ? matches[matches.length - 1][1].trim() : null;
    const cleaned = content.replace(CONTEXT_REGEX, '').trim();
    return { cleanedContent: cleaned, nodeContext: extractedContext };
  }, [content]);

  // Silently update context when a new one is detected
  // Only the LATEST message should update context to avoid race conditions with notifications
  useEffect(() => {
    if (nodeContext && activeNodeId && nodeContext !== lastContextRef.current && !isStreaming && isLatest) {
      lastContextRef.current = nodeContext;
      updateNodeContext(activeNodeId, nodeContext);
    }
  }, [nodeContext, activeNodeId, updateNodeContext, isStreaming, isLatest]);

  const parsedBlocks = useMemo(() => parseAgentOutput(cleanedContent), [cleanedContent]);

  return (
    <div className="space-y-1.5">
      {parsedBlocks.map((block, index) => (
        <BlockRenderer
          key={index}
          block={block}
          isAgentRunning={isAgentRunning}
          isLatest={index === parsedBlocks.length - 1}
          isStreaming={isStreaming && index === parsedBlocks.length - 1}
        />
      ))}
    </div>
  );
}

interface BlockRendererProps {
  block: ParsedBlock;
  isAgentRunning: boolean;
  isLatest: boolean;
  isStreaming: boolean;
}

function BlockRenderer({ block, isAgentRunning, isLatest, isStreaming }: BlockRendererProps) {
  if (block.type === 'tool_group' && block.toolCalls) {
    return (
      <ToolCallGroup
        toolCalls={block.toolCalls}
        isRunning={isAgentRunning && isLatest}
      />
    );
  }

  if (block.type === 'text') {
    return <TextBlock content={block.content} isStreaming={isStreaming} />;
  }

  return null;
}

interface ToolCallGroupProps {
  toolCalls: ParsedToolCall[];
  isRunning: boolean;
}

function ToolCallGroup({ toolCalls, isRunning }: ToolCallGroupProps) {
  // Auto-expand while running, collapse when done
  const [isExpanded, setIsExpanded] = useState(isRunning);

  // Auto-collapse when agent finishes
  useEffect(() => {
    if (!isRunning && isExpanded) {
      // Small delay before collapsing for smoother UX
      const timer = setTimeout(() => setIsExpanded(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isRunning]);

  // Auto-expand when running
  useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
    }
  }, [isRunning]);

  const summaryText = `${toolCalls.length} tool call${toolCalls.length > 1 ? 's' : ''}`;

  return (
    <div className="my-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-tertiary transition-colors group w-full text-left py-0.5 opacity-70 hover:opacity-100"
      >
        <svg
          className={`w-2.5 h-2.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <span className="text-caption">{summaryText}</span>

        {isRunning && (
          <div className="flex items-center gap-1 ml-1">
            <div className="w-1 h-1 bg-interactive rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-fast ease-standard ${
          isExpanded ? 'max-h-[600px] opacity-100 mt-1.5' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1 pl-5 border-l border-border-default/50">
          {toolCalls.map((tool) => (
            <ToolCallItem key={tool.id} tool={tool} isRunning={isRunning} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ToolCallItemProps {
  tool: ParsedToolCall;
  isRunning: boolean;
}

function ToolCallItem({ tool, isRunning }: ToolCallItemProps) {
  // Tool icon based on name
  const getToolIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'read':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'write':
      case 'edit':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'bash':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'glob':
      case 'grep':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-start gap-2 text-body">
      <span className="text-text-tertiary mt-0.5 flex-shrink-0">
        {getToolIcon(tool.name)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-secondary text-caption">{tool.name}</span>
          {isRunning && (
            <div className="w-1 h-1 bg-interactive rounded-full animate-pulse" />
          )}
        </div>
        <p className="text-text-tertiary text-caption mt-0.5 break-words">
          {tool.description}
        </p>
      </div>
    </div>
  );
}

interface TextBlockProps {
  content: string;
  isStreaming?: boolean;
}

function TextBlock({ content, isStreaming = false }: TextBlockProps) {
  return (
    <div className="text-text-secondary text-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 code-chip text-caption font-mono"
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
          pre({ children }) {
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>;
          },
          li({ children }) {
            return <li>{children}</li>;
          },
          a({ href, children }) {
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
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-border-secondary pl-3 my-2 text-text-secondary">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <StreamingCursor isActive={true} />}
    </div>
  );
}
