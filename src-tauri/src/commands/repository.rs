use crate::db::Database;
use crate::git::{clone_repo, get_main_branch, has_commits, init_repo, is_git_repo, open_repo};
use chrono::Utc;
use log;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tauri_plugin_fs::FsExt;
use uuid::Uuid;

/// Helper to add a directory and its subdirectories to the FS scope
fn allow_directory_in_scope(app: &AppHandle, path: &Path) {
    if let Some(scope) = app.try_fs_scope() {
        // Allow the directory itself
        let _ = scope.allow_directory(path, true); // recursive = true

        // Also allow the .caspian directory if it exists
        let caspian_dir = path.join(".caspian");
        if caspian_dir.exists() {
            let _ = scope.allow_directory(&caspian_dir, true);
        }

        // Allow worktrees directory
        let worktrees_dir = path.join(".caspian").join("worktrees");
        if worktrees_dir.exists() {
            let _ = scope.allow_directory(&worktrees_dir, true);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub name: String,
    pub path: String,
    pub main_branch: String,
    pub created_at: String,
    pub last_accessed_at: Option<String>,
    /// Whether the repository path exists on disk
    pub path_exists: bool,
}

#[derive(Debug, Serialize)]
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

    pub fn err(error: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error.into()),
        }
    }
}

