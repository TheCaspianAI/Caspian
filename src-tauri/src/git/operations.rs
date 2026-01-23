use super::GitResult;
use std::path::Path;

/// Get working directory changes (uncommitted changes) in a worktree
/// Uses git CLI for reliable output format
pub fn get_worktree_diff(worktree_path: &Path) -> GitResult<String> {
    use super::GitError;
    use std::process::Command;

    // Use git diff HEAD to get all uncommitted changes (staged + unstaged)
    let output = Command::new("git")
        .args(["diff", "HEAD"])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        // If HEAD doesn't exist (no commits), try diffing against empty tree
        let output = Command::new("git")
            .args(["diff", "--cached"])
            .current_dir(worktree_path)
            .output()?;

        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(GitError::WorktreeError(stderr.to_string()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
