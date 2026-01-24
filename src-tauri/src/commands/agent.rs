use crate::agents::{
    process::get_process_manager, AgentAdapterType, AgentSession, AgentSessionStatus,
    adapter::{AgentConfig, AgentMode, AttachmentData},
    streaming::OutputStreamer,
};
use crate::commands::repository::CommandResult;
use crate::db::{get_db_path, Database};
use crate::sentry_utils;
use chrono::Utc;
use log;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, State};

// ============================================================================
// RETRY LOGIC - Handle Claude Session ID persistence timing
// ============================================================================

/// Wait for Claude session ID to be persisted to database with exponential backoff
/// Polls up to 8 times with longer delays to handle Init event timing
/// This handles the race condition where the Init event is captured asynchronously
/// but resume_agent_with_input is called before the DB write completes
fn wait_for_claude_session_id(node_id: &str) -> Result<String, String> {
    // Increased retries and delays to give Init event more time
    let delays_ms = [100, 200, 300, 400, 500, 600, 700, 800]; // ~3.6s total

    for (attempt, delay) in delays_ms.iter().enumerate() {
        if let Some((claude_id, status)) = get_session_for_node(node_id) {
            // Check if we have a valid (non-empty, non-NULL) claude_session_id
            if !claude_id.is_empty() {
                log::info!(
                    "Found Claude session ID '{}' for node '{}' on attempt {} (status: {})",
                    claude_id,
                    node_id,
                    attempt + 1,
                    status
                );
                return Ok(claude_id);
            } else {
                log::debug!(
                    "Claude session ID is empty/NULL for node '{}' (attempt {}, status: {}). Waiting for Init event...",
                    node_id,
                    attempt + 1,
                    status
                );
            }
        } else {
            log::debug!(
                "No session found for node '{}' (attempt {}). Waiting...",
                node_id,
                attempt + 1
            );
        }

        if attempt < delays_ms.len() - 1 {
            thread::sleep(Duration::from_millis(*delay));
        }
    }

    // Final check with detailed error
    if let Some((claude_id, status)) = get_session_for_node(node_id) {
        if claude_id.is_empty() {
            Err(format!(
                "Claude session ID is still NULL/empty for node '{}' after {} attempts (status: {}). \
                The Init event may not have been received or parsed correctly.",
                node_id,
                delays_ms.len(),
                status
            ))
        } else {
            // Shouldn't reach here, but just in case
            Ok(claude_id)
        }
    } else {
        Err(format!(
            "No agent session found for node '{}' after {} attempts. The agent may not have been spawned.",
            node_id,
            delays_ms.len()
        ))
    }
}

// ============================================================================
// DATABASE OPERATIONS - Single Source of Truth
// ============================================================================

/// Clean up stale sessions on startup
/// Reset ALL session statuses to "idle" for a fresh start each app session
/// Agent status should reflect "what's happening NOW", not past session history
pub fn cleanup_stale_sessions() {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    // Reset all sessions to "idle" on app start
    // This gives users a clean slate - status reflects current session only
    // Past work history is preserved in git commits, not agent status
    let _ = conn.execute(
        "UPDATE agent_sessions SET status = 'idle', ended_at = NULL WHERE status != 'idle'",
        [],
    );
}

/// Get Claude session ID and status for a node
/// Returns (claude_session_id, status) if session exists
/// Note: claude_session_id may be empty string if Init event hasn't been captured yet
fn get_session_for_node(node_id: &str) -> Option<(String, String)> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).ok()?;

    // Use COALESCE to convert NULL to empty string for easier handling
    conn.query_row(
        "SELECT COALESCE(claude_session_id, ''), status FROM agent_sessions WHERE node_id = ?1",
        [node_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ).ok()
}

