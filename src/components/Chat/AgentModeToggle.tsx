import { useUIStore, type AgentMode } from '../../stores/uiStore';

const MODE_CONFIG: Record<AgentMode, { label: string; color: string; bgColor: string; title: string }> = {
  normal: {
    label: 'Agent',
    color: 'text-text-tertiary',
    bgColor: '',
    title: 'Agent mode (Shift+Tab to toggle)',
  },
  plan: {
    label: 'Plan',
    color: 'text-interactive',
    bgColor: 'bg-interactive/10',
    title: 'Plan mode - agent will plan before executing (Shift+Tab to toggle)',
  },
  auto_approve: {
    label: 'Auto',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    title: 'Auto-approve mode - agent will skip all permission prompts (Shift+Tab to toggle)',
  },
};

export function AgentModeToggle() {
  const { agentMode, cycleAgentMode } = useUIStore();
  const config = MODE_CONFIG[agentMode];

  return (
    <button
      onClick={cycleAgentMode}
      className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
        agentMode === 'normal'
          ? 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'
          : `${config.color} ${config.bgColor}`
      }`}
      title={config.title}
    >
      {/* Toggle/mode icon */}
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {agentMode === 'plan' ? (
          // Clipboard/plan icon for plan mode
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        ) : (
          // Infinity icon for normal/agent mode
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"
          />
        )}
      </svg>
      {/* Mode label badge */}
      {config.label && (
        <span className="text-caption font-medium">
          {config.label}
        </span>
      )}
    </button>
  );
}
