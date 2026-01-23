// Node states (formerly Branch states)
export type NodeState = 'in_progress' | 'ready_for_review' | 'approved' | 'closed';

// Worktree status for async worktree operations
export type WorktreeStatus = 'pending' | 'creating' | 'ready' | 'failed' | 'removing';

// Worktree progress event (from Tauri events)
export interface WorktreeProgressEvent {
  node_id: string;
  status: WorktreeStatus;
  progress: number;
  message?: string;
  attempt: number;
  max_attempts: number;
}

// Repository
export interface Repository {
  id: string;
  name: string;
  path: string;
  main_branch: string;
  created_at: string;
  last_accessed_at: string | null;
  /** Whether the repository path exists on disk */
  path_exists: boolean;
}

// Git check result
export interface GitCheckResult {
  is_git_repo: boolean;
  has_commits: boolean;
  path: string;
}

// Node (formerly Branch)
export interface Node {
  id: string;
  repo_id: string;
  internal_branch: string;  // Hidden git branch name (e.g., "adarsh/swift-falcon")
  display_name: string;     // User-visible, editable name
  context: string | null;   // Auto-generated context from agent responses
  parent_branch: string;    // Current target branch (can be changed)
  original_parent_branch: string | null;  // Branch node was created from (immutable)
  worktree_path: string | null;
  state: NodeState;
  worktree_status: WorktreeStatus;  // Status of async worktree operation
  goal: string | null;
  checks_completed: number;
  checks_total: number;
  manifest_valid: boolean;
  tests_passed: boolean;
  created_at: string;
  updated_at: string;
  last_active_at: string;
}

// Node specification for batch creation
export interface NodeSpec {
  name: string;
  goal: string;
  parent: string;
}

// Agent info
export interface AgentInfo {
  model: string | null;
  session_id: string | null;
}

// Test config
export interface TestConfig {
  required: string[];
  command: string | null;
}

// Status info
export interface StatusInfo {
  state: NodeState;
  transitioned_at: string;
  transitioned_by: string;
  close_reason: string | null;
}

// Node manifest (formerly Branch manifest)
export interface NodeManifest {
  node_id: string;
  parent: string;
  created_at: string;
  agent: AgentInfo;
  goal: string;
  ground_rules: string[];
  conflicts_with: string[];
  tests: TestConfig;
  status: StatusInfo;
}

// Node with manifest
export interface NodeWithManifest {
  node: Node;
  manifest: NodeManifest | null;
}

// Validation result
export interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

// Audit event types
export type AuditEventType =
  | 'node_created'
  | 'state_transition'
  | 'goal_change'
  | 'ground_rule_added'
  | 'ground_rule_removed'
  | 'ground_rule_edited'
  | 'tests_run';

// Audit entry
export interface AuditEntry {
  timestamp: string;
  event_type: AuditEventType;
  node_id: string;
  actor: string;
  previous_value: unknown | null;
  new_value: unknown | null;
  reason: string | null;
}

// Command result
export interface CommandResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Chat types
export type SenderType = 'human' | 'agent';
export type MessageType = 'text' | 'system' | 'code' | 'error';
export type ChatStateType = 'idle' | 'locked' | 'awaiting_human';