/// Create or update agent session in database
/// NOTE: claude_session_id is set to NULL initially - it will be populated by the Init event
/// from Claude CLI. Do NOT rely on the passed session_id being the Claude session ID!
fn upsert_agent_session(
    node_id: &str,
    workspace_id: &str,
    caspian_session_id: &str, // Renamed for clarity - this is NOT the Claude session ID
    adapter_type: &str,
    status: &str,
) -> Result<(), String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // IMPORTANT: We set claude_session_id to NULL on fresh insert.
    // The ACTUAL Claude session ID will be captured from the Init event in streaming.rs
    // and stored via update_claude_session_id().
    //
    // On conflict (same node_id), we:
    // - Update status and started_at
    // - Set claude_session_id to NULL so the new Init event can populate it
    //   (The old session ID is invalid for the new spawn anyway)
    conn.execute(
        "INSERT INTO agent_sessions (id, node_id, workspace_id, adapter_type, status, started_at, claude_session_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)
         ON CONFLICT(node_id) DO UPDATE SET
           id = excluded.id,
           status = excluded.status,
           started_at = excluded.started_at,
           claude_session_id = NULL",
        rusqlite::params![caspian_session_id, node_id, workspace_id, adapter_type, status, &now],
    ).map_err(|e| e.to_string())?;

    log::debug!(
        "Upserted agent session for node '{}' with caspian_id '{}', claude_session_id set to NULL (awaiting Init event)",
        node_id,
        caspian_session_id
    );

    Ok(())
}

/// Update agent session status in database
pub fn update_session_status(node_id: &str, status: &str, success: bool) {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(_) => return,
    };

    let now = Utc::now().to_rfc3339();
    let final_status = if success { status } else { "failed" };

    let _ = conn.execute(
        "UPDATE agent_sessions SET status = ?1, ended_at = ?2 WHERE node_id = ?3",
        rusqlite::params![final_status, &now, node_id],
    );
}

/// Update the Claude session ID for a node (called when receiving Init event from Claude Code)
/// This is CRITICAL for session resume functionality - the claude_session_id must match
/// what Claude CLI actually uses, not what we passed with --session-id
pub fn update_claude_session_id(node_id: &str, claude_session_id: &str) {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!(
                "Failed to open DB connection for updating claude_session_id: {} (node: {})",
                e,
                node_id
            );
            return;
        }
    };

    // Perform the update
    match conn.execute(
        "UPDATE agent_sessions SET claude_session_id = ?1 WHERE node_id = ?2",
        rusqlite::params![claude_session_id, node_id],
    ) {
        Ok(rows_affected) => {
            if rows_affected == 0 {
                log::warn!(
                    "update_claude_session_id: No rows updated for node {}. Session may not exist yet.",
                    node_id
                );
            } else {
                log::info!(
                    "Successfully updated claude_session_id to '{}' for node '{}' ({} rows)",
                    claude_session_id,
                    node_id,
                    rows_affected
                );
            }
        }
        Err(e) => {
            log::error!(
                "Failed to update claude_session_id for node {}: {}",
                node_id,
                e
            );
        }
    }
}

