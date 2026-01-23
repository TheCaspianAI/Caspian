use crate::commands::repository::CommandResult;
use crate::db::Database;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

/// Memory entry type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryType {
    Assumption,
    Pattern,
    Preference,
    Fact,
}

impl MemoryType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "assumption" => Some(Self::Assumption),
            "pattern" => Some(Self::Pattern),
            "preference" => Some(Self::Preference),
            "fact" => Some(Self::Fact),
            _ => None,
        }
    }
}

/// Workspace memory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub workspace_id: String,
    pub memory_type: String,
    pub content: String,
    pub source_node_id: Option<String>,
    pub created_at: String,
}

/// Add a memory entry to a workspace
#[tauri::command]
pub fn add_memory(
    workspace_id: String,
    memory_type: String,
    content: String,
    source_node_id: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<MemoryEntry> {
    // Validate memory type
    if MemoryType::from_str(&memory_type).is_none() {
        return CommandResult::err(&format!("Invalid memory type: {}", memory_type));
    }

    let conn = db.conn.lock().unwrap();

    // Verify workspace exists
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM repositories WHERE id = ?1",
            [&workspace_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !exists {
        return CommandResult::err("Workspace not found");
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        r#"INSERT INTO workspace_memory
           (id, workspace_id, memory_type, content, source_node_id, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
        (
            &id,
            &workspace_id,
            &memory_type,
            &content,
            &source_node_id,
            &now,
        ),
    );

    match result {
        Ok(_) => CommandResult::ok(MemoryEntry {
            id,
            workspace_id,
            memory_type,
            content,
            source_node_id,
            created_at: now,
        }),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Get all memory entries for a workspace
#[tauri::command]
pub fn get_workspace_memory(
    workspace_id: String,
    memory_type: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<MemoryEntry>> {
    let conn = db.conn.lock().unwrap();

    let entries = if let Some(mtype) = memory_type {
        let mut stmt = match conn.prepare(
            r#"SELECT id, workspace_id, memory_type, content, source_node_id, created_at
               FROM workspace_memory
               WHERE workspace_id = ?1 AND memory_type = ?2
               ORDER BY created_at DESC"#,
        ) {
            Ok(s) => s,
            Err(e) => return CommandResult::err(&e.to_string()),
        };

        let result: Result<Vec<MemoryEntry>, _> = stmt
            .query_map([&workspace_id, &mtype], |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    memory_type: row.get(2)?,
                    content: row.get(3)?,
                    source_node_id: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .and_then(|rows| rows.collect());

        result
    } else {
        let mut stmt = match conn.prepare(
            r#"SELECT id, workspace_id, memory_type, content, source_node_id, created_at
               FROM workspace_memory
               WHERE workspace_id = ?1
               ORDER BY created_at DESC"#,
        ) {
            Ok(s) => s,
            Err(e) => return CommandResult::err(&e.to_string()),
        };

        let result: Result<Vec<MemoryEntry>, _> = stmt
            .query_map([&workspace_id], |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    memory_type: row.get(2)?,
                    content: row.get(3)?,
                    source_node_id: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .and_then(|rows| rows.collect());

        result
    };

    match entries {
        Ok(e) => CommandResult::ok(e),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Delete a memory entry
#[tauri::command]
pub fn delete_memory(id: String, db: State<'_, Arc<Database>>) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    let result = conn.execute("DELETE FROM workspace_memory WHERE id = ?1", [&id]);

    match result {
        Ok(0) => CommandResult::err("Memory entry not found"),
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Propagate context from a merged node to workspace memory
/// This extracts assumptions and learnings from the node and adds them to workspace memory
#[tauri::command]
pub fn propagate_node_context(
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<MemoryEntry>> {
    let conn = db.conn.lock().unwrap();

    // Get node info
    let (repo_id, internal_branch, state): (String, String, String) = match conn.query_row(
        "SELECT repo_id, internal_branch, state FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Only propagate from merged nodes
    if state != "merged" {
        return CommandResult::err("Can only propagate context from merged nodes");
    }

    // Get repo path to load manifest
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Load manifest to get ground rules
    let manifest = match crate::manifest::load_manifest(std::path::Path::new(&repo_path), &internal_branch) {
        Ok(m) => m,
        Err(_) => return CommandResult::ok(Vec::new()), // No manifest, nothing to propagate
    };

    let mut created_entries = Vec::new();
    let now = Utc::now().to_rfc3339();

    // Add ground rules to workspace memory
    for ground_rule in &manifest.ground_rules {
        let id = Uuid::new_v4().to_string();

        let result = conn.execute(
            r#"INSERT INTO workspace_memory
               (id, workspace_id, memory_type, content, source_node_id, created_at)
               VALUES (?1, ?2, 'ground_rule', ?3, ?4, ?5)"#,
            (&id, &repo_id, ground_rule, &node_id, &now),
        );

        if result.is_ok() {
            created_entries.push(MemoryEntry {
                id,
                workspace_id: repo_id.clone(),
                memory_type: "ground_rule".to_string(),
                content: ground_rule.clone(),
                source_node_id: Some(node_id.clone()),
                created_at: now.clone(),
            });
        }
    }

    CommandResult::ok(created_entries)
}

/// Search workspace memory by content
#[tauri::command]
pub fn search_memory(
    workspace_id: String,
    query: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<MemoryEntry>> {
    let conn = db.conn.lock().unwrap();

    let search_pattern = format!("%{}%", query);

    let mut stmt = match conn.prepare(
        r#"SELECT id, workspace_id, memory_type, content, source_node_id, created_at
           FROM workspace_memory
           WHERE workspace_id = ?1 AND content LIKE ?2
           ORDER BY created_at DESC
           LIMIT 50"#,
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let result: Result<Vec<MemoryEntry>, _> = stmt
        .query_map([&workspace_id, &search_pattern], |row| {
            Ok(MemoryEntry {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                memory_type: row.get(2)?,
                content: row.get(3)?,
                source_node_id: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .and_then(|rows| rows.collect());

    match result {
        Ok(entries) => CommandResult::ok(entries),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}
