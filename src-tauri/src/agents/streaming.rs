use super::adapter::{AgentOutput, AgentOutputType};
use super::json_types::{
    parse_claude_event, ClaudeEvent, ContentBlock, StructuredEvent, UserInputOption,
};
use crate::chat::{MessageType, SenderType};
use crate::commands::agent::{update_claude_session_id, update_session_status};
use crate::db::get_db_path;
use chrono::Utc;
use log;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use std::thread;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Event payload for agent output
#[derive(Debug, Clone, Serialize)]
pub struct AgentOutputEvent {
    pub session_id: String,
    pub node_id: String,
    pub output_type: String,
    pub content: String,
    pub timestamp: String,
    /// Structured event data (when JSON parsing succeeds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured: Option<StructuredEvent>,
}

/// Tracks active tool calls for duration calculation
struct ToolCallTracker {
    /// Maps tool_use_id to (tool_name, start_time, message_id)
    active_tools: HashMap<String, (String, Instant, String)>,
}

impl ToolCallTracker {
    fn new() -> Self {
        Self {
            active_tools: HashMap::new(),
        }
    }

    fn start_tool(&mut self, id: String, name: String, message_id: String) {
        self.active_tools
            .insert(id, (name, Instant::now(), message_id));
    }

    fn complete_tool(&mut self, id: &str) -> Option<(String, u64, String)> {
        self.active_tools.remove(id).map(|(name, start, msg_id)| {
            let duration_ms = start.elapsed().as_millis() as u64;
            (name, duration_ms, msg_id)
        })
    }
}

/// Event payload for agent completion
#[derive(Debug, Clone, Serialize)]
pub struct AgentCompleteEvent {
    pub session_id: String,
    pub node_id: String,
    pub success: bool,
    pub message: Option<String>,
    /// Node display name for notifications
    pub node_name: Option<String>,
    /// Node context (auto-generated summary) for notifications
    pub node_context: Option<String>,
}

/// Extract context from latest messages, update DB, and return node display info
/// This ensures the notification shows the NEW context after agent completion
fn get_node_display_info(node_id: &str) -> (Option<String>, Option<String>) {
    let db_path = get_db_path();

    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(_) => return (None, None),
    };

    // First, extract [CONTEXT: ...] from the latest agent messages
    let extracted_context = extract_context_from_messages(&conn, node_id);

    // If we found a new context, update the node in the database
    if let Some(ref ctx) = extracted_context {
        let _ = conn.execute(
            "UPDATE nodes SET context = ?1 WHERE id = ?2",
            rusqlite::params![ctx, node_id],
        );
    }

    // Now fetch the (possibly updated) node info
    let result: Result<(Option<String>, Option<String>), _> = conn.query_row(
        "SELECT display_name, context FROM nodes WHERE id = ?1",
        [node_id],
        |row| Ok((row.get(0).ok(), row.get(1).ok())),
    );

    result.unwrap_or((None, None))
}

/// Extract [CONTEXT: ...] marker from the latest agent messages for a node
fn extract_context_from_messages(conn: &Connection, node_id: &str) -> Option<String> {
    // Query the latest agent messages (most recent first)
    let mut stmt = match conn.prepare(
        "SELECT content FROM messages
         WHERE node_id = ?1 AND sender_type = 'agent'
         ORDER BY created_at DESC
         LIMIT 10"
    ) {
        Ok(s) => s,
        Err(_) => return None,
    };

    let messages: Vec<String> = stmt
        .query_map([node_id], |row| row.get(0))
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    // Simple string-based extraction of [CONTEXT: ...] marker
    for content in messages {
        if let Some(context) = extract_context_marker(&content) {
            return Some(context);
        }
    }

    None
}

/// Extract content between [CONTEXT: and ] from a string
fn extract_context_marker(content: &str) -> Option<String> {
    // Case-insensitive search for [CONTEXT:
    let lower = content.to_lowercase();
    let start_marker = "[context:";

    if let Some(start_idx) = lower.find(start_marker) {
        let after_marker = start_idx + start_marker.len();
        if let Some(end_idx) = content[after_marker..].find(']') {
            let context = content[after_marker..after_marker + end_idx].trim();
            if !context.is_empty() {
                return Some(context.to_string());
            }
        }
    }
    None
}

/// Streams agent output to the frontend via Tauri events
pub struct OutputStreamer {
    session_id: String,
    workspace_id: String,
    node_id: String,
}

impl OutputStreamer {
    pub fn new(session_id: String, workspace_id: String, node_id: String) -> Self {
        Self {
            session_id,
            workspace_id,
            node_id,
        }
    }

