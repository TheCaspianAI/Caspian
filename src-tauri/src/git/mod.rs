mod worktree;
mod operations;
pub mod naming;
pub mod worktree_async;

pub use worktree::*;
pub use operations::*;
pub use naming::*;
pub use worktree_async::*;

use git2::Repository;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Git error: {0}")]
    Git2(#[from] git2::Error),
    #[error("Repository not found at path: {0}")]
    RepoNotFound(String),
    #[error("Branch not found: {0}")]
    BranchNotFound(String),
    #[error("Worktree error: {0}")]
    WorktreeError(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type GitResult<T> = Result<T, GitError>;

/// Check if a path is a valid git repository
pub fn is_git_repo(path: &Path) -> bool {
    Repository::open(path).is_ok()
}

/// Open a git repository at the given path
pub fn open_repo(path: &Path) -> GitResult<Repository> {
    Repository::open(path).map_err(|_| GitError::RepoNotFound(path.display().to_string()))
}

/// Get the main branch name for a repository
pub fn get_main_branch(repo: &Repository) -> GitResult<String> {
    // Try common main branch names
    for name in &["main", "master"] {
        if repo.find_branch(name, git2::BranchType::Local).is_ok() {
            return Ok(name.to_string());
        }
    }

    // Fall back to HEAD's branch name
    let head = repo.head()?;
    if let Some(name) = head.shorthand() {
        return Ok(name.to_string());
    }

    Ok("main".to_string())
}

/// Initialize a new git repository at the given path
pub fn init_repo(path: &Path) -> GitResult<Repository> {
    Repository::init(path).map_err(GitError::from)
}

/// Clone a repository from a URL to a local path
/// Uses the system's git CLI to leverage credential helpers
pub fn clone_repo(url: &str, path: &Path) -> GitResult<Repository> {
    use std::process::Command;

    let output = Command::new("git")
        .args(["clone", url, &path.to_string_lossy()])
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let error_msg = parse_clone_error(&stderr, url);
        return Err(GitError::WorktreeError(error_msg));
    }

    // Open the cloned repository
    Repository::open(path).map_err(GitError::from)
}

/// Parse git clone errors into user-friendly messages
fn parse_clone_error(stderr: &str, url: &str) -> String {
    let stderr_lower = stderr.to_lowercase();

    if stderr_lower.contains("does not exist") || stderr_lower.contains("not found") {
        return format!("Repository not found: '{}'", url);
    }

    if stderr_lower.contains("authentication") || stderr_lower.contains("permission denied") {
        return "Authentication failed. Check your credentials or repository access.".to_string();
    }

    if stderr_lower.contains("could not resolve host") {
        return "Could not connect to server. Check your internet connection.".to_string();
    }

    if stderr_lower.contains("already exists") {
        return "Destination folder already exists.".to_string();
    }

    if stderr_lower.contains("invalid") {
        return format!("Invalid repository URL: '{}'", url);
    }

    // Fallback: clean up the error message
    stderr
        .lines()
        .find(|line| line.starts_with("fatal:"))
        .map(|line| line.trim_start_matches("fatal:").trim().to_string())
        .unwrap_or_else(|| stderr.trim().to_string())
}

/// Check if a repository has any commits
pub fn has_commits(repo: &Repository) -> bool {
    repo.head().is_ok()
}
