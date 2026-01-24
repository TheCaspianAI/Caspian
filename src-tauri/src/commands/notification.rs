use crate::commands::chat::CommandResult;
use crate::db::get_db_path;
use crate::notifications::{NotificationCount, NotificationUpdateEvent};
use chrono::Utc;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

/// Get notification count for a node
#[tauri::command]
pub fn get_notification_count(node_id: String) -> CommandResult<NotificationCount> {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let result = conn.query_row(
        "SELECT node_id, unread_count, requires_input, last_notification_at, last_viewed_at
         FROM notification_state WHERE node_id = ?1",
        [&node_id],
        |row| {
            let last_notification_str: Option<String> = row.get(3)?;
            let last_viewed_str: Option<String> = row.get(4)?;

            Ok(NotificationCount {
                node_id: row.get(0)?,
                unread_count: row.get(1)?,
                requires_input: row.get::<_, i32>(2)? != 0,
                last_notification_at: last_notification_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                }),
                last_viewed_at: last_viewed_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                }),
            })
        },
    );

    match result {
        Ok(count) => CommandResult::ok(count),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Return default state (no notifications)
            CommandResult::ok(NotificationCount {
                node_id,
                unread_count: 0,
                requires_input: false,
                last_notification_at: None,
                last_viewed_at: None,
            })
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Mark notifications as read for a node
#[tauri::command]
pub fn mark_notifications_read(node_id: String, app_handle: AppHandle) -> CommandResult<()> {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let now = Utc::now().to_rfc3339();

    // Update existing record or insert new one with zero count
    let result = conn.execute(
        "INSERT INTO notification_state (node_id, unread_count, requires_input, last_viewed_at)
         VALUES (?1, 0, 0, ?2)
         ON CONFLICT(node_id) DO UPDATE SET
         unread_count = 0,
         requires_input = 0,
         last_viewed_at = excluded.last_viewed_at",
        rusqlite::params![&node_id, &now],
    );

    match result {
        Ok(_) => {
            // Emit notification update event
            let _ = app_handle.emit(
                "notification:update",
                NotificationUpdateEvent {
                    node_id,
                    count: 0,
                    requires_input: false,
                },
            );
            CommandResult::ok(())
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Increment notification count for a node (internal use)
#[tauri::command]
pub fn increment_notification(
    node_id: String,
    requires_input: bool,
    app_handle: AppHandle,
) -> CommandResult<NotificationCount> {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let now = Utc::now().to_rfc3339();
    let requires_input_int: i32 = if requires_input { 1 } else { 0 };

    // Insert or update the notification count
    let result = conn.execute(
        "INSERT INTO notification_state (node_id, unread_count, requires_input, last_notification_at)
         VALUES (?1, 1, ?2, ?3)
         ON CONFLICT(node_id) DO UPDATE SET
         unread_count = unread_count + 1,
         requires_input = CASE WHEN excluded.requires_input = 1 THEN 1 ELSE requires_input END,
         last_notification_at = excluded.last_notification_at",
        rusqlite::params![&node_id, requires_input_int, &now],
    );

    if let Err(e) = result {
        return CommandResult::err(e.to_string());
    }

    // Fetch the updated count
    match get_notification_count_internal(&conn, &node_id) {
        Ok(count) => {
            // Emit notification update event
            let _ = app_handle.emit(
                "notification:update",
                NotificationUpdateEvent {
                    node_id: count.node_id.clone(),
                    count: count.unread_count,
                    requires_input: count.requires_input,
                },
            );
            CommandResult::ok(count)
        }
        Err(e) => CommandResult::err(e),
    }
}

/// Set requires_input flag for a node
#[tauri::command]
pub fn set_requires_input(
    node_id: String,
    requires_input: bool,
    app_handle: AppHandle,
) -> CommandResult<()> {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let requires_input_int: i32 = if requires_input { 1 } else { 0 };
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        "INSERT INTO notification_state (node_id, unread_count, requires_input, last_notification_at)
         VALUES (?1, 0, ?2, ?3)
         ON CONFLICT(node_id) DO UPDATE SET
         requires_input = excluded.requires_input,
         last_notification_at = CASE WHEN excluded.requires_input = 1 THEN excluded.last_notification_at ELSE last_notification_at END",
        rusqlite::params![&node_id, requires_input_int, &now],
    );

    match result {
        Ok(_) => {
            // Fetch current count for the event
            if let Ok(count) = get_notification_count_internal(&conn, &node_id) {
                let _ = app_handle.emit(
                    "notification:update",
                    NotificationUpdateEvent {
                        node_id: count.node_id,
                        count: count.unread_count,
                        requires_input: count.requires_input,
                    },
                );
            }
            CommandResult::ok(())
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

/// Get all notification counts for a workspace (all nodes in a repository)
#[tauri::command]
pub fn get_all_notification_counts(workspace_id: String) -> CommandResult<Vec<NotificationCount>> {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let mut stmt = match conn.prepare(
        "SELECT ns.node_id, ns.unread_count, ns.requires_input, ns.last_notification_at, ns.last_viewed_at
         FROM notification_state ns
         JOIN nodes n ON ns.node_id = n.id
         WHERE n.repo_id = ?1",
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(e.to_string()),
    };

    let counts = stmt.query_map([&workspace_id], |row| {
        let last_notification_str: Option<String> = row.get(3)?;
        let last_viewed_str: Option<String> = row.get(4)?;

        Ok(NotificationCount {
            node_id: row.get(0)?,
            unread_count: row.get(1)?,
            requires_input: row.get::<_, i32>(2)? != 0,
            last_notification_at: last_notification_str.and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(&s)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc))
            }),
            last_viewed_at: last_viewed_str.and_then(|s| {
                chrono::DateTime::parse_from_rfc3339(&s)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc))
            }),
        })
    });

    match counts {
        Ok(c) => {
            let result: Vec<NotificationCount> = c.filter_map(|r| r.ok()).collect();
            CommandResult::ok(result)
        }
        Err(e) => CommandResult::err(e.to_string()),
    }
}

