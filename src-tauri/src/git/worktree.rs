use super::{GitError, GitResult};
use git2::Repository;
use log;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

/// Worktree information
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: PathBuf,
    pub branch: String,
}

/// Get the worktrees directory for a repository
pub fn get_worktrees_dir(repo_path: &Path) -> PathBuf {
    let mut path = repo_path.to_path_buf();
    path.push(".caspian");
    path.push("worktrees");
    path
}

/// Ensure `.caspian` is in the repository's `.gitignore` file.
/// If `.gitignore` exists, appends `.caspian` if not already present.
/// If `.gitignore` doesn't exist, creates it with `.caspian` as the first entry.
fn ensure_caspian_in_gitignore(repo_path: &Path) -> std::io::Result<()> {
    let gitignore_path = repo_path.join(".gitignore");
    let caspian_entry = ".caspian";

    if gitignore_path.exists() {
        // Check if .caspian is already in the file
        let file = fs::File::open(&gitignore_path)?;
        let reader = BufReader::new(file);

        for line in reader.lines() {
            let line = line?;
            let trimmed = line.trim();
            // Check for exact match or with trailing slash
            if trimmed == caspian_entry || trimmed == ".caspian/" {
                log::debug!(".caspian already in .gitignore");
                return Ok(());
            }
        }

        // .caspian not found, append it
        let mut file = OpenOptions::new()
            .append(true)
            .open(&gitignore_path)?;

        // Add a newline before if file doesn't end with one
        let contents = fs::read_to_string(&gitignore_path)?;
        if !contents.ends_with('\n') && !contents.is_empty() {
            writeln!(file)?;
        }
        writeln!(file, "{}", caspian_entry)?;
        log::info!("Added .caspian to existing .gitignore");
    } else {
        // Create new .gitignore with .caspian
        let mut file = fs::File::create(&gitignore_path)?;
        writeln!(file, "{}", caspian_entry)?;
        log::info!("Created .gitignore with .caspian entry");
    }

    Ok(())
}

use std::time::Instant;

/// Create a new worktree for a reasoning branch
pub fn create_worktree(
    repo: &Repository,
    branch_name: &str,
    parent_branch: &str,
) -> GitResult<WorktreeInfo> {
    let t0 = Instant::now();

    let repo_path = repo
        .workdir()
        .ok_or_else(|| GitError::WorktreeError("Repository has no working directory".into()))?;

    let worktrees_dir = get_worktrees_dir(repo_path);
    std::fs::create_dir_all(&worktrees_dir)?;

    // Ensure .caspian is in .gitignore so it doesn't show up in git status/diff
    if let Err(e) = ensure_caspian_in_gitignore(repo_path) {
        log::warn!("Failed to add .caspian to .gitignore: {}", e);
        // Continue anyway - this is not a critical error
    }

    // Sanitize branch name for worktree name (replace / with -)
    // Git uses the worktree name for .git/worktrees/<name>, so it can't contain /
    let worktree_name = branch_name.replace('/', "-");
    let worktree_path = worktrees_dir.join(&worktree_name);

    // Check if worktree already exists
    if worktree_path.exists() {
        return Err(GitError::WorktreeError(format!(
            "Worktree already exists at {}",
            worktree_path.display()
        )));
    }

    // Find the parent branch to get its commit
    // Support both remote refs (origin/main) and local branches (main)
    let parent_commit = if parent_branch.contains('/') {
        // Remote branch format: origin/branch_name
        // Look up as remote tracking branch
        let remote_ref = format!("refs/remotes/{}", parent_branch);
        let reference = repo.find_reference(&remote_ref)
            .map_err(|_| GitError::BranchNotFound(parent_branch.into()))?;
        reference.peel_to_commit()?
    } else {
        // Local branch format
        let parent = repo
            .find_branch(parent_branch, git2::BranchType::Local)
            .map_err(|_| GitError::BranchNotFound(parent_branch.into()))?;
        parent.get().peel_to_commit()?
    };

    // Create the new branch
    let _branch = repo.branch(branch_name, &parent_commit, false)?;

    // Add the worktree
    let ref_name = format!("refs/heads/{}", branch_name);
    let reference = repo.find_reference(&ref_name)?;
    let wt = repo.worktree(
        &worktree_name, // Use sanitized name for worktree
        &worktree_path,
        Some(git2::WorktreeAddOptions::new().reference(Some(&reference))),
    )?;

    // Get tree ID from parent commit (while using main repo)
    let tree_id = parent_commit.tree_id();

    // Open the newly created worktree as a repository
    let worktree_repo = Repository::open(&worktree_path)?;

    // Set HEAD to point to the new branch
    worktree_repo.set_head(&ref_name)?;

    // Fetch the tree from worktree's ODB (shared with parent repo)
    let tree = worktree_repo.find_tree(tree_id).map_err(|e| {
        GitError::WorktreeError(format!(
            "Failed to find tree {} in worktree repository: {}",
            tree_id, e
        ))
    })?;

    let t_checkout = Instant::now();

    // Checkout the tree to populate the worktree with actual files.
    //
    // Performance note:
    // - `force()` can cause unnecessary rewrites and extra filesystem churn.
    // - `recreate_missing(true)` can also increase work on large trees.
    //
    // For a newly-created worktree, the default checkout behavior is typically sufficient
    // and significantly faster on large repositories.
    let mut checkout = git2::build::CheckoutBuilder::new();
    // Keep defaults: no force, no recreate_missing.
    // This avoids rewriting files unnecessarily and reduces IO.
    worktree_repo
        .checkout_tree(tree.as_object(), Some(&mut checkout))
        .map_err(|e| {
            GitError::WorktreeError(format!("Failed to checkout files to worktree: {}", e))
        })?;

    log::info!(
        "[worktree] create_worktree branch={} parent={} total_ms={} checkout_ms={} path={}",
        branch_name,
        parent_branch,
        t0.elapsed().as_millis(),
        t_checkout.elapsed().as_millis(),
        worktree_path.display()
    );

    Ok(WorktreeInfo {
        name: wt.name().unwrap_or(&worktree_name).to_string(),
        path: worktree_path,
        branch: branch_name.to_string(),
    })
}

/// Remove a worktree
pub fn remove_worktree(repo: &Repository, name: &str) -> GitResult<()> {
    // Sanitize the name (in case it's a branch name with /)
    let worktree_name = name.replace('/', "-");

    // Find the worktree
    let wt = repo
        .find_worktree(&worktree_name)
        .map_err(|_| GitError::WorktreeError(format!("Worktree '{}' not found", worktree_name)))?;

    // Get the path before pruning
    let path = wt.path().to_path_buf();

    // Remove the worktree directory
    if path.exists() {
        std::fs::remove_dir_all(&path)?;
    }

    // Prune the worktree
    repo.worktree(&worktree_name, &path, None).ok(); // Ignore errors as the worktree might already be invalid

    // Use git worktree prune equivalent
    let worktrees = repo.worktrees()?;
    for wt_name in worktrees.iter().flatten() {
        if let Ok(wt) = repo.find_worktree(wt_name) {
            if !wt.path().exists() {
                // Worktree path doesn't exist, it will be pruned automatically
            }
        }
    }

    Ok(())
}