/// Get agent session from database (the source of truth)
fn get_session_from_db(node_id: &str) -> Option<AgentSession> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).ok()?;

    conn.query_row(
        "SELECT id, node_id, adapter_type, process_id, status, started_at, ended_at, claude_session_id
         FROM agent_sessions WHERE node_id = ?1",
        [node_id],
        |row| {
            let adapter_str: String = row.get(2)?;
            let status_str: String = row.get(4)?;

            Ok(AgentSession {
                id: row.get(0)?,
                node_id: row.get(1)?,
                adapter_type: AgentAdapterType::from_str(&adapter_str).unwrap_or(AgentAdapterType::ClaudeCode),
                process_id: row.get(3)?,
                status: AgentSessionStatus::from_str(&status_str).unwrap_or(AgentSessionStatus::Running),
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        },
    ).ok()
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Attachment data from frontend
#[derive(Debug, serde::Deserialize)]
pub struct AttachmentInput {
    pub name: String,
    pub content: Option<String>, // Base64 encoded
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: usize,
}

/// Spawn an agent for a node
#[tauri::command]
pub fn spawn_agent(
    app: AppHandle,
    workspace_id: String,
    node_id: String,
    adapter_type: String,
    goal: String,
    working_dir: String,
    context: Option<String>,
    attachments: Option<Vec<AttachmentInput>>,
    model: Option<String>,
    agent_mode: Option<String>,
) -> CommandResult<AgentSession> {
    let adapter = match AgentAdapterType::from_str(&adapter_type) {
        Some(a) => a,
        None => {
            return CommandResult::err(&format!("Invalid adapter type: {}", adapter_type));
        }
    };

    // Check if there's already a running agent for this node
    if let Some(existing) = get_session_from_db(&node_id) {
        if existing.status == AgentSessionStatus::Running {
            // Check if it's actually still running in ProcessManager
            if get_process_manager().get_session_for_node(&node_id).is_some() {
                return CommandResult::err("Agent already running for this node");
            }
            // Otherwise, the process died but DB wasn't updated - we'll update it
            update_session_status(&node_id, "failed", false);
        }
    }

    let mut config = AgentConfig::new(node_id.clone(), PathBuf::from(working_dir), goal);

    if let Some(ctx) = context {
        config = config.with_context(ctx);
    }

    // Convert attachments from frontend format to backend format
    log::debug!("Received attachments: {:?}", attachments.as_ref().map(|a| a.len()));
    if let Some(atts) = attachments {
        log::debug!("Processing {} attachments", atts.len());
        for att in &atts {
            log::debug!("Attachment: name={}, has_content={}, size={}",
                att.name, att.content.is_some(), att.size);
        }

        let attachment_data: Vec<AttachmentData> = atts
            .into_iter()
            .filter_map(|a| {
                a.content.map(|content| AttachmentData {
                    name: a.name,
                    content,
                    file_type: a.file_type,
                    size: a.size,
                })
            })
            .collect();

        log::debug!("Converted {} attachments with content", attachment_data.len());
        if !attachment_data.is_empty() {
            config = config.with_attachments(attachment_data);
        }
    } else {
        log::debug!("No attachments received");
    }

    // Set model if provided
    if let Some(m) = model {
        log::info!("Using model: {}", m);
        config = config.with_model(m);
    }

    // Set agent mode if provided
    if let Some(mode_str) = agent_mode {
        if let Some(mode) = AgentMode::from_str(&mode_str) {
            log::info!("Using agent mode: {:?}", mode);
            config = config.with_agent_mode(mode);
        } else {
            log::warn!("Invalid agent mode: {}, using default", mode_str);
        }
    }

    // Check for existing session to resume (only for Claude Code adapter)
    // Only resume if we have a valid (non-empty) claude_session_id
    if adapter == AgentAdapterType::ClaudeCode {
        if let Some((existing_session_id, status)) = get_session_for_node(&node_id) {
            if !existing_session_id.is_empty() {
                log::info!(
                    "Found existing Claude session '{}' for node '{}' (status: {}), will resume",
                    existing_session_id,
                    node_id,
                    status
                );
                config = config.with_resume_session(existing_session_id);
            } else {
                log::debug!(
                    "Existing session for node '{}' has no claude_session_id (status: {}), starting fresh",
                    node_id,
                    status
                );
            }
        }
    }

    // Add breadcrumb for agent spawn attempt
    sentry_utils::add_breadcrumb("agent", &format!("Spawning agent for node: {}", node_id), sentry::Level::Info);

    match get_process_manager().spawn_agent(adapter, config) {
        Ok(session) => {
            // Store/update session in database with 'running' status
            if let Err(e) = upsert_agent_session(
                &node_id,
                &workspace_id,
                &session.id,
                adapter.as_str(),
                "running",
            ) {
                sentry_utils::capture_error(&e, "agent_session_db_store");
                log::error!("Failed to store session in DB: {}", e);
            }

            // Start streaming output to frontend
            if let Some(rx) = get_process_manager().take_receiver(&session.id) {
                let streamer = OutputStreamer::new(
                    session.id.clone(),
                    workspace_id,
                    node_id,
                );
                streamer.start_streaming(app, rx);
            }

            CommandResult::ok(session)
        }
        Err(e) => {
            sentry_utils::capture_error(&e, "agent_spawn_failed");
            CommandResult::err(&e.to_string())
        }
    }
}

/// Terminate an agent by session ID
#[tauri::command]
pub fn terminate_agent(session_id: String) -> CommandResult<()> {
    sentry_utils::add_breadcrumb("agent", &format!("Terminating agent: {}", session_id), sentry::Level::Info);

    match get_process_manager().terminate_agent(&session_id) {
        Ok(()) => CommandResult::ok(()),
        Err(e) => {
            sentry_utils::capture_error(&e, "agent_terminate_failed");
            CommandResult::err(&e.to_string())
        }
    }
}

/// Terminate the agent running on a node
#[tauri::command]
pub fn terminate_agent_for_node(node_id: String) -> CommandResult<()> {
    sentry_utils::add_breadcrumb("agent", &format!("Terminating agent for node: {}", node_id), sentry::Level::Info);

    // Update DB status
    update_session_status(&node_id, "terminated", false);

    match get_process_manager().terminate_agent_for_node(&node_id) {
        Ok(()) => CommandResult::ok(()),
        Err(e) => {
            sentry_utils::capture_error(&e, "agent_terminate_for_node_failed");
            CommandResult::err(&e.to_string())
        }
    }
}

/// Get the agent session for a node - queries DATABASE (source of truth)
#[tauri::command]
pub fn get_agent_status(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Option<AgentSession>> {
    // Query database for session status using shared connection
    let conn = db.conn.lock().unwrap();

    let session = conn.query_row(
        "SELECT id, node_id, adapter_type, process_id, status, started_at, ended_at, claude_session_id
         FROM agent_sessions WHERE node_id = ?1",
        [&node_id],
        |row| {
            let adapter_str: String = row.get(2)?;
            let status_str: String = row.get(4)?;

            Ok(AgentSession {
                id: row.get(0)?,
                node_id: row.get(1)?,
                adapter_type: AgentAdapterType::from_str(&adapter_str).unwrap_or(AgentAdapterType::ClaudeCode),
                process_id: row.get(3)?,
                status: AgentSessionStatus::from_str(&status_str).unwrap_or(AgentSessionStatus::Running),
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
            })
        },
    ).ok();

    // Drop lock before checking process manager
    drop(conn);

    // If DB says running, verify with ProcessManager
    if let Some(ref s) = session {
        if s.status == AgentSessionStatus::Running {
            if get_process_manager().get_session_for_node(&node_id).is_none() {
                // Process died but DB wasn't updated - fix it
                update_session_status(&node_id, "failed", false);
                // Return updated session
                return CommandResult::ok(get_session_from_db(&node_id));
            }
        }
    }

    CommandResult::ok(session)
}

/// List all agent sessions - queries DATABASE
#[tauri::command]
pub fn list_active_agents(db: State<'_, Arc<Database>>) -> CommandResult<Vec<AgentSession>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = match conn.prepare(
        "SELECT id, node_id, adapter_type, process_id, status, started_at, ended_at
         FROM agent_sessions ORDER BY started_at DESC"
    ) {
        Ok(s) => s,
        Err(_) => return CommandResult::ok(vec![]),
    };

    let sessions = stmt.query_map([], |row| {
        let adapter_str: String = row.get(2)?;
        let status_str: String = row.get(4)?;

        Ok(AgentSession {
            id: row.get(0)?,
            node_id: row.get(1)?,
            adapter_type: AgentAdapterType::from_str(&adapter_str).unwrap_or(AgentAdapterType::ClaudeCode),
            process_id: row.get(3)?,
            status: AgentSessionStatus::from_str(&status_str).unwrap_or(AgentSessionStatus::Running),
            started_at: row.get(5)?,
            ended_at: row.get(6)?,
        })
    });

    match sessions {
        Ok(iter) => CommandResult::ok(iter.filter_map(|r| r.ok()).collect()),
        Err(_) => CommandResult::ok(vec![]),
    }
}

/// Get agent status for multiple nodes at once (batch query to avoid N+1)
#[tauri::command]
pub fn get_agent_statuses_batch(node_ids: Vec<String>, db: State<'_, Arc<Database>>) -> CommandResult<Vec<AgentSession>> {
    if node_ids.is_empty() {
        return CommandResult::ok(vec![]);
    }

    let conn = db.conn.lock().unwrap();

    // Build a query with placeholders for all node IDs
    let placeholders: Vec<String> = node_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let query = format!(
        "SELECT id, node_id, adapter_type, process_id, status, started_at, ended_at
         FROM agent_sessions WHERE node_id IN ({})",
        placeholders.join(", ")
    );

    let mut stmt = match conn.prepare(&query) {
        Ok(s) => s,
        Err(_) => return CommandResult::ok(vec![]),
    };

    // Convert node_ids to params
    let params: Vec<&dyn rusqlite::ToSql> = node_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let sessions = stmt.query_map(params.as_slice(), |row| {
        let adapter_str: String = row.get(2)?;
        let status_str: String = row.get(4)?;

        Ok(AgentSession {
            id: row.get(0)?,
            node_id: row.get(1)?,
            adapter_type: AgentAdapterType::from_str(&adapter_str).unwrap_or(AgentAdapterType::ClaudeCode),
            process_id: row.get(3)?,
            status: AgentSessionStatus::from_str(&status_str).unwrap_or(AgentSessionStatus::Running),
            started_at: row.get(5)?,
            ended_at: row.get(6)?,
        })
    });

    match sessions {
        Ok(iter) => CommandResult::ok(iter.filter_map(|r| r.ok()).collect()),
        Err(_) => CommandResult::ok(vec![]),
    }
}

/// Check which adapters are available
#[tauri::command]
pub fn get_available_adapters() -> CommandResult<Vec<String>> {
    let adapters = get_process_manager()
        .get_available_adapters()
        .into_iter()
        .map(|a| a.as_str().to_string())
        .collect();
    CommandResult::ok(adapters)
}

/// Check if a specific adapter is available
#[tauri::command]
pub fn is_adapter_available(adapter_type: String) -> CommandResult<bool> {
    let adapter = match AgentAdapterType::from_str(&adapter_type) {
        Some(a) => a,
        None => return CommandResult::ok(false),
    };

    let available = get_process_manager().is_adapter_available(adapter);
    CommandResult::ok(available)
}

/// Diagnostic information for troubleshooting agent issues
#[derive(Debug, serde::Serialize)]
pub struct AgentDiagnostics {
    pub claude_cli_found: bool,
    pub claude_cli_version: Option<String>,
    pub claude_cli_path: Option<String>,
    pub claude_config_exists: bool,
    pub claude_config_path: Option<String>,
    pub home_dir: Option<String>,
    pub system_path: String,
    pub errors: Vec<String>,
}

/// Run diagnostics to check if the agent environment is properly configured
/// This helps troubleshoot why agents might not be working in release builds
#[tauri::command]
pub fn run_agent_diagnostics() -> CommandResult<AgentDiagnostics> {
    use std::process::Command;

    sentry_utils::add_breadcrumb("agent", "Running agent diagnostics", sentry::Level::Info);

    // Get home directory in platform-appropriate way
    #[cfg(target_os = "windows")]
    let home_dir = std::env::var("USERPROFILE").ok();
    #[cfg(not(target_os = "windows"))]
    let home_dir = std::env::var("HOME").ok();

    let mut diagnostics = AgentDiagnostics {
        claude_cli_found: false,
        claude_cli_version: None,
        claude_cli_path: None,
        claude_config_exists: false,
        claude_config_path: None,
        home_dir: home_dir.clone(),
        system_path: std::env::var("PATH").unwrap_or_else(|_| "PATH not set".to_string()),
        errors: Vec::new(),
    };

    // Check 1: Find Claude CLI binary
    // Try common locations
    let mut binary_locations: Vec<String> = vec![
        "claude".to_string(),                           // In PATH
    ];

    // Platform-specific paths
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            binary_locations.push(format!("{}\\npm\\claude.cmd", appdata));
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            binary_locations.push(format!("{}\\AppData\\Roaming\\npm\\claude.cmd", userprofile));
            binary_locations.push(format!("{}\\.local\\bin\\claude.exe", userprofile));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        binary_locations.push("/usr/local/bin/claude".to_string());           // Homebrew default
        binary_locations.push("/opt/homebrew/bin/claude".to_string());        // Apple Silicon Homebrew
        if let Ok(home) = std::env::var("HOME") {
            binary_locations.push(format!("{}/.local/bin/claude", home));  // npm global default
            binary_locations.push(format!("{}/bin/claude", home));         // user bin
        }
    }

    for location in &binary_locations {
        if let Ok(output) = Command::new(location).arg("--version").output() {
            if output.status.success() {
                diagnostics.claude_cli_found = true;
                diagnostics.claude_cli_version = Some(
                    String::from_utf8_lossy(&output.stdout).trim().to_string()
                );
                diagnostics.claude_cli_path = Some(location.to_string());
                break;
            }
        }
    }

    if !diagnostics.claude_cli_found {
        diagnostics.errors.push(
            "Claude CLI not found in PATH or common installation locations. \
            Install with: npm install -g @anthropic/claude-code".to_string()
        );
    }

    // Check 2: Verify Claude config directory exists (Claude CLI manages its own authentication)
    // Use platform-appropriate home directory
    #[cfg(target_os = "windows")]
    let home_for_config = std::env::var("USERPROFILE").ok();
    #[cfg(not(target_os = "windows"))]
    let home_for_config = home_dir.clone();

    if let Some(ref home) = home_for_config {
        let claude_config = std::path::Path::new(home).join(".claude");
        diagnostics.claude_config_path = Some(claude_config.to_string_lossy().to_string());

        if claude_config.exists() {
            diagnostics.claude_config_exists = true;

            // Check for signs that Claude is properly set up
            // Claude CLI stores auth differently - presence of settings.json or projects/ indicates setup
            let settings_file = claude_config.join("settings.json");
            let projects_dir = claude_config.join("projects");
            let history_file = claude_config.join("history.jsonl");

            if settings_file.exists() || projects_dir.exists() || history_file.exists() {
                // Claude is properly configured
                log::info!("✓ Claude appears to be authenticated (found config files)");
            } else {
                // No config files found - might need initial setup
                diagnostics.errors.push(
                    "Claude config directory exists but appears empty. \
                    Run 'claude' in terminal to complete setup.".to_string()
                );
            }
        } else {
            diagnostics.claude_config_exists = false;
            diagnostics.errors.push(format!(
                "Claude config directory not found at {}. \
                Run 'claude' in terminal to authenticate first.",
                claude_config.to_string_lossy()
            ));
        }
    } else {
        diagnostics.errors.push(
            "HOME environment variable not set. Cannot locate Claude config.".to_string()
        );
    }

    log::info!("Agent diagnostics: {:?}", diagnostics);

    CommandResult::ok(diagnostics)
}

/// Resume an agent session with user input
/// This is used when the agent asks a question and waits for user response
#[tauri::command]
pub fn resume_agent_with_input(
    app: AppHandle,
    workspace_id: String,
    node_id: String,
    _session_id: String,
    working_dir: String,
    user_input: String,
    model: Option<String>,
) -> CommandResult<AgentSession> {
    sentry_utils::add_breadcrumb(
        "agent",
        &format!("Resuming agent for node {} with user input", node_id),
        sentry::Level::Info,
    );

    // Terminate any existing process for this node first
    let _ = get_process_manager().terminate_agent_for_node(&node_id);

    // Wait for Claude session ID with retry logic (handles race condition)
    sentry_utils::add_breadcrumb(
        "agent",
        &format!("Waiting for Claude session ID for node {}", node_id),
        sentry::Level::Info,
    );

    let claude_session_id = match wait_for_claude_session_id(&node_id) {
        Ok(id) => {
            log::info!("Successfully retrieved Claude session ID: {}", id);
            id
        }
        Err(e) => {
            let error_msg = format!("Cannot resume agent: {}", e);
            log::error!("{}", error_msg);
            sentry_utils::capture_error(&error_msg, "claude_session_not_ready");
            return CommandResult::err(&error_msg);
        }
    };

    // Validate session ID is not empty
    if claude_session_id.is_empty() {
        let error_msg = format!(
            "Invalid Claude session ID for node {}. The agent initialization may have failed.",
            node_id
        );
        log::error!("{}", error_msg);
        return CommandResult::err(&error_msg);
    }

    log::info!(
        "Resuming agent with Claude session ID: {} for node: {}",
        claude_session_id,
        node_id
    );

    // Create config with resume session and user input as the prompt
    let mut config = AgentConfig::new(
        node_id.clone(),
        PathBuf::from(working_dir.clone()),
        user_input.clone(), // User's selection becomes the prompt
    )
    .with_resume_session(claude_session_id.clone());

    // Set model if provided
    if let Some(ref m) = model {
        log::info!("Using model for resume: {}", m);
        config = config.with_model(m.clone());
    }

    // Spawn the agent with retry logic for transient API errors (e.g., 404 model not found)
    let max_retries = 3;
    let retry_delays_ms = [500, 1000, 2000]; // Exponential backoff

    let mut last_error = String::new();
    for attempt in 0..max_retries {
        if attempt > 0 {
            log::info!(
                "Retrying agent spawn (attempt {}/{}) after transient error",
                attempt + 1,
                max_retries
            );
            thread::sleep(Duration::from_millis(retry_delays_ms[attempt - 1]));

            // Recreate config for retry (config is consumed by spawn_agent)
            config = AgentConfig::new(
                node_id.clone(),
                PathBuf::from(working_dir.clone()),
                user_input.clone(),
            )
            .with_resume_session(claude_session_id.clone());

            if let Some(ref m) = model {
                config = config.with_model(m.clone());
            }
        }

        match get_process_manager().spawn_agent(AgentAdapterType::ClaudeCode, config) {
            Ok(session) => {
                // Update session in database with 'running' status
                if let Err(e) = upsert_agent_session(
                    &node_id,
                    &workspace_id,
                    &session.id,
                    AgentAdapterType::ClaudeCode.as_str(),
                    "running",
                ) {
                    sentry_utils::capture_error(&e, "agent_resume_session_db_store");
                    log::error!("Failed to update session in DB: {}", e);
                }

                // Start streaming output to frontend
                if let Some(rx) = get_process_manager().take_receiver(&session.id) {
                    let streamer = OutputStreamer::new(
                        session.id.clone(),
                        workspace_id,
                        node_id,
                    );
                    streamer.start_streaming(app, rx);
                }

                return CommandResult::ok(session);
            }
            Err(e) => {
                last_error = e.to_string();
                // Check if this is a transient error worth retrying
                let is_transient = last_error.contains("404")
                    || last_error.contains("not_found")
                    || last_error.contains("temporarily unavailable")
                    || last_error.contains("service unavailable")
                    || last_error.contains("503")
                    || last_error.contains("502");

                if is_transient && attempt < max_retries - 1 {
                    log::warn!(
                        "Transient error on attempt {}: {}. Will retry...",
                        attempt + 1,
                        last_error
                    );
                    // Continue to next iteration for retry
                    // Need to recreate config since it was moved
                    config = AgentConfig::new(
                        node_id.clone(),
                        PathBuf::from(working_dir.clone()),
                        user_input.clone(),
                    )
                    .with_resume_session(claude_session_id.clone());

                    if let Some(ref m) = model {
                        config = config.with_model(m.clone());
                    }
                    continue;
                } else {
                    // Non-transient error or max retries reached
                    sentry_utils::capture_error(&last_error, "agent_resume_failed");
                    return CommandResult::err(&last_error);
                }
            }
        }
    }

    // Should not reach here, but just in case
    sentry_utils::capture_error(&last_error, "agent_resume_failed_max_retries");
    CommandResult::err(&format!(
        "Failed to resume agent after {} retries: {}",
        max_retries, last_error
    ))
}

/// Pending user input data returned to frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct PendingUserInputData {
    pub tool_id: String,
    pub question: String,
    pub header: Option<String>,
    pub options: Vec<crate::agents::json_types::UserInputOption>,
    pub multi_select: bool,
    pub message_id: String,
}