    /// Start streaming output from a receiver to Tauri events
    /// This spawns a background thread that continuously reads from the receiver
    /// and also inserts messages into the chat database
    pub fn start_streaming(self, app: AppHandle, rx: Receiver<AgentOutput>) {
        let session_id = self.session_id;
        let workspace_id = self.workspace_id;
        let node_id = self.node_id;

        thread::spawn(move || {
            let event_name = format!("agent:output:{}", node_id);
            let mut tool_tracker = ToolCallTracker::new();
            let mut current_message_id: Option<String> = None;
            // Buffer for accumulating text content within a message
            let mut text_buffer = String::new();
            // Track if a UserInputRequest was detected (agent waiting for user input)
            let mut pending_user_input = false;
            // Deduplication: only emit agent:complete once per session
            let mut complete_emitted = false;

            loop {
                match rx.recv() {
                    Ok(output) => {
                        // Clone content for potential later use in error message
                        let content_for_error = output.content.clone();

                        // Try to parse as JSON (Claude Code stream-json output)
                        let structured_event = if output.output_type == AgentOutputType::Stdout {
                            parse_and_process_json(
                                &output.content,
                                &mut tool_tracker,
                                &mut current_message_id,
                                &mut text_buffer,
                            )
                        } else {
                            None
                        };

                        // Capture Claude session ID from Init event and store in database
                        // CRITICAL: Claude CLI generates its OWN session ID, ignoring --session-id
                        // We MUST capture the Init event's session_id for --resume to work
                        if let Some(StructuredEvent::Init {
                            session_id: claude_session_id,
                            ..
                        }) = &structured_event
                        {
                            log::info!(
                                "[INIT EVENT] Captured Claude session ID: '{}' for node: '{}' (session: {})",
                                claude_session_id,
                                node_id,
                                session_id
                            );

                            if claude_session_id.is_empty() {
                                log::error!(
                                    "[INIT EVENT] WARNING: Claude session ID is EMPTY for node: {}. Resume will fail!",
                                    node_id
                                );
                            } else {
                                update_claude_session_id(&node_id, claude_session_id);
                                log::info!(
                                    "[INIT EVENT] Called update_claude_session_id for node: {} with ID: {}",
                                    node_id,
                                    claude_session_id
                                );
                            }
                        }

                        // Check if this is a UserInputRequest event
                        if let Some(StructuredEvent::UserInputRequest { .. }) = &structured_event {
                            pending_user_input = true;
                        }

                        // Determine message type based on output type
                        let (message_type, should_insert) = match output.output_type {
                            AgentOutputType::Stdout => (MessageType::Code, true),
                            AgentOutputType::Stderr => (MessageType::Error, true),
                            AgentOutputType::System => (MessageType::System, true),
                            AgentOutputType::Complete => (MessageType::System, false),
                            AgentOutputType::Error => (MessageType::Error, true),
                            AgentOutputType::Pending => (MessageType::System, true),
                        };

                        // Insert message into chat database (for significant output)
                        // For structured content, include metadata flag so frontend can parse it
                        // Also mark internal messages (init, complete, raw stdout, system) so UI can filter them
                        let is_internal = match &structured_event {
                            Some(StructuredEvent::Init { .. }) => true,
                            Some(StructuredEvent::Complete { .. }) => true,
                            Some(StructuredEvent::Thinking { .. }) => false,
                            Some(StructuredEvent::Text { .. }) => false,
                            Some(StructuredEvent::ToolStart { .. }) => false,
                            Some(StructuredEvent::ToolComplete { .. }) => false,
                            Some(StructuredEvent::UserInputRequest { .. }) => false,
                            None if output.output_type == AgentOutputType::Stdout => true, // Raw CLI output
                            None if output.output_type == AgentOutputType::System => true, // System messages (e.g. "Agent started")
                            None => false,
                        };

                        let metadata = if structured_event.is_some() {
                            let event_type = structured_event
                                .as_ref()
                                .map(|e| match e {
                                    StructuredEvent::Init { .. } => "init",
                                    StructuredEvent::Thinking { .. } => "thinking",
                                    StructuredEvent::ToolStart { .. } => "tool_start",
                                    StructuredEvent::ToolComplete { .. } => "tool_complete",
                                    StructuredEvent::Text { .. } => "text",
                                    StructuredEvent::Complete { .. } => "complete",
                                    StructuredEvent::UserInputRequest { .. } => {
                                        "user_input_request"
                                    }
                                })
                                .unwrap_or("unknown");
                            Some(json!({
                                "structured": true,
                                "event_type": event_type,
                                "internal": is_internal
                            }))
                        } else if is_internal {
                            Some(json!({ "internal": true }))
                        } else {
                            None
                        };

                        if should_insert && !output.content.trim().is_empty() {
                            insert_agent_message(
                                &workspace_id,
                                &node_id,
                                &session_id,
                                &output.content,
                                message_type,
                                metadata,
                            );
                        }

                        let event = AgentOutputEvent {
                            session_id: session_id.clone(),
                            node_id: node_id.clone(),
                            output_type: match output.output_type {
                                AgentOutputType::Stdout => "stdout".to_string(),
                                AgentOutputType::Stderr => "stderr".to_string(),
                                AgentOutputType::System => "system".to_string(),
                                AgentOutputType::Complete => "complete".to_string(),
                                AgentOutputType::Error => "error".to_string(),
                                AgentOutputType::Pending => "pending".to_string(),
                            },
                            content: output.content,
                            timestamp: output.timestamp,
                            structured: structured_event,
                        };

                        // Emit to branch-specific channel
                        let _ = app.emit(&event_name, &event);

                        // Also emit to global channel for UI that needs all output
                        let _ = app.emit("agent:output", &event);

                        // Check if this is a completion event
                        if output.output_type == AgentOutputType::Complete {
                            // Update DB status to completed
                            update_session_status(&node_id, "completed", true);

                            // Only emit once per session (deduplication)
                            if !complete_emitted {
                                #[allow(unused_assignments)]
                                { complete_emitted = true; }
                                let (node_name, node_context) = get_node_display_info(&node_id);
                                let complete_event = AgentCompleteEvent {
                                    session_id: session_id.clone(),
                                    node_id: node_id.clone(),
                                    success: true,
                                    message: Some("Agent completed successfully".to_string()),
                                    node_name,
                                    node_context,
                                };
                                let _ = app.emit("agent:complete", &complete_event);
                            }
                            break;
                        }

                        // Check if this is an error completion
                        if output.output_type == AgentOutputType::Error {
                            // Update DB status to failed
                            update_session_status(&node_id, "failed", false);

                            // Only emit once per session (deduplication)
                            if !complete_emitted {
                                #[allow(unused_assignments)]
                                { complete_emitted = true; }
                                let (node_name, node_context) = get_node_display_info(&node_id);
                                let complete_event = AgentCompleteEvent {
                                    session_id: session_id.clone(),
                                    node_id: node_id.clone(),
                                    success: false,
                                    message: Some(content_for_error),
                                    node_name,
                                    node_context,
                                };
                                let _ = app.emit("agent:complete", &complete_event);
                            }
                            break;
                        }
                    }
                    Err(_) => {
                        // Channel closed - agent process ended
                        if pending_user_input {
                            // Agent is waiting for user input - mark as pending, don't emit completion
                            update_session_status(&node_id, "pending", true);
                            // Note: We intentionally don't emit agent:complete here
                            // because the agent is paused, not finished
                        } else {
                            // Normal completion
                            update_session_status(&node_id, "completed", true);

                            // Only emit once per session (deduplication)
                            if !complete_emitted {
                                #[allow(unused_assignments)]
                                { complete_emitted = true; }
                                let (node_name, node_context) = get_node_display_info(&node_id);
                                let complete_event = AgentCompleteEvent {
                                    session_id: session_id.clone(),
                                    node_id: node_id.clone(),
                                    success: true,
                                    message: Some("Agent process ended".to_string()),
                                    node_name,
                                    node_context,
                                };
                                let _ = app.emit("agent:complete", &complete_event);
                            }
                        }
                        break;
                    }
                }
            }

            // Clean up the handle from ProcessManager so new agents can spawn
            super::process::get_process_manager().remove_handle(&session_id);
        });
    }
}

