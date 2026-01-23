pub const SCHEMA: &str = r#"
-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    main_branch TEXT DEFAULT 'main',
    created_at TEXT NOT NULL,
    last_accessed_at TEXT
);

-- Nodes table (replaces branches table)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    internal_branch TEXT NOT NULL,
    display_name TEXT NOT NULL,
    context TEXT,
    parent_branch TEXT NOT NULL,
    original_parent_branch TEXT,
    worktree_path TEXT,
    state TEXT CHECK(state IN ('in_progress', 'ready_for_review', 'approved', 'closed')) DEFAULT 'in_progress',
    execution_status TEXT CHECK(execution_status IN ('idle', 'agent_running', 'needs_input')) DEFAULT 'idle',
    worktree_status TEXT CHECK(worktree_status IN ('pending', 'creating', 'ready', 'failed', 'removing')) DEFAULT 'ready',
    goal TEXT,
    checks_completed INTEGER DEFAULT 0,
    checks_total INTEGER DEFAULT 2,
    manifest_valid INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    UNIQUE(repo_id, internal_branch)
);

-- Legacy branches table (kept for backward compatibility during migration)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    parent_branch TEXT NOT NULL,
    worktree_path TEXT,
    state TEXT CHECK(state IN ('in_progress', 'ready_for_review', 'approved', 'closed')) DEFAULT 'in_progress',
    goal TEXT,
    checks_completed INTEGER DEFAULT 0,
    checks_total INTEGER DEFAULT 2,
    manifest_valid INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    assumptions_reviewed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(repo_id, branch_name)
);

-- UI State persistence
CREATE TABLE IF NOT EXISTS ui_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('human', 'agent')),
    sender_id TEXT,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK(message_type IN ('text', 'system', 'code', 'error')),
    metadata TEXT,
    created_at TEXT NOT NULL
);

-- Index for efficient message queries
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_node ON messages(node_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_node_created ON messages(workspace_id, node_id, created_at DESC);

-- Chat state per node/workspace
CREATE TABLE IF NOT EXISTS chat_state (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'idle' CHECK(state IN ('idle', 'locked', 'awaiting_human')),
    locked_reason TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(workspace_id, node_id)
);

-- Agent sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    adapter_type TEXT NOT NULL,
    process_id INTEGER,
    status TEXT NOT NULL DEFAULT 'idle',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    claude_session_id TEXT,
    UNIQUE(node_id)
);

-- Workspace memory table
CREATE TABLE IF NOT EXISTS workspace_memory (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL CHECK(memory_type IN ('pattern', 'preference', 'fact')),
    content TEXT NOT NULL,
    source_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_memory ON workspace_memory(workspace_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_nodes_repo ON nodes(repo_id, last_active_at DESC);

-- Notification state table
CREATE TABLE IF NOT EXISTS notification_state (
    node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    unread_count INTEGER NOT NULL DEFAULT 0,
    requires_input INTEGER NOT NULL DEFAULT 0,
    last_notification_at TEXT,
    last_viewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_state_node ON notification_state(node_id);

-- Initialize default UI state
INSERT OR IGNORE INTO ui_state (key, value) VALUES ('focus_mode', 'false');
INSERT OR IGNORE INTO ui_state (key, value) VALUES ('sidebar_width', '300');
INSERT OR IGNORE INTO ui_state (key, value) VALUES ('active_repo_id', '');
INSERT OR IGNORE INTO ui_state (key, value) VALUES ('active_node_id', '');

-- Migration: Add claude_session_id column to agent_sessions if it doesn't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we ignore errors
-- This is safe because the column will already exist for new databases
"#;

/// List of individual migrations to run (each executed separately to handle failures gracefully)
pub const MIGRATIONS_LIST: &[&str] = &[
    // v1.1: Add claude_session_id column for session resumption
    "ALTER TABLE agent_sessions ADD COLUMN claude_session_id TEXT",
    // v1.2: Add worktree_status column for async worktree operations
    "ALTER TABLE nodes ADD COLUMN worktree_status TEXT DEFAULT 'ready'",
    // v1.4: Add original_parent_branch column to track where node was created from
    "ALTER TABLE nodes ADD COLUMN original_parent_branch TEXT",
    // v1.4: Backfill original_parent_branch with parent_branch for existing nodes
    "UPDATE nodes SET original_parent_branch = parent_branch WHERE original_parent_branch IS NULL",
    // v1.3: SQLite doesn't support altering CHECK constraints, so we need to recreate the table
    // to add 'idle' status. Instead, we'll just drop the constraint by recreating.
    // Step 1: Create new table without constraint
    "CREATE TABLE IF NOT EXISTS agent_sessions_new (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        adapter_type TEXT NOT NULL,
        process_id INTEGER,
        status TEXT NOT NULL DEFAULT 'idle',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        claude_session_id TEXT,
        UNIQUE(node_id)
    )",
    // Step 2: Copy data
    "INSERT OR IGNORE INTO agent_sessions_new SELECT id, node_id, workspace_id, adapter_type, process_id, status, started_at, ended_at, claude_session_id FROM agent_sessions",
    // Step 3: Drop old table
    "DROP TABLE IF EXISTS agent_sessions",
    // Step 4: Rename new table
    "ALTER TABLE agent_sessions_new RENAME TO agent_sessions",
];

// Keep for backwards compatibility (not used anymore)
#[allow(dead_code)]
pub const MIGRATIONS: &str = r#"
-- Add claude_session_id column for session resumption (v1.1)
ALTER TABLE agent_sessions ADD COLUMN claude_session_id TEXT;

-- Add context column to nodes table (v1.2)
ALTER TABLE nodes ADD COLUMN context TEXT;
-- Add worktree_status column for async worktree operations (v1.2)
ALTER TABLE nodes ADD COLUMN worktree_status TEXT DEFAULT 'ready';
"#;