export interface Message {
  id: string;
  workspace_id: string;
  node_id: string | null;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  message_type: MessageType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatStateEntry {
  id: string;
  workspace_id: string;
  node_id: string | null;
  state: ChatStateType;
  locked_reason: string | null;
  updated_at: string;
}

// Conversation turn - groups a user message with its agent response
export interface ConversationTurn {
  id: string;                          // Same as userMessage.id
  userMessage: Message;                // The human message (always present)
  agentResponse: AgentTurnResponse;    // Agent's response data
  createdAt: string;                   // From userMessage.created_at
}

export interface AgentTurnResponse {
  // Persisted messages from DB (after agent completes)
  messages: Message[];
  // Live streaming data (during agent execution)
  liveBlocks: LiveBlock[];
  liveToolCalls: LiveToolCall[];
  // State flags
  isComplete: boolean;                 // Agent finished this turn
  isStreaming: boolean;                // Currently streaming
}

// For agent messages that arrived before any user message (edge case)
export interface OrphanAgentMessages {
  messages: Message[];
  liveBlocks: LiveBlock[];
  liveToolCalls: LiveToolCall[];
}

// Agent session types
export type AgentAdapterType = 'claude_code';
export type AgentSessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'terminated' | 'pending' | 'completed_pending_context';

export interface AgentSession {
  id: string;
  node_id: string;
  adapter_type: AgentAdapterType;
  process_id: number | null;
  status: AgentSessionStatus;
  started_at: string;
  ended_at: string | null;
}

// Agent diagnostics for troubleshooting
export interface AgentDiagnostics {
  claude_cli_found: boolean;
  claude_cli_version: string | null;
  claude_cli_path: string | null;
  claude_config_exists: boolean;
  claude_config_path: string | null;
  home_dir: string | null;
  system_path: string;
  errors: string[];
}

// State display names
export const STATE_DISPLAY_NAMES: Record<NodeState, string> = {
  in_progress: 'In Progress',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
  closed: 'Closed',
};

// Worktree status display names
export const WORKTREE_STATUS_DISPLAY: Record<WorktreeStatus, string> = {
  pending: 'Preparing...',
  creating: 'Creating worktree...',
  ready: 'Ready',
  failed: 'Failed',
  removing: 'Removing...',
};

// Progress indicator helper
export function getProgressIndicator(completed: number, total: number): string {
  const ratio = completed / total;
  if (ratio <= 0.25) return '◔';
  if (ratio <= 0.5) return '◐';
  if (ratio <= 0.75) return '◕';
  return '●';
}

// File attachment types
export interface Attachment {
  id: string;
  name: string;
  path: string; // Browser blob URL for display
  type: string;
  size: number;
  content?: string; // Base64 encoded file content for sending to backend
}

// Mention types
export interface Mention {
  type: 'file' | 'node';
  value: string;
  position: number;
}

// Command types for command palette
export interface Command {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  handler: () => void;
  icon?: string;
  keywords?: string[];
}

// Open file tab
export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  language: string;
}

// Open diff tab
export interface OpenDiff {
  id: string;
  path: string;
  name: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  content: DiffLine[];
}

// Grid view types
export type GridCardStatus = 'thinking' | 'idle' | 'needs_input' | 'failed' | 'completed';

export interface GridViewState {
  gridSize: number;
  currentPage: number;
  selectedIndex: number | null;
  selectedIndices: number[];
  searchQuery: string;
  zoomPath: string[];
  showNumberInput: boolean;
}

export interface GridItem {
  type: 'node' | 'folder';
  id: string;
  name: string;
  node?: Node;
  nodeCount?: number;
  agentType?: AgentAdapterType;
  status?: GridCardStatus;
  intent?: string;
  scope?: string[];
  lastActive?: string;
  path?: string;
}

// Structured message content types
export type BlockType = 'thinking' | 'tool_use' | 'tool_result' | 'text';
export type ToolStatus = 'running' | 'completed' | 'error';