/// Check if a duplicate message exists within a time window
fn check_duplicate_message(
    conn: &Connection,
    node_id: &str,
    session_id: &str,
    content: &str,
    message_type: &MessageType,
    window_seconds: i64,
) -> bool {
    // Calculate the time threshold (current time - window_seconds)
    let threshold = Utc::now() - chrono::Duration::seconds(window_seconds);
    let threshold_str = threshold.to_rfc3339();

    let query = "SELECT COUNT(*) FROM messages
                 WHERE node_id = ?1
                 AND sender_id = ?2
                 AND content = ?3
                 AND message_type = ?4
                 AND created_at > ?5";

    match conn.query_row(
        query,
        rusqlite::params![
            Some(node_id),
            Some(session_id),
            content,
            message_type.as_str(),
            &threshold_str,
        ],
        |row| row.get::<_, i64>(0),
    ) {
        Ok(count) => count > 0,
        Err(e) => {
            log::error!("Failed to check for duplicate message: {}", e);
            false // If check fails, allow insertion to proceed
        }
    }
}

/// Insert agent output as a chat message with optional metadata
fn insert_agent_message(
    workspace_id: &str,
    node_id: &str,
    session_id: &str,
    content: &str,
    message_type: MessageType,
    metadata: Option<serde_json::Value>,
) {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to open DB for agent message: {}", e);
            return;
        }
    };

    // Check for duplicates within 5 second window
    if check_duplicate_message(&conn, node_id, session_id, content, &message_type, 5) {
        // Duplicate found, skip insertion
        return;
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Convert metadata to JSON string if present
    let metadata_str = metadata.map(|m| m.to_string());

    let result = conn.execute(
        "INSERT INTO messages (id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            &id,
            workspace_id,
            Some(node_id),
            SenderType::Agent.as_str(),
            Some(session_id),
            content,
            message_type.as_str(),
            metadata_str,
            &now,
        ],
    );

    if let Err(e) = result {
        log::error!("Failed to insert agent message: {}", e);
    }
}

