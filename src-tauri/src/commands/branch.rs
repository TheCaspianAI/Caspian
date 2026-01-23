use crate::audit::{append_audit_entry, AuditEntry, AuditEventType};
use crate::commands::repository::CommandResult;
use crate::db::Database;
use crate::git::{create_worktree, open_repo, remove_worktree};
use crate::manifest::{detect_test_command, save_manifest, NodeManifest};
use crate::state::NodeState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

/// Specification for creating a branch in a batch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchSpec {
    pub name: String,
    pub goal: String,
    pub parent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    pub id: String,
    pub repo_id: String,
    pub branch_name: String,
    pub parent_branch: String,
    pub worktree_path: Option<String>,
    pub state: String,
    pub goal: Option<String>,
    pub checks_completed: i32,
    pub checks_total: i32,
    pub manifest_valid: bool,
    pub tests_passed: bool,
    pub assumptions_reviewed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchWithManifest {
    pub branch: Branch,
    pub manifest: Option<NodeManifest>,
}

#[tauri::command]
pub fn create_reasoning_branch(
    repo_id: String,
    name: String,
    parent: String,
    goal: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Branch> {
    let conn = db.conn.lock().unwrap();

    // Get repository path
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    let repo = match open_repo(Path::new(&repo_path)) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    // Create worktree
    let worktree_info = match create_worktree(&repo, &name, &parent) {
        Ok(w) => w,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    // Create manifest
    let mut manifest = NodeManifest::new(&name, &parent, &goal);

    // Auto-detect test command
    if let Some(cmd) = detect_test_command(Path::new(&repo_path)) {
        manifest.tests.command = Some(cmd);
    }

    // Save manifest
    if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
        // Cleanup worktree on failure
        let _ = remove_worktree(&repo, &name);
        return CommandResult::err(&e.to_string());
    }

    // Create branch record in database
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let worktree_path = worktree_info.path.to_string_lossy().to_string();

    let result = conn.execute(
        r#"INSERT INTO branches
           (id, repo_id, branch_name, parent_branch, worktree_path, state, goal,
            checks_completed, checks_total, manifest_valid, tests_passed,
            assumptions_reviewed, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)"#,
        (
            &id,
            &repo_id,
            &name,
            &parent,
            &worktree_path,
            NodeState::InProgress.as_str(),
            &goal,
            1, // goal is set
            4,
            1, // manifest is valid (has goal)
            0,
            0,
            &now,
        ),
    );

    if let Err(e) = result {
        // Cleanup on failure
        let _ = remove_worktree(&repo, &name);
        return CommandResult::err(&e.to_string());
    }

    // Log audit entry
    let audit_entry = AuditEntry::new(AuditEventType::BranchCreated, &name)
        .with_values(None, Some(serde_json::json!({ "goal": goal, "parent": parent })));

    let _ = append_audit_entry(Path::new(&repo_path), &audit_entry);

    CommandResult::ok(Branch {
        id,
        repo_id,
        branch_name: name,
        parent_branch: parent,
        worktree_path: Some(worktree_path),
        state: NodeState::InProgress.as_str().into(),
        goal: Some(goal),
        checks_completed: 1,
        checks_total: 4,
        manifest_valid: true,
        tests_passed: false,
        assumptions_reviewed: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn list_branches(repo_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<Branch>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = match conn.prepare(
        r#"SELECT id, repo_id, branch_name, parent_branch, worktree_path, state, goal,
                  checks_completed, checks_total, manifest_valid, tests_passed,
                  assumptions_reviewed, created_at, updated_at
           FROM branches WHERE repo_id = ?1 ORDER BY created_at DESC"#,
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let branches: Result<Vec<Branch>, _> = stmt
        .query_map([&repo_id], |row| {
            Ok(Branch {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                branch_name: row.get(2)?,
                parent_branch: row.get(3)?,
                worktree_path: row.get(4)?,
                state: row.get(5)?,
                goal: row.get(6)?,
                checks_completed: row.get(7)?,
                checks_total: row.get(8)?,
                manifest_valid: row.get::<_, i32>(9)? != 0,
                tests_passed: row.get::<_, i32>(10)? != 0,
                assumptions_reviewed: row.get::<_, i32>(11)? != 0,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .and_then(|rows| rows.collect());

    match branches {
        Ok(b) => CommandResult::ok(b),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn get_branch(id: String, db: State<'_, Arc<Database>>) -> CommandResult<BranchWithManifest> {
    let conn = db.conn.lock().unwrap();

    let branch: Branch = match conn.query_row(
        r#"SELECT b.id, b.repo_id, b.branch_name, b.parent_branch, b.worktree_path,
                  b.state, b.goal, b.checks_completed, b.checks_total, b.manifest_valid,
                  b.tests_passed, b.assumptions_reviewed, b.created_at, b.updated_at
           FROM branches b WHERE b.id = ?1"#,
        [&id],
        |row| {
            Ok(Branch {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                branch_name: row.get(2)?,
                parent_branch: row.get(3)?,
                worktree_path: row.get(4)?,
                state: row.get(5)?,
                goal: row.get(6)?,
                checks_completed: row.get(7)?,
                checks_total: row.get(8)?,
                manifest_valid: row.get::<_, i32>(9)? != 0,
                tests_passed: row.get::<_, i32>(10)? != 0,
                assumptions_reviewed: row.get::<_, i32>(11)? != 0,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        },
    ) {
        Ok(b) => b,
        Err(_) => return CommandResult::err("Branch not found"),
    };

    // Get repo path to load manifest
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&branch.repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Load manifest
    let manifest = crate::manifest::load_manifest(Path::new(&repo_path), &branch.branch_name).ok();

    CommandResult::ok(BranchWithManifest { branch, manifest })
}

/// Create multiple branches at once (for batch creation)
#[tauri::command]
pub fn create_branch_tree(
    repo_id: String,
    branches: Vec<BranchSpec>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<Branch>> {
    let conn = db.conn.lock().unwrap();

    // Get repository path
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    let repo = match open_repo(Path::new(&repo_path)) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let mut created_branches = Vec::new();
    let mut errors = Vec::new();

    // Create branches in order (parents first)
    // This assumes the branches are already sorted in dependency order
    for spec in branches {
        // Create worktree
        let worktree_info = match create_worktree(&repo, &spec.name, &spec.parent) {
            Ok(w) => w,
            Err(e) => {
                errors.push(format!("Failed to create worktree for {}: {}", spec.name, e));
                continue;
            }
        };

        // Create manifest
        let mut manifest = NodeManifest::new(&spec.name, &spec.parent, &spec.goal);

        // Auto-detect test command
        if let Some(cmd) = detect_test_command(Path::new(&repo_path)) {
            manifest.tests.command = Some(cmd);
        }

        // Save manifest
        if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
            let _ = remove_worktree(&repo, &spec.name);
            errors.push(format!("Failed to save manifest for {}: {}", spec.name, e));
            continue;
        }

        // Create branch record in database
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let worktree_path = worktree_info.path.to_string_lossy().to_string();

        let result = conn.execute(
            r#"INSERT INTO branches
               (id, repo_id, branch_name, parent_branch, worktree_path, state, goal,
                checks_completed, checks_total, manifest_valid, tests_passed,
                assumptions_reviewed, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)"#,
            (
                &id,
                &repo_id,
                &spec.name,
                &spec.parent,
                &worktree_path,
                NodeState::InProgress.as_str(),
                &spec.goal,
                1, // goal is set
                4,
                1, // manifest is valid (has goal)
                0,
                0,
                &now,
            ),
        );

        if let Err(e) = result {
            let _ = remove_worktree(&repo, &spec.name);
            errors.push(format!("Failed to create branch record for {}: {}", spec.name, e));
            continue;
        }

        // Log audit entry
        let audit_entry = AuditEntry::new(AuditEventType::BranchCreated, &spec.name)
            .with_values(None, Some(serde_json::json!({ "goal": spec.goal, "parent": spec.parent })));

        let _ = append_audit_entry(Path::new(&repo_path), &audit_entry);

        created_branches.push(Branch {
            id,
            repo_id: repo_id.clone(),
            branch_name: spec.name,
            parent_branch: spec.parent,
            worktree_path: Some(worktree_path),
            state: NodeState::InProgress.as_str().into(),
            goal: Some(spec.goal),
            checks_completed: 1,
            checks_total: 4,
            manifest_valid: true,
            tests_passed: false,
            assumptions_reviewed: false,
            created_at: now.clone(),
            updated_at: now,
        });
    }

    // If some branches failed, include error info in result
    if !errors.is_empty() && created_branches.is_empty() {
        return CommandResult::err(&errors.join("; "));
    }

    CommandResult::ok(created_branches)
}

#[tauri::command]
pub fn delete_branch(id: String, force: bool, db: State<'_, Arc<Database>>) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    // Get branch info
    let (branch_name, repo_id, state): (String, String, String) = match conn.query_row(
        "SELECT branch_name, repo_id, state FROM branches WHERE id = ?1",
        [&id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Branch not found"),
    };

    // Check if branch can be deleted
    if !force && state != NodeState::Closed.as_str() && state != NodeState::InProgress.as_str()
    {
        return CommandResult::err("Cannot delete branch in this state. Use force=true to override.");
    }

    // Get repo path
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Remove worktree
    if let Ok(repo) = open_repo(Path::new(&repo_path)) {
        let _ = remove_worktree(&repo, &branch_name);
    }

    // Delete manifest
    let _ = crate::manifest::delete_manifest(Path::new(&repo_path), &branch_name);

    // Delete audit log
    let _ = crate::audit::delete_audit_log(Path::new(&repo_path), &branch_name);

    // Delete from database
    let result = conn.execute("DELETE FROM branches WHERE id = ?1", [&id]);

    match result {
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}
