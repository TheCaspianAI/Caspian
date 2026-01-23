use crate::chat::{ChatState, ChatStateEntry, Message, MessageType, SenderType};
use crate::db::Database;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(error: impl ToString) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.to_string()),
        }
    }
}

/// Send a message to a workspace or branch chat
#[tauri::command]
pub fn send_message(
    workspace_id: String,
    node_id: Option<String>,
    content: String,
    message_type: String,
    sender_type: String,
    sender_id: Option<String>,
    metadata: Option<serde_json::Value>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Message> {
    let msg_type = match MessageType::from_str(&message_type) {
        Some(t) => t,
        None => return CommandResult::err(format!("Invalid message type: {}", message_type)),
    };

    let snd_type = match SenderType::from_str(&sender_type) {
        Some(t) => t,
        None => return CommandResult::err(format!("Invalid sender type: {}", sender_type)),
    };

    let conn = db.conn.lock().unwrap();

    // Check if chat is locked (only for human messages)
    if snd_type == SenderType::Human {
        if let Some(ref bid) = node_id {
            let state: Option<String> = conn
                .query_row(
                    "SELECT state FROM chat_state WHERE workspace_id = ?1 AND node_id = ?2",
                    [&workspace_id, bid],
                    |row| row.get(0),
                )
                .ok();

            if let Some(s) = state {
                if s == "locked" {
                    return CommandResult::err("Chat is locked - agent is running");
                }
            }
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let metadata_str = metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());

    let result = conn.execute(
        "INSERT INTO messages (id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            &id,
            &workspace_id,
            &node_id,
            snd_type.as_str(),
            &sender_id,
            &content,
            msg_type.as_str(),
            &metadata_str,
            now.to_rfc3339(),
        ],
    );

    // Update node's last_active_at to reflect latest chat activity
    if let Some(ref nid) = node_id {
        let _ = conn.execute(
            "UPDATE nodes SET last_active_at = ?1 WHERE id = ?2",
            rusqlite::params![now.to_rfc3339(), nid],
        );
    }

    match result {
        Ok(_) => CommandResult::ok(Message {
            id,
            workspace_id,
            node_id,
            sender_type: snd_type,
            sender_id,
            content,
            message_type: msg_type,
            metadata,
            created_at: now,
        }),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get messages for a workspace or branch
#[tauri::command]
pub fn get_messages(
    workspace_id: String,
    node_id: Option<String>,
    limit: Option<i64>,
    before_id: Option<String>,
    sender_type: Option<String>,  // NEW: Optional filter by sender type
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<Message>> {
    let conn = db.conn.lock().unwrap();

    let limit = limit.unwrap_or(100);

    let mut query = String::from(
        "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
         FROM messages WHERE workspace_id = ?1"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(workspace_id.clone())];

    match &node_id {
        Some(bid) => {
            query.push_str(" AND node_id = ?2");
            params.push(Box::new(bid.clone()));
        }
        None => {
            query.push_str(" AND node_id IS NULL");
        }
    }

    // NEW: Add sender_type filter if provided
    if let Some(ref st) = sender_type {
        let param_num = params.len() + 1;
        query.push_str(&format!(" AND sender_type = ?{}", param_num));
        params.push(Box::new(st.clone()));
    }

    if let Some(ref before) = before_id {
        let param_num = params.len() + 1;
        query.push_str(&format!(
            " AND created_at < (SELECT created_at FROM messages WHERE id = ?{})",
            param_num
        ));
        params.push(Box::new(before.clone()));
    }

    query.push_str(" ORDER BY created_at DESC LIMIT ?");
    let limit_param_num = params.len() + 1;
    query = query.replace("LIMIT ?", &format!("LIMIT ?{}", limit_param_num));
    params.push(Box::new(limit));

    let mut stmt = match conn.prepare(&query) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let messages = stmt.query_map(params_refs.as_slice(), |row| {
        let sender_type_str: String = row.get(3)?;
        let message_type_str: String = row.get(6)?;
        let metadata_str: Option<String> = row.get(7)?;
        let created_at_str: String = row.get(8)?;

        Ok(Message {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            node_id: row.get(2)?,
            sender_type: SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Human),
            sender_id: row.get(4)?,
            content: row.get(5)?,
            message_type: MessageType::from_str(&message_type_str).unwrap_or(MessageType::Text),
            metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    });

    match messages {
        Ok(msgs) => {
            let mut result: Vec<Message> = msgs.filter_map(|m| m.ok()).collect();
            result.reverse(); // Return in chronological order
            CommandResult::ok(result)
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get agent messages for a specific turn (after a user message, before the next)
#[tauri::command]
pub fn get_agent_messages_for_turn(
    workspace_id: String,
    node_id: Option<String>,
    after_message_id: String,  // User message ID to anchor from
    limit: Option<i64>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<Message>> {
    let conn = db.conn.lock().unwrap();
    let limit = limit.unwrap_or(50);

    // Get the timestamp of the anchor (user) message
    let anchor_time: String = match conn.query_row(
        "SELECT created_at FROM messages WHERE id = ?1",
        rusqlite::params![&after_message_id],
        |row| row.get(0),
    ) {
        Ok(time) => time,
        Err(e) => return CommandResult::err(format!("Anchor message not found: {}", e)),
    };

    // Get the timestamp of the next user message (upper bound)
    let next_user_query = match &node_id {
        Some(bid) => {
            conn.query_row(
                "SELECT created_at FROM messages
                 WHERE workspace_id = ?1
                   AND node_id = ?2
                   AND sender_type = 'human'
                   AND created_at > ?3
                 ORDER BY created_at ASC LIMIT 1",
                rusqlite::params![&workspace_id, bid, &anchor_time],
                |row| row.get::<_, String>(0),
            )
        }
        None => {
            conn.query_row(
                "SELECT created_at FROM messages
                 WHERE workspace_id = ?1
                   AND node_id IS NULL
                   AND sender_type = 'human'
                   AND created_at > ?2
                 ORDER BY created_at ASC LIMIT 1",
                rusqlite::params![&workspace_id, &anchor_time],
                |row| row.get::<_, String>(0),
            )
        }
    };

    let next_user_time: Option<String> = next_user_query.ok();

    // Build query for agent messages in this window
    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match (&node_id, &next_user_time) {
        (Some(bid), Some(upper)) => (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1
               AND node_id = ?2
               AND sender_type = 'agent'
               AND created_at > ?3
               AND created_at < ?4
             ORDER BY created_at ASC LIMIT ?5".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(bid.clone()),
                Box::new(anchor_time.clone()),
                Box::new(upper.clone()),
                Box::new(limit),
            ],
        ),
        (Some(bid), None) => (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1
               AND node_id = ?2
               AND sender_type = 'agent'
               AND created_at > ?3
             ORDER BY created_at ASC LIMIT ?4".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(bid.clone()),
                Box::new(anchor_time.clone()),
                Box::new(limit),
            ],
        ),
        (None, Some(upper)) => (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1
               AND node_id IS NULL
               AND sender_type = 'agent'
               AND created_at > ?2
               AND created_at < ?3
             ORDER BY created_at ASC LIMIT ?4".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(anchor_time.clone()),
                Box::new(upper.clone()),
                Box::new(limit),
            ],
        ),
        (None, None) => (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1
               AND node_id IS NULL
               AND sender_type = 'agent'
               AND created_at > ?2
             ORDER BY created_at ASC LIMIT ?3".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(anchor_time.clone()),
                Box::new(limit),
            ],
        ),
    };

    let mut stmt = match conn.prepare(&query) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let messages = stmt.query_map(params_refs.as_slice(), |row| {
        let sender_type_str: String = row.get(3)?;
        let message_type_str: String = row.get(6)?;
        let metadata_str: Option<String> = row.get(7)?;
        let created_at_str: String = row.get(8)?;

        Ok(Message {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            node_id: row.get(2)?,
            sender_type: SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Human),
            sender_id: row.get(4)?,
            content: row.get(5)?,
            message_type: MessageType::from_str(&message_type_str).unwrap_or(MessageType::Text),
            metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    });

    match messages {
        Ok(msgs) => {
            let result: Vec<Message> = msgs.filter_map(|m| m.ok()).collect();
            CommandResult::ok(result)
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get chat state for a branch or workspace
#[tauri::command]
pub fn get_chat_state(
    workspace_id: String,
    node_id: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<ChatStateEntry> {
    let conn = db.conn.lock().unwrap();

    let result = match &node_id {
        Some(bid) => conn.query_row(
            "SELECT id, workspace_id, node_id, state, locked_reason, updated_at
             FROM chat_state WHERE workspace_id = ?1 AND node_id = ?2",
            [&workspace_id, bid],
            |row| {
                let state_str: String = row.get(3)?;
                let updated_at_str: String = row.get(5)?;
                Ok(ChatStateEntry {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    node_id: row.get(2)?,
                    state: ChatState::from_str(&state_str).unwrap_or(ChatState::Idle),
                    locked_reason: row.get(4)?,
                    updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                })
            },
        ),
        None => conn.query_row(
            "SELECT id, workspace_id, node_id, state, locked_reason, updated_at
             FROM chat_state WHERE workspace_id = ?1 AND node_id IS NULL",
            [&workspace_id],
            |row| {
                let state_str: String = row.get(3)?;
                let updated_at_str: String = row.get(5)?;
                Ok(ChatStateEntry {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    node_id: row.get(2)?,
                    state: ChatState::from_str(&state_str).unwrap_or(ChatState::Idle),
                    locked_reason: row.get(4)?,
                    updated_at: chrono::DateTime::parse_from_rfc3339(&updated_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                })
            },
        ),
    };

    match result {
        Ok(entry) => CommandResult::ok(entry),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Return default idle state
            CommandResult::ok(ChatStateEntry {
                id: String::new(),
                workspace_id,
                node_id,
                state: ChatState::Idle,
                locked_reason: None,
                updated_at: Utc::now(),
            })
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Set chat state for a branch or workspace
#[tauri::command]
pub fn set_chat_state(
    workspace_id: String,
    node_id: Option<String>,
    state: String,
    locked_reason: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<ChatStateEntry> {
    let chat_state = match ChatState::from_str(&state) {
        Some(s) => s,
        None => return CommandResult::err(format!("Invalid chat state: {}", state)),
    };

    let conn = db.conn.lock().unwrap();

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let result = conn.execute(
        "INSERT INTO chat_state (id, workspace_id, node_id, state, locked_reason, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(workspace_id, node_id) DO UPDATE SET
         state = excluded.state,
         locked_reason = excluded.locked_reason,
         updated_at = excluded.updated_at",
        rusqlite::params![
            &id,
            &workspace_id,
            &node_id,
            chat_state.as_str(),
            &locked_reason,
            now.to_rfc3339(),
        ],
    );

    match result {
        Ok(_) => CommandResult::ok(ChatStateEntry {
            id,
            workspace_id,
            node_id,
            state: chat_state,
            locked_reason,
            updated_at: now,
        }),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Delete a message
#[tauri::command]
pub fn delete_message(message_id: String, db: State<'_, Arc<Database>>) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    let result = conn.execute("DELETE FROM messages WHERE id = ?1", [&message_id]);

    match result {
        Ok(0) => CommandResult::err(format!("Message not found: {}", message_id)),
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get ALL messages for a node in a single query (replaces N+1 pattern)
/// Messages are returned in chronological order (oldest first)
#[tauri::command]
pub fn get_messages_for_node(
    workspace_id: String,
    node_id: String,
    limit: Option<i64>,
    before_id: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<Message>> {
    let conn = db.conn.lock().unwrap();
    let limit = limit.unwrap_or(50); // Default to 50 messages (~5-10 turns)

    // Build query with optional cursor-based pagination
    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref before) = before_id {
        (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1 AND node_id = ?2
               AND created_at < (SELECT created_at FROM messages WHERE id = ?3)
             ORDER BY created_at DESC
             LIMIT ?4".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(node_id.clone()),
                Box::new(before.clone()),
                Box::new(limit),
            ],
        )
    } else {
        (
            "SELECT id, workspace_id, node_id, sender_type, sender_id, content, message_type, metadata, created_at
             FROM messages
             WHERE workspace_id = ?1 AND node_id = ?2
             ORDER BY created_at DESC
             LIMIT ?3".to_string(),
            vec![
                Box::new(workspace_id.clone()),
                Box::new(node_id.clone()),
                Box::new(limit),
            ],
        )
    };

    let mut stmt = match conn.prepare(&query) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let messages = stmt.query_map(params_refs.as_slice(), |row| {
        let sender_type_str: String = row.get(3)?;
        let message_type_str: String = row.get(6)?;
        let metadata_str: Option<String> = row.get(7)?;
        let created_at_str: String = row.get(8)?;

        Ok(Message {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            node_id: row.get(2)?,
            sender_type: SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Human),
            sender_id: row.get(4)?,
            content: row.get(5)?,
            message_type: MessageType::from_str(&message_type_str).unwrap_or(MessageType::Text),
            metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
            created_at: chrono::DateTime::parse_from_rfc3339(&created_at_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now()),
        })
    });

    match messages {
        Ok(msgs) => {
            let mut result: Vec<Message> = msgs.filter_map(|m| m.ok()).collect();
            result.reverse(); // Return in chronological order (oldest first)
            CommandResult::ok(result)
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get message count for a branch or workspace (useful for badges)
#[tauri::command]
pub fn get_unread_count(
    workspace_id: String,
    node_id: Option<String>,
    since: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<i64> {
    let conn = db.conn.lock().unwrap();

    let query = match (&node_id, &since) {
        (Some(bid), Some(since_time)) => {
            conn.query_row(
                "SELECT COUNT(*) FROM messages
                 WHERE workspace_id = ?1 AND node_id = ?2 AND created_at > ?3",
                [&workspace_id, bid, since_time],
                |row| row.get(0),
            )
        }
        (Some(bid), None) => {
            conn.query_row(
                "SELECT COUNT(*) FROM messages WHERE workspace_id = ?1 AND node_id = ?2",
                [&workspace_id, bid],
                |row| row.get(0),
            )
        }
        (None, Some(since_time)) => {
            conn.query_row(
                "SELECT COUNT(*) FROM messages
                 WHERE workspace_id = ?1 AND node_id IS NULL AND created_at > ?2",
                [&workspace_id, since_time],
                |row| row.get(0),
            )
        }
        (None, None) => {
            conn.query_row(
                "SELECT COUNT(*) FROM messages WHERE workspace_id = ?1 AND node_id IS NULL",
                [&workspace_id],
                |row| row.get(0),
            )
        }
    };

    match query {
        Ok(count) => CommandResult::ok(count),
        Err(e) => CommandResult::err(e.to_string()),
    }
}
