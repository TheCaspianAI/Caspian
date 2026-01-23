import { useNodeStore } from '../../stores/nodeStore';
import type { AuditEventType } from '../../types';

const EVENT_LABELS: Record<AuditEventType, string> = {
  node_created: 'Node created',
  state_transition: 'State changed',
  goal_change: 'Goal updated',
  ground_rule_added: 'Ground rule added',
  ground_rule_removed: 'Ground rule removed',
  ground_rule_edited: 'Ground rule edited',
  tests_run: 'Tests run',
};

export function HistoryTab() {
  const { auditLog } = useNodeStore();

  if (auditLog.length === 0) {
    return (
      <div className="p-6 text-center text-text-tertiary">
        <p>No history yet.</p>
        <p className="text-sm mt-1">Actions on this node will be logged here.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {auditLog.map((entry, i) => (
          <div
            key={i}
            className="flex gap-4 pb-4 border-b border-border-primary last:border-0"
          >
            <div className="w-2 h-2 mt-2 rounded-full bg-interactive flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">
                  {EVENT_LABELS[entry.event_type] || entry.event_type}
                </span>
                <span className="text-xs text-text-tertiary">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              {entry.reason && (
                <p className="text-sm text-text-secondary mt-1">{entry.reason}</p>
              )}
              {entry.new_value !== null && entry.new_value !== undefined && (
                <pre className="text-xs text-text-tertiary mt-1 bg-bg-primary p-2 rounded overflow-x-auto">
                  {String(JSON.stringify(entry.new_value, null, 2))}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
