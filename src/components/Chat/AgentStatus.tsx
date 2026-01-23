import { useAgentStore } from '../../stores/agentStore';

interface AgentStatusProps {
  nodeId: string;
  onTerminate?: () => void;
}

export function AgentStatus({ nodeId, onTerminate }: AgentStatusProps) {
  const {
    nodeStatus,
    terminateAgentForNode,
  } = useAgentStore();

  // Get session status for this node from cache
  // Status updates come via agent:output and agent:complete events (event-driven, not polling)
  const session = nodeStatus[nodeId] || null;

  const handleTerminate = async () => {
    const success = await terminateAgentForNode(nodeId);
    if (success) {
      onTerminate?.();
    }
  };

  if (!session) {
    return null;
  }

  const getStatusColor = () => {
    switch (session.status) {
      case 'running':
        return 'bg-success/20 text-success border-success/30';
      case 'completed':
        return 'bg-interactive/20 text-interactive border-interactive/30';
      case 'failed':
        return 'bg-error/20 text-error border-error/30';
      case 'terminated':
        return 'bg-text-tertiary/20 text-text-tertiary border-text-tertiary/30';
      default:
        return 'bg-surface-secondary text-text-secondary border-border-primary';
    }
  };

  const getStatusLabel = () => {
    switch (session.status) {
      case 'running':
        return 'Agent Running';
      case 'completed':
        return 'Agent Completed';
      case 'failed':
        return 'Agent Failed';
      case 'terminated':
        return 'Agent Terminated';
      default:
        return 'Unknown';
    }
  };

  const getAdapterLabel = () => {
    switch (session.adapter_type) {
      case 'claude_code':
        return 'Claude Code';
      default:
        return session.adapter_type;
    }
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center gap-2 flex-1">
        {session.status === 'running' && (
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-current animate-ping opacity-50" />
          </div>
        )}
        {session.status === 'completed' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {session.status === 'failed' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {session.status === 'terminated' && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        )}

        <div>
          <div className="text-body font-medium">{getStatusLabel()}</div>
          <div className="text-caption opacity-70">{getAdapterLabel()}</div>
        </div>
      </div>

      {session.status === 'running' && (
        <button
          onClick={handleTerminate}
          className="px-2 py-1 text-caption bg-error/20 text-error rounded hover:bg-error/30 transition-colors"
          title="Terminate agent"
        >
          Stop
        </button>
      )}
    </div>
  );
}
