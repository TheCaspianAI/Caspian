use crate::audit::{get_recent_activity, read_audit_log, AuditEntry};
use crate::commands::repository::CommandResult;
use crate::db::Database;
use std::path::Path;
use std::sync::Arc;
use tauri::State;

/// Get audit log for a specific branch
#[tauri::command]
pub fn get_audit_log(
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<AuditEntry>> {
    let conn = db.conn.lock().unwrap();

    // Get branch info
    let (internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Branch not found"),
    };

    // Get repo path
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    match read_audit_log(Path::new(&repo_path), &internal_branch) {
        Ok(entries) => CommandResult::ok(entries),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Get recent activity across all branches in a repository
#[tauri::command]
pub fn get_repo_activity(
    repo_id: String,
    limit: u32,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<AuditEntry>> {
    let conn = db.conn.lock().unwrap();

    // Get repo path
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    match get_recent_activity(Path::new(&repo_path), limit as usize) {
        Ok(entries) => CommandResult::ok(entries),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}