/// Parse a line of JSON output and convert to a StructuredEvent
fn parse_and_process_json(
    content: &str,
    tool_tracker: &mut ToolCallTracker,
    current_message_id: &mut Option<String>,
    _text_buffer: &mut String,
) -> Option<StructuredEvent> {
    let event = parse_claude_event(content)?;

    match event {
        ClaudeEvent::System(sys) => {
            // System init event
            if sys.subtype == "init" {
                return Some(StructuredEvent::Init {
                    session_id: sys.session_id.unwrap_or_default(),
                    model: sys.model,
                    tools: sys.tools,
                });
            }
            None
        }
        ClaudeEvent::Assistant(assistant) => {
            let message_id = assistant.message.id.clone();
            *current_message_id = Some(message_id.clone());

            // Process content blocks and return the first significant event
            // (In practice, the frontend should handle multiple blocks per message)
            for block in assistant.message.content {
                match block {
                    ContentBlock::Thinking { thinking, .. } => {
                        return Some(StructuredEvent::Thinking {
                            content: thinking,
                            message_id: message_id.clone(),
                        });
                    }
                    ContentBlock::ToolUse { id, name, input } => {
                        // Track this tool call for duration calculation
                        tool_tracker.start_tool(id.clone(), name.clone(), message_id.clone());

                        // Special handling for AskUserQuestion tool
                        if name == "AskUserQuestion" {
                            if let Some(event) = parse_ask_user_question(&id, &input, &message_id) {
                                return Some(event);
                            }
                        }

                        return Some(StructuredEvent::ToolStart {
                            tool_id: id,
                            tool_name: name,
                            tool_input: input,
                            message_id: message_id.clone(),
                        });
                    }
                    ContentBlock::Text { text } => {
                        return Some(StructuredEvent::Text {
                            content: text,
                            message_id: message_id.clone(),
                        });
                    }
                }
            }
            None
        }
        ClaudeEvent::User(user) => {
            // User events contain tool results
            use super::json_types::ToolResultBlock;

            for block in user.message.content {
                match block {
                    ToolResultBlock::ToolResult {
                        tool_use_id,
                        content,
                        is_error,
                    } => {
                        // Complete the tool call and get duration
                        let duration_info = tool_tracker.complete_tool(&tool_use_id);
                        let duration_ms = duration_info.as_ref().map(|(_, d, _)| *d);

                        return Some(StructuredEvent::ToolComplete {
                            tool_id: tool_use_id,
                            tool_output: content,
                            is_error: is_error.unwrap_or(false),
                            duration_ms,
                        });
                    }
                }
            }
            None
        }
        ClaudeEvent::Result(result) => Some(StructuredEvent::Complete {
            duration_ms: result.duration_ms,
            num_turns: result.num_turns,
            is_error: result.is_error,
            result: result.result,
        }),
    }
}

/// Parse AskUserQuestion tool input and convert to UserInputRequest event
///
/// The AskUserQuestion tool input has this structure:
/// {
///   "questions": [{
///     "question": "What would you like?",
///     "header": "Choice",
///     "options": [{"label": "Option 1", "description": "..."}, ...],
///     "multiSelect": false
///   }]
/// }
fn parse_ask_user_question(
    tool_id: &str,
    input: &serde_json::Value,
    message_id: &str,
) -> Option<StructuredEvent> {
    // Extract the questions array
    let questions = input.get("questions")?.as_array()?;

    // For now, handle the first question (multi-question support can be added later)
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

    Some(StructuredEvent::UserInputRequest {
        tool_id: tool_id.to_string(),
        question: question_text,
        header,
        options,
        multi_select,
        message_id: message_id.to_string(),
    })
}