/// Get pending user input for a node if status is "pending"
/// This queries the messages table for the last user_input_request event
/// and parses the content to restore the UI state
#[tauri::command]
pub fn get_pending_user_input(
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Option<PendingUserInputData>> {
    let conn = db.conn.lock().unwrap();

    // First check if the session status is actually "pending"
    let status: Option<String> = conn
        .query_row(
            "SELECT status FROM agent_sessions WHERE node_id = ?1",
            [&node_id],
            |row| row.get(0),
        )
        .ok();

    if status.as_deref() != Some("pending") {
        return CommandResult::ok(None);
    }

    // Query for the last message with user_input_request event type
    let result: Option<(String, String)> = conn
        .query_row(
            "SELECT content, metadata FROM messages
             WHERE node_id = ?1
             AND metadata LIKE '%user_input_request%'
             ORDER BY created_at DESC
             LIMIT 1",
            [&node_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    drop(conn);

    if let Some((content, _metadata)) = result {
        // Parse the Claude event JSON to extract AskUserQuestion data
        if let Some(pending_input) = parse_ask_user_question_from_content(&content) {
            return CommandResult::ok(Some(pending_input));
        }
    }

    CommandResult::ok(None)
}

/// Parse the raw Claude JSON output to extract AskUserQuestion tool data
fn parse_ask_user_question_from_content(content: &str) -> Option<PendingUserInputData> {
    use crate::agents::json_types::{parse_claude_event, ClaudeEvent, ContentBlock, UserInputOption};

    let event = parse_claude_event(content)?;

    match event {
        ClaudeEvent::Assistant(assistant) => {
            let message_id = assistant.message.id.clone();

            // Find the AskUserQuestion tool use block
            for block in assistant.message.content {
                if let ContentBlock::ToolUse { id, name, input } = block {
                    if name == "AskUserQuestion" {
                        // Parse the questions array from input
                        let questions = input.get("questions")?.as_array()?;
                        let first_question = questions.first()?;

                        let question_text = first_question.get("question")?.as_str()?.to_string();
                        let header = first_question
                            .get("header")
                            .and_then(|h| h.as_str())
                            .map(|s| s.to_string());
                        let multi_select = first_question
                            .get("multiSelect")
                            .and_then(|m| m.as_bool())
                            .unwrap_or(false);

                        // Parse options
                        let options_array = first_question.get("options")?.as_array()?;
                        let options: Vec<UserInputOption> = options_array
                            .iter()
                            .filter_map(|opt| {
                                let label = opt.get("label")?.as_str()?.to_string();
                                let description = opt
                                    .get("description")
                                    .and_then(|d| d.as_str())
                                    .map(|s| s.to_string());
                                Some(UserInputOption { label, description })
                            })
                            .collect();

                        if options.is_empty() {
                            return None;
                        }

                        return Some(PendingUserInputData {
                            tool_id: id,
                            question: question_text,
                            header,
                            options,
                            multi_select,
                            message_id,
                        });
                    }
                }
            }
        }
        _ => {}
    }

    None
}