export interface MessageBlock {
  id: string;
  message_id: string;
  block_type: BlockType;
  sequence_order: number;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ToolCall {
  id: string;
  message_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | null;
  tool_output: string | null;
  status: ToolStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  file_path: string | null;
  lines_affected: number | null;
}

// Enhanced message with structured blocks (for future DB integration)
export interface MessageWithBlocks {
  message: Message;
  blocks: MessageBlock[];
  tool_calls: ToolCall[];
}

// Computed summary for display
export interface MessageSummary {
  total_tool_calls: number;
  completed_tool_calls: number;
  running_tool_calls: number;
  error_tool_calls: number;
  total_duration_ms: number;
  has_thinking: boolean;
}

// Structured event types (from backend JSON streaming)
export type StructuredEventType =
  | 'init'
  | 'thinking'
  | 'tool_start'
  | 'tool_complete'
  | 'text'
  | 'complete'
  | 'user_input_request';

// User input option for multi-choice questions
export interface UserInputOption {
  label: string;
  description?: string;
}

// User input request from agent
export interface UserInputRequest {
  tool_id: string;
  question: string;
  header?: string;
  options: UserInputOption[];
  multi_select: boolean;
  message_id: string;
}

// User's selection response to a multi-choice question
export interface UserInputSelection {
  toolId: string;
  selectedIndex: number | number[];
  selectedLabel: string | string[];
  selectedDescription?: string | string[];
}

export interface StructuredEvent {
  event_type: StructuredEventType;
  // Init event fields
  session_id?: string;
  model?: string;
  tools?: string[];
  // Thinking event fields
  content?: string;
  message_id?: string;
  // Tool start event fields
  tool_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  // Tool complete event fields
  tool_output?: string;
  is_error?: boolean;
  duration_ms?: number;
  // Complete event fields
  num_turns?: number;
  result?: string;
  // User input request fields
  question?: string;
  header?: string;
  options?: UserInputOption[];
  multi_select?: boolean;
}

// Extended agent output event with structured data
export interface AgentOutputEvent {
  session_id: string;
  node_id: string;
  output_type: 'stdout' | 'stderr' | 'system' | 'complete' | 'error' | 'pending';
  content: string;
  timestamp: string;
  structured?: StructuredEvent;
}

// Real-time tool call tracking for UI
export interface LiveToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  output?: string;
  isError: boolean;
  messageId: string;
}

/** Streaming state for block lifecycle */
export type BlockStreamingState = 'pending' | 'streaming' | 'complete';

// Real-time message block for UI streaming
export interface LiveBlock {
  id: string;
  type: BlockType;
  content: string;
  messageId: string;
  toolCall?: LiveToolCall;
  /** Streaming lifecycle state */
  streamingState?: BlockStreamingState;
  /** Animation progress (0-100) for coordinating animations */
  animationProgress?: number;
}

// PR information from GitHub
export interface PrInfo {
  number: number;
  url: string;
  state: string;           // "OPEN", "CLOSED", "MERGED"
  mergeable: string;       // "MERGEABLE", "CONFLICTING", "UNKNOWN"
  mergeStateStatus: string; // "CLEAN", "DIRTY", "BLOCKED", "BEHIND", "UNSTABLE", etc.
  title: string;
}

// Tool output parsing types
export type ToolOutputType = 'file' | 'git' | 'bash' | 'search' | 'task' | 'unknown';

export type GitOperationType = 'commit' | 'checkout' | 'branch-create' | 'push' | 'pull' | 'merge' | 'status' | 'diff' | 'log' | 'other';

export interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'remove' | 'context' | 'binary';
  content: string;
}

export interface DiffFile {
  filename: string;
  lines: DiffLine[];
  addCount: number;
  removeCount: number;
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
}

export interface ParsedToolOutput {
  type: ToolOutputType;
  raw: string;
  // File operation fields
  filePath?: string;
  fileExtension?: string;
  lineCount?: number;
  diff?: ParsedDiff;
  // Git operation fields
  gitOperation?: GitOperationType;
  gitCommand?: string;
  commitHash?: string;
  commitMessage?: string;
  branchName?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  // Task operation fields
  taskProgress?: { completed: number; total: number };
  nestedToolCount?: number;
  // Search operation fields
  matchCount?: number;
  fileMatches?: number;
}

// Branch statistics from git (for node cards)
export interface BranchStats {
  files_changed: number;
  additions: number;
  deletions: number;
  commits: number;
  has_uncommitted: boolean;
}

// Todo progress tracking
export interface TodoProgress {
  completed: number;
  total: number;
}

// Node card data (aggregated for display)
export interface NodeCardData {
  // Core node info
  id: string;
  context: string | null;
  goal: string | null;
  displayName: string;
  internalBranch: string;
  parentBranch: string;
  originalParentBranch: string | null;  // Branch node was created from (immutable)
  state: NodeState;
  worktreeStatus: WorktreeStatus;

  // Git stats
  stats: BranchStats | null;

  // Progress tracking
  todoProgress: TodoProgress | null;
  errorCount: number;

  // Agent info
  agentStatus: AgentSession | null;
  currentTool: string | null;
  currentToolInput: string | null;
  model: string | null;

  // PR info
  prInfo: PrInfo | null;

  // Meta
  messageCount: number;
  lastActivity: string;
}
