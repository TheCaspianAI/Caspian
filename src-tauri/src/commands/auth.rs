use tauri::{AppHandle, Emitter};

use crate::auth::{AuthError, AuthStatus, GitHubUser};

use super::repository::CommandResult;

// ============================================================================
// Git-Based Authentication Commands
// ============================================================================
// We use git directly instead of requiring gh CLI OAuth.
// If git is configured and can access GitHub (via SSH or credentials), we're good.

/// Check if git is installed and configured
#[tauri::command]
pub async fn check_git_configured() -> CommandResult<bool> {
    // Check if git is installed
    let git_check = std::process::Command::new("git")
        .args(["--version"])
        .output();

    if git_check.is_err() || !git_check.unwrap().status.success() {
        return CommandResult::ok(false);
    }

    // Check if user.name is configured
    let name_check = std::process::Command::new("git")
        .args(["config", "--global", "user.name"])
        .output();

    let has_name = name_check
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);

    // Check if user.email is configured
    let email_check = std::process::Command::new("git")
        .args(["config", "--global", "user.email"])
        .output();

    let has_email = email_check
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false);

    CommandResult::ok(has_name && has_email)
}

/// Get git user info from git config
#[tauri::command]
pub async fn get_git_user() -> CommandResult<GitHubUser> {
    let name = std::process::Command::new("git")
        .args(["config", "--global", "user.name"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let email = std::process::Command::new("git")
        .args(["config", "--global", "user.email"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    if name.is_empty() && email.is_empty() {
        return CommandResult::err("Git user not configured. Run: git config --global user.name \"Your Name\" && git config --global user.email \"you@example.com\"");
    }

    // Create a simple user object from git config
    // We use email hash for a pseudo-ID and derive login from email
    let login = email
        .split('@')
        .next()
        .unwrap_or(&name)
        .to_string();

    CommandResult::ok(GitHubUser {
        id: email.bytes().map(|b| b as i64).sum(), // Simple hash as ID
        login,
        name: if name.is_empty() { None } else { Some(name) },
        email: if email.is_empty() { None } else { Some(email) },
        avatar_url: None,
    })
}

/// Get current authentication status by checking git config
#[tauri::command]
pub async fn get_auth_status() -> CommandResult<AuthStatus> {
    match get_git_user().await {
        CommandResult { success: true, data: Some(user), .. } => {
            CommandResult::ok(AuthStatus::Authenticated { user })
        }
        _ => CommandResult::ok(AuthStatus::Unauthenticated),
    }
}

// ============================================================================
// Legacy gh CLI commands (kept for backwards compatibility)
// ============================================================================

/// Check if gh CLI is installed
#[tauri::command]
pub async fn check_gh_cli_installed() -> CommandResult<bool> {
    match std::process::Command::new("which").arg("gh").output() {
        Ok(output) => CommandResult::ok(output.status.success()),
        Err(_) => CommandResult::ok(false),
    }
}

/// Check if gh CLI is authenticated
#[tauri::command]
pub async fn check_gh_cli_auth() -> CommandResult<bool> {
    match std::process::Command::new("gh")
        .args(["auth", "status"])
        .output()
    {
        Ok(output) => CommandResult::ok(output.status.success()),
        Err(_) => CommandResult::ok(false),
    }
}

/// Install gh CLI using Homebrew (macOS) - kept for optional features
#[tauri::command]
pub async fn install_gh_cli() -> CommandResult<()> {
    log::info!("Installing gh CLI via Homebrew");

    let brew_check = std::process::Command::new("which").arg("brew").output();

    match brew_check {
        Ok(output) if output.status.success() => {
            match std::process::Command::new("brew")
                .args(["install", "gh"])
                .output()
            {
                Ok(output) if output.status.success() => {
                    log::info!("gh CLI installed successfully");
                    CommandResult::ok(())
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    CommandResult::err(&format!("Failed to install gh: {}", stderr))
                }
                Err(e) => CommandResult::err(&format!("Failed to run brew: {}", e)),
            }
        }
        _ => CommandResult::err(
            "Homebrew not found. Please install gh CLI manually: https://cli.github.com/",
        ),
    }
}

/// Run gh auth login - now just returns the git user since we don't require gh OAuth
#[tauri::command]
pub async fn run_gh_auth_login(app: AppHandle) -> CommandResult<GitHubUser> {
    log::info!("Checking git configuration for auth");

    // Just verify git is configured and return the user
    match get_git_user().await {
        CommandResult { success: true, data: Some(user), .. } => {
            let _ = app.emit("auth:success", user.clone());
            CommandResult::ok(user)
        }
        _ => {
            let err_msg = "Git is not configured. Please set up git with your name and email.";
            let _ = app.emit("auth:error", err_msg);
            CommandResult::err(err_msg)
        }
    }
}

/// Sign out - runs `gh auth logout`
#[tauri::command]
pub async fn sign_out(app: AppHandle) -> CommandResult<()> {
    log::info!("Signing out via gh auth logout");

    match std::process::Command::new("gh")
        .args(["auth", "logout", "-h", "github.com"])
        .stdin(std::process::Stdio::null())
        .output()
    {
        Ok(output) if output.status.success() => {
            let _ = app.emit("auth:signed_out", ());
            CommandResult::ok(())
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // gh auth logout may fail if not logged in, which is fine
            if stderr.contains("not logged") || stderr.contains("no") {
                let _ = app.emit("auth:signed_out", ());
                CommandResult::ok(())
            } else {
                CommandResult::err(&format!("gh auth logout failed: {}", stderr))
            }
        }
        Err(e) => CommandResult::err(&format!("Failed to run gh auth logout: {}", e)),
    }
}

/// Get current GitHub user via `gh api user`
#[tauri::command]
pub async fn get_github_user() -> CommandResult<Option<GitHubUser>> {
    match fetch_github_user_via_gh().await {
        Ok(user) => CommandResult::ok(Some(user)),
        Err(_) => CommandResult::ok(None),
    }
}

/// Get the actor string for audit logging
/// Returns "github:username" if authenticated, "human" otherwise
#[tauri::command]
pub async fn get_auth_actor() -> CommandResult<String> {
    match fetch_github_user_via_gh().await {
        Ok(user) => CommandResult::ok(format!("github:{}", user.login)),
        Err(_) => CommandResult::ok("human".to_string()),
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Fetch GitHub user info using `gh api user`
async fn fetch_github_user_via_gh() -> Result<GitHubUser, AuthError> {
    let output = std::process::Command::new("gh")
        .args(["api", "user"])
        .output()
        .map_err(|e| AuthError::GitHubApiError(format!("Failed to run gh api user: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AuthError::GitHubApiError(format!(
            "gh api user failed: {}",
            stderr
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(serde::Deserialize)]
    struct GhApiUserResponse {
        id: i64,
        login: String,
        name: Option<String>,
        email: Option<String>,
        avatar_url: Option<String>,
    }

    let response: GhApiUserResponse = serde_json::from_str(&stdout)
        .map_err(|e| AuthError::GitHubApiError(format!("Failed to parse user response: {}", e)))?;

    Ok(GitHubUser {
        id: response.id,
        login: response.login,
        name: response.name,
        email: response.email,
        avatar_url: response.avatar_url,
    })
}
