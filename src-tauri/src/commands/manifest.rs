use crate::audit::{append_audit_entry, AuditEntry, AuditEventType};
use crate::commands::repository::CommandResult;
use crate::db::Database;
use crate::manifest::{
    load_manifest, save_manifest, validate_manifest, NodeManifest, ValidationResult,
};
use chrono::Utc;
use std::path::Path;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_manifest(
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<NodeManifest> {
    let conn = db.conn.lock().unwrap();

    // Get node and repo info
    let (internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    match load_manifest(Path::new(&repo_path), &internal_branch) {
        Ok(m) => CommandResult::ok(m),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn update_manifest(
    node_id: String,
    manifest: NodeManifest,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    // Get node and repo info
    let (_internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Save manifest
    if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
        return CommandResult::err(&e.to_string());
    }

    // Update branch record
    let now = Utc::now().to_rfc3339();
    let has_goal = !manifest.goal.trim().is_empty();
    let manifest_valid = has_goal;

    let checks = has_goal as i32;

    let _ = conn.execute(
        r#"UPDATE nodes SET
           goal = ?1, manifest_valid = ?2, checks_completed = ?3, updated_at = ?4
           WHERE id = ?5"#,
        (
            &manifest.goal,
            manifest_valid as i32,
            checks,
            &now,
            &node_id,
        ),
    );

    CommandResult::ok(())
}

#[tauri::command]
pub fn validate_branch_manifest(
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<ValidationResult> {
    let conn = db.conn.lock().unwrap();

    // Get node and repo info
    let (internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    let manifest = match load_manifest(Path::new(&repo_path), &internal_branch) {
        Ok(m) => m,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let result = validate_manifest(&manifest);
    CommandResult::ok(result)
}

#[tauri::command]
pub fn add_ground_rule(
    node_id: String,
    rule: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<NodeManifest> {
    let conn = db.conn.lock().unwrap();

    // Get node and repo info
    let (internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Load and update manifest
    let mut manifest = match load_manifest(Path::new(&repo_path), &internal_branch) {
        Ok(m) => m,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    manifest.add_ground_rule(&rule);

    if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
        return CommandResult::err(&e.to_string());
    }

    // Log audit entry
    let audit_entry = AuditEntry::new(AuditEventType::GroundRuleAdded, &internal_branch)
        .with_values(None, Some(serde_json::json!({ "rule": rule })));

    let _ = append_audit_entry(Path::new(&repo_path), &audit_entry);

    CommandResult::ok(manifest)
}

#[tauri::command]
pub fn update_goal(
    node_id: String,
    goal: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<NodeManifest> {
    let conn = db.conn.lock().unwrap();

    // Get node and repo info
    let (internal_branch, repo_id): (String, String) = match conn.query_row(
        "SELECT internal_branch, repo_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Load and update manifest
    let mut manifest = match load_manifest(Path::new(&repo_path), &internal_branch) {
        Ok(m) => m,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let old_goal = manifest.goal.clone();
    manifest.goal = goal.clone();

    if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
        return CommandResult::err(&e.to_string());
    }

    // Log audit entry
    let audit_entry = AuditEntry::new(AuditEventType::GoalChange, &internal_branch).with_values(
        Some(serde_json::json!({ "goal": old_goal })),
        Some(serde_json::json!({ "goal": goal })),
    );

    let _ = append_audit_entry(Path::new(&repo_path), &audit_entry);

    // Update goal in database
    let now = Utc::now().to_rfc3339();
    let has_goal = !manifest.goal.trim().is_empty();
    let checks = has_goal as i32;

    let _ = conn.execute(
        "UPDATE nodes SET goal = ?1, checks_completed = ?2, manifest_valid = ?3, updated_at = ?4 WHERE id = ?5",
        (&goal, checks, has_goal as i32, &now, &node_id),
    );

    CommandResult::ok(manifest)
}