// Internal helper function
fn get_notification_count_internal(
    conn: &Connection,
    node_id: &str,
) -> Result<NotificationCount, String> {
    conn.query_row(
        "SELECT node_id, unread_count, requires_input, last_notification_at, last_viewed_at
         FROM notification_state WHERE node_id = ?1",
        [node_id],
        |row| {
            let last_notification_str: Option<String> = row.get(3)?;
            let last_viewed_str: Option<String> = row.get(4)?;

            Ok(NotificationCount {
                node_id: row.get(0)?,
                unread_count: row.get(1)?,
                requires_input: row.get::<_, i32>(2)? != 0,
                last_notification_at: last_notification_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                }),
                last_viewed_at: last_viewed_str.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc))
                }),
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Send a system notification using the OS notification center
#[tauri::command]
pub fn send_system_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    // Check if notifications are permitted
    let notification = app.notification();

    // Check permission state
    match notification.permission_state() {
        Ok(state) => {
            match state {
                tauri_plugin_notification::PermissionState::Granted => {
                    // Permission granted, proceed to send notification
                }
                tauri_plugin_notification::PermissionState::Denied => {
                    log::warn!(
                        "System notification permission denied. Title: '{}', Body: '{}'",
                        title,
                        body
                    );
                    return Err("Notification permission denied. Please enable notifications in your system settings.".to_string());
                }
                tauri_plugin_notification::PermissionState::Prompt
                | tauri_plugin_notification::PermissionState::PromptWithRationale => {
                    log::info!(
                        "System notification permission pending, attempting to send. Title: '{}'",
                        title
                    );
                    // Try anyway - the OS may prompt for permission
                }
            }
        }
        Err(e) => {
            log::error!("Failed to check notification permission state: {}", e);
            // Continue anyway, might still work
        }
    }

    // Attempt to send the notification
    match notification
        .builder()
        .title(&title)
        .body(&body)
        .sound("default")
        .show()
    {
        Ok(_) => {
            log::debug!("System notification sent successfully. Title: '{}'", title);
            Ok(())
        }
        Err(e) => {
            log::error!(
                "Failed to send system notification. Title: '{}', Body: '{}', Error: {}",
                title,
                body,
                e
            );
            Err(format!("Failed to send notification: {}", e))
        }
    }
}
