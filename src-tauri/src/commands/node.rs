use crate::audit::{append_audit_entry, AuditEntry, AuditEventType};
use crate::commands::repository::CommandResult;
use crate::db::Database;
use crate::git::{
    generate_node_names, open_repo,
    spawn_create_worktree, spawn_remove_worktree,
    CreateWorktreeConfig, RemoveWorktreeConfig, DEFAULT_MAX_RETRIES,
};
use crate::manifest::{detect_test_command, save_manifest, NodeManifest};
use crate::state::NodeState;
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub repo_id: String,
    pub internal_branch: String,
    pub display_name: String,
    pub context: Option<String>,
    pub parent_branch: String,
    pub original_parent_branch: Option<String>,
    pub worktree_path: Option<String>,
    pub state: String,
    pub worktree_status: String,
    pub goal: Option<String>,
    pub checks_completed: i32,
    pub checks_total: i32,
    pub manifest_valid: bool,
    pub tests_passed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_active_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeWithManifest {
    pub node: Node,
    pub manifest: Option<NodeManifest>,
}

/// Create a new node with async worktree creation.
///
/// The node is created immediately in the database with `worktree_status = 'pending'`.
/// Worktree creation happens in a background thread, with progress reported via
/// `worktree:progress` Tauri events.
#[tauri::command]
pub fn create_node(
    app: AppHandle,
    repo_id: String,
    goal: String,
    parent: Option<String>,
    _username: Option<String>,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Node> {
    let conn = db.conn.lock().unwrap();

    // Get repository info
    let (repo_path, main_branch): (String, String) = match conn.query_row(
        "SELECT path, main_branch FROM repositories WHERE id = ?1",
        [&repo_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Verify repository can be opened (quick check)
    let repo = match open_repo(Path::new(&repo_path)) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    // Use parent or default to main branch
    let parent_branch = parent.unwrap_or(main_branch);

    // Get existing branches to avoid name collision
    let existing_branches: Vec<String> = repo
        .branches(Some(git2::BranchType::Local))
        .map(|branches| {
            branches
                .filter_map(|b| b.ok())
                .filter_map(|(branch, _)| branch.name().ok().flatten().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    // Generate unique names with format: noun-noun-hash (e.g., ember-river-k9q2m)
    let (display_name, internal_branch) = generate_node_names(&existing_branches);

    // Create manifest (this is fast, keep it synchronous)
    let mut manifest = NodeManifest::new(&internal_branch, &parent_branch, &goal);

    // Auto-detect test command
    if let Some(cmd) = detect_test_command(Path::new(&repo_path)) {
        manifest.tests.command = Some(cmd);
    }

    // Save manifest
    if let Err(e) = save_manifest(Path::new(&repo_path), &manifest) {
        return CommandResult::err(&e.to_string());
    }

    // Create node record in database with pending worktree status
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        r#"INSERT INTO nodes
           (id, repo_id, internal_branch, display_name, parent_branch, original_parent_branch, worktree_path, state,
            worktree_status, goal, checks_completed, checks_total, manifest_valid, tests_passed,
            created_at, updated_at, last_active_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14, ?14)"#,
        (
            &id,
            &repo_id,
            &internal_branch,
            &display_name,
            &parent_branch,
            &parent_branch, // original_parent_branch is same as parent_branch at creation
            NodeState::InProgress.as_str(),
            "pending", // worktree_status starts as pending
            &goal,
            1, // goal is set
            2, // total checks now: goal + tests
            1, // manifest is valid
            0,
            &now,
        ),
    );

    if let Err(e) = result {
        // Clean up manifest on failure
        let _ = crate::manifest::delete_manifest(Path::new(&repo_path), &internal_branch);
        return CommandResult::err(&e.to_string());
    }

    // Log audit entry
    let audit_entry = AuditEntry::new(AuditEventType::NodeCreated, &internal_branch)
        .with_values(None, Some(serde_json::json!({ "goal": goal, "parent": parent_branch })));

    let _ = append_audit_entry(Path::new(&repo_path), &audit_entry);

    // Spawn async worktree creation (non-blocking)
    spawn_create_worktree(
        app,
        CreateWorktreeConfig {
            node_id: id.clone(),
            repo_path: PathBuf::from(&repo_path),
            branch_name: internal_branch.clone(),
            parent_branch: parent_branch.clone(),
            max_retries: DEFAULT_MAX_RETRIES,
        },
    );

    // Return immediately with pending worktree status
    CommandResult::ok(Node {
        id,
        repo_id,
        internal_branch,
        display_name,
        context: None,
        parent_branch: parent_branch.clone(),
        original_parent_branch: Some(parent_branch),
        worktree_path: None, // Will be set by async operation
        state: NodeState::InProgress.as_str().into(),
        worktree_status: "pending".into(),
        goal: Some(goal),
        checks_completed: 1,
        checks_total: 2,
        manifest_valid: true,
        tests_passed: false,
        created_at: now.clone(),
        updated_at: now.clone(),
        last_active_at: now,
    })
}

#[tauri::command]
pub fn list_nodes(repo_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<Node>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = match conn.prepare(
        r#"SELECT id, repo_id, internal_branch, display_name, context, parent_branch, original_parent_branch,
                  worktree_path, state, worktree_status, goal, checks_completed, checks_total, manifest_valid,
                  tests_passed, created_at, updated_at, last_active_at
           FROM nodes WHERE repo_id = ?1 ORDER BY last_active_at DESC"#,
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let nodes: Result<Vec<Node>, _> = stmt
        .query_map([&repo_id], |row| {
            Ok(Node {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                internal_branch: row.get(2)?,
                display_name: row.get(3)?,
                context: row.get(4)?,
                parent_branch: row.get(5)?,
                original_parent_branch: row.get(6)?,
                worktree_path: row.get(7)?,
                state: row.get(8)?,
                worktree_status: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "ready".to_string()),
                goal: row.get(10)?,
                checks_completed: row.get(11)?,
                checks_total: row.get(12)?,
                manifest_valid: row.get::<_, i32>(13)? != 0,
                tests_passed: row.get::<_, i32>(14)? != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                last_active_at: row.get(17)?,
            })
        })
        .and_then(|rows| rows.collect());

    match nodes {
        Ok(n) => CommandResult::ok(n),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// List all nodes across all repositories (for Control Room)
#[tauri::command]
pub fn list_all_nodes(db: State<'_, Arc<Database>>) -> CommandResult<Vec<Node>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = match conn.prepare(
        r#"SELECT id, repo_id, internal_branch, display_name, context, parent_branch, original_parent_branch,
                  worktree_path, state, worktree_status, goal, checks_completed, checks_total, manifest_valid,
                  tests_passed, created_at, updated_at, last_active_at
           FROM nodes ORDER BY last_active_at DESC"#,
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let nodes: Result<Vec<Node>, _> = stmt
        .query_map([], |row| {
            Ok(Node {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                internal_branch: row.get(2)?,
                display_name: row.get(3)?,
                context: row.get(4)?,
                parent_branch: row.get(5)?,
                original_parent_branch: row.get(6)?,
                worktree_path: row.get(7)?,
                state: row.get(8)?,
                worktree_status: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "ready".to_string()),
                goal: row.get(10)?,
                checks_completed: row.get(11)?,
                checks_total: row.get(12)?,
                manifest_valid: row.get::<_, i32>(13)? != 0,
                tests_passed: row.get::<_, i32>(14)? != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                last_active_at: row.get(17)?,
            })
        })
        .and_then(|rows| rows.collect());

    match nodes {
        Ok(n) => CommandResult::ok(n),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn get_node(id: String, db: State<'_, Arc<Database>>) -> CommandResult<NodeWithManifest> {
    let conn = db.conn.lock().unwrap();

    let node: Node = match conn.query_row(
        r#"SELECT id, repo_id, internal_branch, display_name, context, parent_branch, original_parent_branch,
                  worktree_path, state, worktree_status, goal, checks_completed, checks_total, manifest_valid,
                  tests_passed, created_at, updated_at, last_active_at
           FROM nodes WHERE id = ?1"#,
        [&id],
        |row| {
            Ok(Node {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                internal_branch: row.get(2)?,
                display_name: row.get(3)?,
                context: row.get(4)?,
                parent_branch: row.get(5)?,
                original_parent_branch: row.get(6)?,
                worktree_path: row.get(7)?,
                state: row.get(8)?,
                worktree_status: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "ready".to_string()),
                goal: row.get(10)?,
                checks_completed: row.get(11)?,
                checks_total: row.get(12)?,
                manifest_valid: row.get::<_, i32>(13)? != 0,
                tests_passed: row.get::<_, i32>(14)? != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                last_active_at: row.get(17)?,
            })
        },
    ) {
        Ok(n) => n,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Get repo path to load manifest
    let repo_path: String = match conn.query_row(
        "SELECT path FROM repositories WHERE id = ?1",
        [&node.repo_id],
        |row| row.get(0),
    ) {
        Ok(p) => p,
        Err(_) => return CommandResult::err("Repository not found"),
    };

    // Load manifest
    let manifest = crate::manifest::load_manifest(Path::new(&repo_path), &node.internal_branch).ok();

    CommandResult::ok(NodeWithManifest { node, manifest })
}

#[tauri::command]
pub fn update_node_display_name(
    id: String,
    display_name: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        "UPDATE nodes SET display_name = ?1, updated_at = ?2 WHERE id = ?3",
        (&display_name, &now, &id),
    );

    match result {
        Ok(0) => CommandResult::err("Node not found"),
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Delete a node with async worktree cleanup.
///
/// The node is deleted from the database immediately (so UI updates right away).
/// Worktree cleanup (file deletion, git cleanup) happens in a background thread.
#[tauri::command]
pub fn delete_node(
    app: AppHandle,
    id: String,
    force: bool,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    // Get node info including worktree_path
    let (internal_branch, repo_id, state, worktree_path): (String, String, String, Option<String>) = match conn.query_row(
        "SELECT internal_branch, repo_id, state, worktree_path FROM nodes WHERE id = ?1",
        [&id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Check if node can be deleted
    if !force && state != NodeState::Closed.as_str() && state != NodeState::InProgress.as_str() {
        return CommandResult::err("Cannot delete node in this state. Use force=true to override.");
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

    // Delete manifest (fast, synchronous)
    let _ = crate::manifest::delete_manifest(Path::new(&repo_path), &internal_branch);

    // Delete audit log (fast, synchronous)
    let _ = crate::audit::delete_audit_log(Path::new(&repo_path), &internal_branch);

    // Delete from database first (UI updates immediately)
    let result = conn.execute("DELETE FROM nodes WHERE id = ?1", [&id]);

    if let Err(e) = result {
        return CommandResult::err(&e.to_string());
    }

    // Spawn async worktree cleanup (non-blocking)
    spawn_remove_worktree(
        app,
        RemoveWorktreeConfig {
            node_id: id,
            repo_path: PathBuf::from(&repo_path),
            branch_name: internal_branch,
            worktree_path: worktree_path.map(PathBuf::from),
        },
    );

    CommandResult::ok(())
}

/// Retry worktree creation for a node that failed.
///
/// This is useful when the initial worktree creation failed (e.g., due to IO errors)
/// and the user wants to try again.
#[tauri::command]
pub fn retry_worktree_creation(
    app: AppHandle,
    node_id: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    // Get node info
    let (internal_branch, repo_id, parent_branch, worktree_status): (String, String, String, Option<String>) = match conn.query_row(
        "SELECT internal_branch, repo_id, parent_branch, worktree_status FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Check if retry is appropriate
    let status = worktree_status.unwrap_or_else(|| "ready".to_string());
    if status != "failed" && status != "pending" {
        return CommandResult::err(&format!(
            "Cannot retry worktree creation for node with status '{}'",
            status
        ));
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

    // Spawn async worktree creation
    spawn_create_worktree(
        app,
        CreateWorktreeConfig {
            node_id,
            repo_path: PathBuf::from(&repo_path),
            branch_name: internal_branch,
            parent_branch,
            max_retries: DEFAULT_MAX_RETRIES,
        },
    );

    CommandResult::ok(())
}

/// List all local branches for a repository (e.g., main, develop, feature/xyz)
#[tauri::command]
pub fn list_local_branches(repo_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<String>> {
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

    // Get all local branches
    let branches = match repo.branches(Some(git2::BranchType::Local)) {
        Ok(b) => b,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let mut local_branches: Vec<String> = Vec::new();
    for branch_result in branches {
        if let Ok((branch, _)) = branch_result {
            if let Some(name) = branch.name().ok().flatten() {
                local_branches.push(name.to_string());
            }
        }
    }

    // Sort alphabetically, with main/master first
    local_branches.sort_by(|a, b| {
        let a_is_main = a == "main" || a == "master";
        let b_is_main = b == "main" || b == "master";
        match (a_is_main, b_is_main) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.cmp(b),
        }
    });

    CommandResult::ok(local_branches)
}

/// List all remote branches for a repository (e.g., origin/main, origin/develop)
/// Returns branch names with the remote prefix stripped (e.g., "main" instead of "origin/main")
#[tauri::command]
pub fn list_remote_branches(repo_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<String>> {
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

    // Spawn git fetch --prune in background thread (non-blocking)
    // This ensures we don't block the UI while waiting for network I/O
    // The fetch will update remote tracking refs for the next call
    let repo_path_clone = repo_path.clone();
    std::thread::spawn(move || {
        let fetch_result = std::process::Command::new("git")
            .args(["fetch", "--prune", "origin"])
            .current_dir(&repo_path_clone)
            .output();

        if let Err(e) = fetch_result {
            log::warn!("Background git fetch failed: {}", e);
        }
    });

    // Return cached remote branches immediately (don't wait for fetch)
    let repo = match open_repo(Path::new(&repo_path)) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    // Get all remote branches
    let branches = match repo.branches(Some(git2::BranchType::Remote)) {
        Ok(b) => b,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let mut remote_branches: Vec<String> = Vec::new();
    for branch_result in branches {
        if let Ok((branch, _)) = branch_result {
            if let Some(name) = branch.name().ok().flatten() {
                // Keep full remote ref name (e.g., "origin/main")
                // Skip HEAD references (e.g., "origin/HEAD")
                if let Some(slash_pos) = name.find('/') {
                    let branch_name = &name[slash_pos + 1..];
                    if branch_name != "HEAD" && !remote_branches.contains(&name.to_string()) {
                        remote_branches.push(name.to_string());
                    }
                }
            }
        }
    }

    // Sort alphabetically, with main/master first
    remote_branches.sort_by(|a, b| {
        let a_is_main = a.ends_with("/main") || a.ends_with("/master");
        let b_is_main = b.ends_with("/main") || b.ends_with("/master");
        match (a_is_main, b_is_main) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.cmp(b),
        }
    });

    CommandResult::ok(remote_branches)
}

/// Update the parent (base) branch for a node
/// This only updates metadata - does NOT rebase or merge
#[tauri::command]
pub fn update_node_parent_branch(
    id: String,
    parent_branch: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    // First verify the node exists and get its info
    let (repo_id, internal_branch): (String, String) = match conn.query_row(
        "SELECT repo_id, internal_branch FROM nodes WHERE id = ?1",
        [&id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
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

    // Update the database
    let result = conn.execute(
        "UPDATE nodes SET parent_branch = ?1, updated_at = ?2 WHERE id = ?3",
        (&parent_branch, &now, &id),
    );

    if let Err(e) = result {
        return CommandResult::err(&e.to_string());
    }

    // Update the manifest if it exists
    if let Ok(mut manifest) = crate::manifest::load_manifest(Path::new(&repo_path), &internal_branch) {
        manifest.parent = parent_branch.clone();
        let _ = save_manifest(Path::new(&repo_path), &manifest);
    }

    CommandResult::ok(())
}

/// Safely rename a node, including its underlying git branch and worktree
/// This is a collision-safe operation that does NOT rewrite history
#[tauri::command]
pub fn rename_node(
    id: String,
    new_display_name: String,
    rename_git_branch: bool,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Node> {
    let conn = db.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    // Get node info
    let (repo_id, internal_branch, worktree_path): (String, String, Option<String>) = match conn.query_row(
        "SELECT repo_id, internal_branch, worktree_path FROM nodes WHERE id = ?1",
        [&id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ) {
        Ok(info) => info,
        Err(_) => return CommandResult::err("Node not found"),
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

    let mut new_internal_branch = internal_branch.clone();
    let mut new_worktree_path = worktree_path.clone();

    // Optionally rename the git branch and worktree
    if rename_git_branch {
        let repo = match open_repo(Path::new(&repo_path)) {
            Ok(r) => r,
            Err(e) => return CommandResult::err(&e.to_string()),
        };

        // Generate new internal branch name from display name
        // Convert to lowercase, replace spaces with hyphens, keep only alphanumeric and hyphens
        let proposed_branch = new_display_name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>();

        // Check if branch name already exists
        let existing_branches: Vec<String> = repo
            .branches(Some(git2::BranchType::Local))
            .map(|branches| {
                branches
                    .filter_map(|b| b.ok())
                    .filter_map(|(branch, _)| branch.name().ok().flatten().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        // Generate unique name if collision (append random suffix)
        new_internal_branch = if existing_branches.contains(&proposed_branch) && proposed_branch != internal_branch {
            let mut rng = rand::thread_rng();
            let suffix: u16 = rng.gen_range(100..1000);
            format!("{}{}", proposed_branch, suffix)
        } else {
            proposed_branch
        };

        // Only rename if the name actually changed
        if new_internal_branch != internal_branch {
            // Find the branch
            let mut branch = match repo.find_branch(&internal_branch, git2::BranchType::Local) {
                Ok(b) => b,
                Err(e) => return CommandResult::err(&format!("Branch not found: {}", e)),
            };

            // Rename the branch
            if let Err(e) = branch.rename(&new_internal_branch, false) {
                return CommandResult::err(&format!("Failed to rename branch: {}", e));
            }

            // Handle worktree rename if it exists
            if let Some(ref old_wt_path) = worktree_path {
                let old_path = Path::new(old_wt_path);
                if old_path.exists() {
                    // Create new worktree path - sanitize branch name (replace / with -)
                    let worktrees_dir = crate::git::get_worktrees_dir(Path::new(&repo_path));
                    let sanitized_name = new_internal_branch.replace('/', "-");
                    let new_wt_path = worktrees_dir.join(&sanitized_name);

                    // Rename the worktree directory
                    if let Err(e) = std::fs::rename(old_path, &new_wt_path) {
                        // Rollback branch rename on failure
                        if let Ok(mut b) = repo.find_branch(&new_internal_branch, git2::BranchType::Local) {
                            let _ = b.rename(&internal_branch, false);
                        }
                        return CommandResult::err(&format!("Failed to rename worktree: {}", e));
                    }

                    new_worktree_path = Some(new_wt_path.to_string_lossy().to_string());
                }
            }

            // Rename the manifest file
            let old_manifest_path = Path::new(&repo_path)
                .join(".caspian")
                .join("manifests")
                .join(format!("{}.yaml", internal_branch.replace('/', "_")));

            let new_manifest_path = Path::new(&repo_path)
                .join(".caspian")
                .join("manifests")
                .join(format!("{}.yaml", new_internal_branch.replace('/', "_")));

            if old_manifest_path.exists() {
                // Load, update node_id, and save to new path
                if let Ok(mut manifest) = crate::manifest::load_manifest(Path::new(&repo_path), &internal_branch) {
                    manifest.node_id = new_internal_branch.clone();
                    // Save to new location
                    if let Some(parent) = new_manifest_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let content = serde_yaml::to_string(&manifest).unwrap_or_default();
                    let _ = std::fs::write(&new_manifest_path, content);
                    // Remove old manifest
                    let _ = std::fs::remove_file(&old_manifest_path);
                }
            }
        }
    }

    // Update the database
    let result = conn.execute(
        "UPDATE nodes SET display_name = ?1, internal_branch = ?2, worktree_path = ?3, updated_at = ?4 WHERE id = ?5",
        (&new_display_name, &new_internal_branch, &new_worktree_path, &now, &id),
    );

    if let Err(e) = result {
        return CommandResult::err(&e.to_string());
    }

    // Fetch and return the updated node
    let node: Node = match conn.query_row(
        r#"SELECT id, repo_id, internal_branch, display_name, context, parent_branch, original_parent_branch,
                  worktree_path, state, worktree_status, goal, checks_completed, checks_total, manifest_valid,
                  tests_passed, created_at, updated_at, last_active_at
           FROM nodes WHERE id = ?1"#,
        [&id],
        |row| {
            Ok(Node {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                internal_branch: row.get(2)?,
                display_name: row.get(3)?,
                context: row.get(4)?,
                parent_branch: row.get(5)?,
                original_parent_branch: row.get(6)?,
                worktree_path: row.get(7)?,
                state: row.get(8)?,
                worktree_status: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "ready".to_string()),
                goal: row.get(10)?,
                checks_completed: row.get(11)?,
                checks_total: row.get(12)?,
                manifest_valid: row.get::<_, i32>(13)? != 0,
                tests_passed: row.get::<_, i32>(14)? != 0,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
                last_active_at: row.get(17)?,
            })
        },
    ) {
        Ok(n) => n,
        Err(_) => return CommandResult::err("Failed to fetch updated node"),
    };

    CommandResult::ok(node)
}

/// Update the context field for a node (auto-generated from agent responses)
#[tauri::command]
pub fn update_node_context(
    id: String,
    context: String,
    db: State<'_, Arc<Database>>,
) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        "UPDATE nodes SET context = ?1, updated_at = ?2 WHERE id = ?3",
        (&context, &now, &id),
    );

    match result {
        Ok(0) => CommandResult::err("Node not found"),
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}
