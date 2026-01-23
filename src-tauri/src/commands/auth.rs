use tauri::{AppHandle, Emitter};

use crate::auth::{AuthError, AuthStatus, GitHubUser};

use super::repository::CommandResult;

// ============================================================================
// GitHub CLI (gh) Based Authentication Commands
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

/// Install gh CLI using Homebrew (macOS)
#[tauri::command]
pub async fn install_gh_cli() -> CommandResult<()> {
    log::info!("Installing gh CLI via Homebrew");

    // Check if Homebrew is available
    let brew_check = std::process::Command::new("which").arg("brew").output();

    match brew_check {
        Ok(output) if output.status.success() => {
            // Install gh via Homebrew
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
        _ => {
            // Homebrew not available
            CommandResult::err(
                "Homebrew not found. Please install gh CLI manually: https://cli.github.com/",
            )
        }
    }
}

/// Get current authentication status by checking gh CLI auth
#[tauri::command]
pub async fn get_auth_status() -> CommandResult<AuthStatus> {
    // Check if gh CLI is authenticated
    let auth_check = std::process::Command::new("gh")
        .args(["auth", "status"])
        .output();

    match auth_check {
        Ok(output) if output.status.success() => {
            // gh CLI is authenticated, fetch user info
            match fetch_github_user_via_gh().await {
                Ok(user) => CommandResult::ok(AuthStatus::Authenticated { user }),
                Err(e) => {
                    log::error!("Failed to fetch user info: {}", e);
                    CommandResult::ok(AuthStatus::Unauthenticated)
                }
            }
        }
        _ => CommandResult::ok(AuthStatus::Unauthenticated),
    }
}

/// Run `gh auth login --web` to authenticate via browser
/// Polls for completion with 5-minute timeout
#[tauri::command]
pub async fn run_gh_auth_login(app: AppHandle) -> CommandResult<GitHubUser> {
    log::info!("Starting gh auth login --web");

    // Spawn gh auth login --web in a separate process
    let child = std::process::Command::new("gh")
        .args(["auth", "login", "--web", "-h", "github.com", "-p", "https"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            return CommandResult::err(&format!("Failed to start gh auth login: {}", e));
        }
    };

    // Wait for the process with timeout (5 minutes)
    let timeout_duration = std::time::Duration::from_secs(300);
    let start = std::time::Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    log::info!("gh auth login completed successfully");
                    // Fetch user info
                    match fetch_github_user_via_gh().await {
                        Ok(user) => {
                            let _ = app.emit("auth:success", user.clone());
                            return CommandResult::ok(user);
                        }
                        Err(e) => {
                            let err_msg = format!("Failed to fetch user after auth: {}", e);
                            let _ = app.emit("auth:error", err_msg.clone());
                            return CommandResult::err(&err_msg);
                        }
                    }
                } else {
                    let output = child.wait_with_output();
                    let stderr = output
                        .map(|o| String::from_utf8_lossy(&o.stderr).to_string())
                        .unwrap_or_else(|_| "Unknown error".to_string());
                    let err_msg = format!("gh auth login failed: {}", stderr);
                    let _ = app.emit("auth:error", err_msg.clone());
                    return CommandResult::err(&err_msg);
                }
            }
            Ok(None) => {
                // Process still running
                if start.elapsed() > timeout_duration {
                    let _ = child.kill();
                    let err_msg = "Authentication timed out after 5 minutes";
                    let _ = app.emit("auth:error", err_msg);
                    return CommandResult::err(err_msg);
                }
                // Sleep briefly before checking again
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            Err(e) => {
                let err_msg = format!("Error waiting for gh auth: {}", e);
                let _ = app.emit("auth:error", err_msg.clone());
                return CommandResult::err(&err_msg);
            }
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
