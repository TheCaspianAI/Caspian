import { useState } from 'react';
import { safeInvoke } from '../../utils/tauri';
import type { CommandResult, AgentDiagnostics } from '../../types';

interface AgentDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDiagnosticsModal({ isOpen, onClose }: AgentDiagnosticsModalProps) {
  const [diagnostics, setDiagnostics] = useState<AgentDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const result = await safeInvoke<CommandResult<AgentDiagnostics>>('run_agent_diagnostics');
      if (result?.success && result?.data) {
        setDiagnostics(result.data);
      }
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="glass-popover border border-white/[0.08] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-secondary flex items-center justify-between">
          <div>
            <h2 className="text-title font-semibold text-text-primary">Agent Diagnostics</h2>
            <p className="text-caption text-text-tertiary mt-0.5">Check if Claude agent environment is properly configured</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!diagnostics ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-body text-text-secondary mb-4">Run diagnostics to check your agent environment</p>
              <button
                onClick={runDiagnostics}
                disabled={isLoading}
                className="px-4 py-2 bg-interactive hover:bg-interactive-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Running diagnostics...' : 'Run Diagnostics'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Claude CLI Status */}
              <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {diagnostics.claude_cli_found ? (
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <h3 className="text-ui font-semibold text-text-primary mb-1">Claude CLI Binary</h3>
                    {diagnostics.claude_cli_found ? (
                      <div className="space-y-1">
                        <p className="text-body text-text-secondary">
                          ✓ Found at: <code className="text-caption font-mono bg-surface-primary px-1.5 py-0.5 rounded">{diagnostics.claude_cli_path}</code>
                        </p>
                        <p className="text-body text-text-secondary">
                          Version: <code className="text-caption font-mono bg-surface-primary px-1.5 py-0.5 rounded">{diagnostics.claude_cli_version}</code>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-body text-error">✗ Claude CLI not found</p>
                        <div className="bg-error/10 border border-error/30 rounded p-3 text-caption text-text-secondary">
                          <p className="font-semibold text-text-primary mb-1">To fix this:</p>
                          <code className="block bg-surface-primary px-2 py-1 rounded mt-2 text-text-primary">
                            npm install -g @anthropic/claude-code
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Claude Config Status */}
              <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {diagnostics.claude_config_exists ? (
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <h3 className="text-ui font-semibold text-text-primary mb-1">Claude Authentication</h3>
                    {diagnostics.claude_config_exists ? (
                      <p className="text-body text-text-secondary">
                        ✓ Config found at: <code className="text-caption font-mono bg-surface-primary px-1.5 py-0.5 rounded">{diagnostics.claude_config_path}</code>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-body text-error">✗ Claude not authenticated</p>
                        <div className="bg-error/10 border border-error/30 rounded p-3 text-caption text-text-secondary space-y-2">
                          <p className="font-semibold text-text-primary">To fix this:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Open Terminal</li>
                            <li>Run <code className="bg-surface-primary px-1.5 py-0.5 rounded text-text-primary">claude</code> to start authentication</li>
                            <li>Follow the prompts to log in with your Anthropic account</li>
                            <li>Once authenticated, restart Caspian</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HOME Directory */}
              <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
                <h3 className="text-ui font-semibold text-text-primary mb-2">HOME Directory</h3>
                <div className="bg-surface-primary rounded p-2 text-caption font-mono text-text-secondary break-all">
                  {diagnostics.home_dir || 'Not set'}
                </div>
              </div>

              {/* System PATH */}
              <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
                <h3 className="text-ui font-semibold text-text-primary mb-2">System PATH</h3>
                <div className="bg-surface-primary rounded p-2 text-caption font-mono text-text-secondary break-all">
                  {diagnostics.system_path}
                </div>
              </div>

              {/* Errors Summary */}
              {diagnostics.errors.length > 0 && (
                <div className="bg-error/10 border border-error/30 rounded-lg p-4">
                  <h3 className="text-ui font-semibold text-error mb-2">Issues Found ({diagnostics.errors.length})</h3>
                  <ul className="space-y-2">
                    {diagnostics.errors.map((error, index) => (
                      <li key={index} className="text-body text-text-secondary flex items-start gap-2">
                        <span className="text-error">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success State */}
              {diagnostics.claude_cli_found && diagnostics.claude_config_exists && diagnostics.errors.length === 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-ui font-semibold">All checks passed!</span>
                  </div>
                  <p className="text-body text-text-secondary mt-2">
                    Your agent environment is properly configured. If you're still having issues, try sending a message again.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-secondary flex items-center justify-between">
          {diagnostics && (
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="text-body text-interactive hover:text-interactive-hover transition-colors disabled:opacity-50"
            >
              Run Again
            </button>
          )}
          <div className="flex-1"></div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-secondary hover:bg-surface-hover border border-border-primary text-text-primary rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