#[tauri::command]
pub fn add_repository(
    path: String,
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Repository> {
    let repo_path = Path::new(&path);

    // Validate path
    if !repo_path.exists() {
        return CommandResult::err("Path does not exist");
    }

    if !repo_path.is_dir() {
        return CommandResult::err("Path is not a directory");
    }

    if !is_git_repo(repo_path) {
        return CommandResult::err("Path is not a git repository");
    }

    // Add to FS scope so frontend can access files
    allow_directory_in_scope(&app, repo_path);

    // Get repository info
    let repo = match open_repo(repo_path) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let main_branch = get_main_branch(&repo).unwrap_or_else(|_| "main".into());

    let name = repo_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".into());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let conn = db.conn.lock().unwrap();

    // Check if repository already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM repositories WHERE path = ?1",
            [&path],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return CommandResult::err("Repository already exists");
    }

    // Insert new repository
    let result = conn.execute(
        "INSERT INTO repositories (id, name, path, main_branch, created_at, last_accessed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        (&id, &name, &path, &main_branch, &now),
    );

    match result {
        Ok(_) => CommandResult::ok(Repository {
            id,
            name,
            path,
            main_branch,
            created_at: now.clone(),
            last_accessed_at: Some(now),
            path_exists: true, // We just validated it exists
        }),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn list_repositories(
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Vec<Repository>> {
    let conn = db.conn.lock().unwrap();

    let mut stmt = match conn.prepare(
        "SELECT id, name, path, main_branch, created_at, last_accessed_at FROM repositories ORDER BY name",
    ) {
        Ok(s) => s,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    let repos: Result<Vec<Repository>, _> = stmt
        .query_map([], |row| {
            let path: String = row.get(2)?;
            let path_exists = Path::new(&path).exists();
            Ok(Repository {
                id: row.get(0)?,
                name: row.get(1)?,
                path,
                main_branch: row.get(3)?,
                created_at: row.get(4)?,
                last_accessed_at: row.get(5)?,
                path_exists,
            })
        })
        .and_then(|rows| rows.collect());

    match repos {
        Ok(r) => {
            // Add all existing repository paths to FS scope so frontend can access files
            for repo in &r {
                if repo.path_exists {
                    let repo_path = Path::new(&repo.path);
                    allow_directory_in_scope(&app, repo_path);
                }
            }
            CommandResult::ok(r)
        }
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn get_repository(id: String, db: State<'_, Arc<Database>>) -> CommandResult<Repository> {
    let conn = db.conn.lock().unwrap();

    let result = conn.query_row(
        "SELECT id, name, path, main_branch, created_at, last_accessed_at FROM repositories WHERE id = ?1",
        [&id],
        |row| {
            let path: String = row.get(2)?;
            let path_exists = Path::new(&path).exists();
            Ok(Repository {
                id: row.get(0)?,
                name: row.get(1)?,
                path,
                main_branch: row.get(3)?,
                created_at: row.get(4)?,
                last_accessed_at: row.get(5)?,
                path_exists,
            })
        },
    );

    match result {
        Ok(repo) => CommandResult::ok(repo),
        Err(_) => CommandResult::err("Repository not found"),
    }
}

#[tauri::command]
pub fn remove_repository(id: String, db: State<'_, Arc<Database>>) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();

    // Delete associated branches first
    let _ = conn.execute("DELETE FROM branches WHERE repo_id = ?1", [&id]);

    // Delete the repository
    let result = conn.execute("DELETE FROM repositories WHERE id = ?1", [&id]);

    match result {
        Ok(0) => CommandResult::err("Repository not found"),
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

#[tauri::command]
pub fn update_last_accessed(id: String, db: State<'_, Arc<Database>>) -> CommandResult<()> {
    let conn = db.conn.lock().unwrap();
    let now = Utc::now().to_rfc3339();

    let result = conn.execute(
        "UPDATE repositories SET last_accessed_at = ?1 WHERE id = ?2",
        (&now, &id),
    );

    match result {
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Result of checking git status for a path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCheckResult {
    pub is_git_repo: bool,
    pub has_commits: bool,
    pub path: String,
}

/// Check if a path is a git repository and has commits
#[tauri::command]
pub fn check_git_status(path: String) -> CommandResult<GitCheckResult> {
    let repo_path = Path::new(&path);

    if !repo_path.exists() {
        return CommandResult::err("Path does not exist");
    }

    if !repo_path.is_dir() {
        return CommandResult::err("Path is not a directory");
    }

    let is_repo = is_git_repo(repo_path);
    let has_any_commits = if is_repo {
        match open_repo(repo_path) {
            Ok(repo) => has_commits(&repo),
            Err(_) => false,
        }
    } else {
        false
    };

    CommandResult::ok(GitCheckResult {
        is_git_repo: is_repo,
        has_commits: has_any_commits,
        path,
    })
}

/// Initialize a git repository at the given path and add it to the database
#[tauri::command]
pub fn init_repository(
    path: String,
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Repository> {
    let repo_path = Path::new(&path);

    // Validate path
    if !repo_path.exists() {
        return CommandResult::err("Path does not exist");
    }

    if !repo_path.is_dir() {
        return CommandResult::err("Path is not a directory");
    }

    // Check if already a git repo
    if is_git_repo(repo_path) {
        return CommandResult::err("Path is already a git repository");
    }

    // Initialize git repository
    let repo = match init_repo(repo_path) {
        Ok(r) => r,
        Err(e) => return CommandResult::err(&format!("Failed to initialize git: {}", e)),
    };

    // Add to FS scope so frontend can access files
    allow_directory_in_scope(&app, repo_path);

    let main_branch = get_main_branch(&repo).unwrap_or_else(|_| "main".into());

    let name = repo_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".into());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let conn = db.conn.lock().unwrap();

    // Check if repository already exists
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM repositories WHERE path = ?1",
            [&path],
            |row| row.get(0),
        )
        .ok();

    if existing.is_some() {
        return CommandResult::err("Repository already exists in database");
    }

    // Insert new repository
    let result = conn.execute(
        "INSERT INTO repositories (id, name, path, main_branch, created_at, last_accessed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        (&id, &name, &path, &main_branch, &now),
    );

    match result {
        Ok(_) => CommandResult::ok(Repository {
            id,
            name,
            path,
            main_branch,
            created_at: now.clone(),
            last_accessed_at: Some(now),
            path_exists: true, // We just initialized it
        }),
        Err(e) => CommandResult::err(&e.to_string()),
    }
}

/// Clone a repository from a URL to a destination and add it to the database
#[tauri::command]
pub fn clone_repository(
    url: String,
    destination: String,
    app: AppHandle,
    db: State<'_, Arc<Database>>,
) -> CommandResult<Repository> {
    let dest_path = Path::new(&destination);

    // Check if destination already exists on disk
    if dest_path.exists() {
        return CommandResult::err("Destination path already exists");
    }

    // Check if path already exists in database (orphaned entry from previous attempt)
    // If so, delete it first
    {
        let conn = db.conn.lock().unwrap();
        let _ = conn.execute("DELETE FROM repositories WHERE path = ?1", [&destination]);
    }

    // Clone the repository
    let repo = match clone_repo(&url, dest_path) {
        Ok(r) => r,
        Err(e) => {
            // Extract just the error message without the error type prefix
            let msg = e.to_string();
            let clean_msg = msg
                .strip_prefix("Worktree error: ")
                .or_else(|| msg.strip_prefix("Git error: "))
                .unwrap_or(&msg);
            return CommandResult::err(clean_msg);
        }
    };

    // Add to FS scope so frontend can access files
    allow_directory_in_scope(&app, dest_path);

    let main_branch = get_main_branch(&repo).unwrap_or_else(|_| "main".into());

    let name = dest_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".into());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let conn = db.conn.lock().unwrap();

    // Insert new repository
    let result = conn.execute(
        "INSERT INTO repositories (id, name, path, main_branch, created_at, last_accessed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        (&id, &name, &destination, &main_branch, &now),
    );

    match result {
        Ok(_) => CommandResult::ok(Repository {
            id,
            name,
            path: destination,
            main_branch,
            created_at: now.clone(),
            last_accessed_at: Some(now),
            path_exists: true, // We just cloned it
        }),
        Err(e) => {
            // Cleanup: remove the cloned folder since DB insert failed
            if let Err(cleanup_err) = std::fs::remove_dir_all(&destination) {
                log::error!("Failed to cleanup cloned folder after DB error: {}", cleanup_err);
            }
            CommandResult::err(&format!("Failed to save repository: {}", e))
        }
    }
}

/// Create a directory at the given path
#[tauri::command]
pub fn create_directory(path: String) -> CommandResult<()> {
    let dir_path = Path::new(&path);

    if dir_path.exists() {
        return CommandResult::err("Path already exists");
    }

    match std::fs::create_dir_all(dir_path) {
        Ok(_) => CommandResult::ok(()),
        Err(e) => CommandResult::err(&format!("Failed to create directory: {}", e)),
    }
}

/// Test Sentry integration - sends a test error to verify Sentry is working
/// Remove this command after testing
#[tauri::command]
pub fn test_sentry() -> CommandResult<String> {
    use crate::sentry_utils;

    // Send a test error to Sentry
    sentry_utils::capture_error(&"Test error from Caspian app", "sentry_test");

    // Add a test breadcrumb
    sentry_utils::add_breadcrumb("test", "Sentry test triggered", sentry::Level::Info);

    // Capture a test message
    sentry::capture_message("Sentry test successful from Caspian!", sentry::Level::Info);

    CommandResult::ok("Sentry test sent! Check your Sentry dashboard.".to_string())
}
