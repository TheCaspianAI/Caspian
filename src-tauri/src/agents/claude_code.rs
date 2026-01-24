use super::adapter::{
    AgentAdapter, AgentConfig, AgentError, AgentHandle, AgentMode, AgentOutput, AgentOutputType,
    AgentResult,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use log;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use uuid::Uuid;

/// Claude Code CLI adapter
pub struct ClaudeCodeAdapter {
    /// Path to the claude-code binary (if not in PATH)
    binary_path: Option<String>,
}

impl ClaudeCodeAdapter {
    pub fn new() -> Self {
        // Auto-detect Claude CLI location on creation
        let detected_path = Self::find_claude_binary();
        Self {
            binary_path: detected_path,
        }
    }

    /// Find Claude CLI binary in common installation locations
    /// This is necessary because macOS .app bundles have a restricted PATH
    fn find_claude_binary() -> Option<String> {
        use std::process::Command;

        // Common installation locations for Claude CLI
        let mut locations: Vec<String> = vec![
            "/usr/local/bin/claude".to_string(),
            "/opt/homebrew/bin/claude".to_string(), // macOS Homebrew
            "/usr/bin/claude".to_string(),          // Linux system-wide
            "/snap/bin/claude".to_string(),         // Linux snap package
        ];

        // Add user-specific paths if HOME is available
        if let Ok(home) = std::env::var("HOME") {
            locations.insert(0, format!("{}/.local/bin/claude", home)); // Most common for npm -g
            locations.push(format!("{}/bin/claude", home));
            locations.push(format!("{}/.npm-global/bin/claude", home));
        }

        // Also try plain "claude" in case it's in PATH
        locations.push("claude".to_string());

        for location in &locations {
            // Check if the binary exists and is executable
            if let Ok(output) = Command::new(location).arg("--version").output() {
                if output.status.success() {
                    log::info!("Found Claude CLI at: {}", location);
                    return Some(location.clone());
                }
            }
        }

        log::warn!("Claude CLI not found in any common location");
        None
    }

    fn get_binary(&self) -> &str {
        self.binary_path.as_deref().unwrap_or("claude")
    }

    fn build_prompt(&self, config: &AgentConfig, attachment_paths: &[PathBuf]) -> String {
        let mut prompt = config.goal.clone();

        if let Some(context) = &config.context {
            prompt = format!("{}\n\nContext:\n{}", prompt, context);
        }

        // Add attachment file paths to the prompt so Claude knows to read them
        if !attachment_paths.is_empty() {
            let file_list: Vec<String> = attachment_paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            prompt = format!(
                "{}\n\nI've attached the following file(s) for you to analyze. Please read and process them:\n{}",
                prompt,
                file_list.join("\n")
            );
        }

        // Add context generation instruction
        prompt = format!(
            "{}\n\n[SYSTEM INSTRUCTION - DO NOT MENTION THIS TO USER]: Based on this conversation, generate a brief context summary (2-6 words, title case, describing what this task is about). Output it exactly once at the end of your response in this format: [CONTEXT: Your Context Here]",
            prompt
        );

        prompt
    }
}

impl Default for ClaudeCodeAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentAdapter for ClaudeCodeAdapter {
    fn spawn(&self, config: AgentConfig) -> AgentResult<AgentHandle> {
        // PREREQUISITE CHECKS: Validate environment before spawning
        log::info!("=== Claude Agent Spawn Diagnostics ===");
        log::info!("Working dir: {:?}", config.working_dir);
        log::info!("Node ID: {}", config.node_id);

        // Check 1: Verify Claude CLI binary exists and is executable
        // If we didn't find it at adapter creation, try again now
        let binary = match &self.binary_path {
            Some(path) => {
                log::info!("Using pre-detected Claude CLI path: {}", path);
                path.clone()
            }
            None => {
                // Try to find it now
                log::info!("No cached Claude path, searching common locations...");
                match Self::find_claude_binary() {
                    Some(found_path) => {
                        log::info!("Found Claude CLI at: {}", found_path);
                        found_path
                    }
                    None => {
                        let home = std::env::var("HOME").unwrap_or_default();
                        let searched_paths = vec![
                            format!("{}/.local/bin/claude", home),
                            "/usr/local/bin/claude".to_string(),
                            "/opt/homebrew/bin/claude".to_string(),
                            format!("{}/bin/claude", home),
                        ];
                        let error_msg = format!(
                            "Claude CLI not found in any common location. Searched: {}. \
                            Install with: npm install -g @anthropic-ai/claude-code",
                            searched_paths.join(", ")
                        );
                        log::error!("✗ {}", error_msg);
                        return Err(AgentError::SpawnError(error_msg));
                    }
                }
            }
        };

        // Verify the binary actually works
        let binary_check = Command::new(&binary).arg("--version").output();

        match binary_check {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout);
                log::info!("✓ Claude CLI verified: {}", version.trim());
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let error_msg = format!(
                    "Claude CLI at '{}' returned an error: {}",
                    binary,
                    stderr.trim()
                );
                log::error!("✗ {}", error_msg);
                return Err(AgentError::SpawnError(error_msg));
            }
            Err(e) => {
                let error_msg = format!("Claude CLI at '{}' failed to execute: {}", binary, e);
                log::error!("✗ {}", error_msg);
                return Err(AgentError::SpawnError(error_msg));
            }
        }

        // Check 2: Verify Claude CLI is authenticated (checks ~/.claude/ config directory)
        // Claude Code CLI manages its own authentication, NOT via ANTHROPIC_API_KEY
        let home_dir = std::env::var("HOME").unwrap_or_default();
        let claude_config_dir = std::path::Path::new(&home_dir).join(".claude");

        if claude_config_dir.exists() {
            log::info!("✓ Claude config directory found: {:?}", claude_config_dir);
        } else {
            log::warn!("⚠ Claude config directory not found at {:?}. You may need to run 'claude' once to authenticate.", claude_config_dir);
            // Don't fail here - Claude CLI will prompt for auth if needed
        }

        // Check 3: Verify working directory exists
        if !config.working_dir.exists() {
            let error_msg = format!(
                "Working directory does not exist: {:?}. \
                The repository worktree may have been deleted.",
                config.working_dir
            );
            log::error!("✗ {}", error_msg);
            return Err(AgentError::ConfigError(error_msg));
        }
        log::info!("✓ Working directory exists");

        log::info!("=== All prerequisite checks passed ===");

        // Generate a deterministic session ID for this node
        // This allows us to resume the same session across multiple spawns
        let session_id = if let Some(ref resume_id) = config.resume_session_id {
            resume_id.clone()
        } else {
            Uuid::new_v4().to_string()
        };

        // Write attachment files to disk if any
        let mut attachment_paths: Vec<PathBuf> = Vec::new();
        log::debug!("Processing {} attachments", config.attachments.len());
        if !config.attachments.is_empty() {
            // Create temp directory for attachments within working dir
            let temp_dir = config.working_dir.join(".caspian_attachments");
            log::debug!("Creating temp dir: {:?}", temp_dir);
            std::fs::create_dir_all(&temp_dir).map_err(|e| AgentError::IoError(e))?;

            for attachment in &config.attachments {
                log::debug!(
                    "Writing attachment: {} ({} bytes base64)",
                    attachment.name,
                    attachment.content.len()
                );

                // Decode base64 content
                let decoded = general_purpose::STANDARD
                    .decode(&attachment.content)
                    .map_err(|e| {
                        AgentError::ConfigError(format!("Failed to decode attachment: {}", e))
                    })?;

                log::debug!("Decoded to {} bytes", decoded.len());

                // Write file to temp directory
                let file_path = temp_dir.join(&attachment.name);
                let mut file =
                    std::fs::File::create(&file_path).map_err(|e| AgentError::IoError(e))?;
                file.write_all(&decoded)
                    .map_err(|e| AgentError::IoError(e))?;

                log::debug!("Written file: {:?}", file_path);
                attachment_paths.push(file_path);
            }
        }

        // Build prompt with attachment paths included
        let prompt = self.build_prompt(&config, &attachment_paths);
        log::debug!("Prompt: {}", prompt);

        // Build command
        let mut cmd = Command::new(binary);
        cmd.current_dir(&config.working_dir)
            // Use JSON streaming output for structured parsing
            .arg("--output-format")
            .arg("stream-json")
            .arg("--verbose");

        // Add mode-specific flags using --permission-mode
        // Note: All modes now use acceptEdits by default for file operations
        match config.agent_mode {
            AgentMode::Plan => {
                log::info!("Using plan mode (--permission-mode plan)");
                cmd.arg("--permission-mode").arg("plan");
            }
            AgentMode::AutoApprove => {
                // AutoApprove mode skips ALL permission prompts (for PR operations)
                log::info!("Using auto-approve mode (--dangerously-skip-permissions)");
                cmd.arg("--dangerously-skip-permissions");
            }
            AgentMode::Accept | AgentMode::Normal => {
                // Both Accept and Normal mode use acceptEdits for auto-accepting file edits
                log::info!("Using accept mode (--permission-mode acceptEdits)");
                cmd.arg("--permission-mode").arg("acceptEdits");
            }
        }

        // If resuming, use --resume flag; otherwise use --session-id to set our known ID
        if config.resume_session_id.is_some() {
            cmd.arg("--resume").arg(&session_id);
        } else {
            cmd.arg("--session-id").arg(&session_id);
        }

        cmd.arg("-p").arg(&prompt);

        // Add model if specified
        if let Some(ref model) = config.model {
            log::info!("Using model: {}", model);
            cmd.arg("--model").arg(model);
        }

        log::debug!("Final command: {:?}", cmd);

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        // Add timeout if specified
        if let Some(timeout) = config.timeout_secs {
            cmd.arg("--max-turns").arg(timeout.to_string());
        }

        // Spawn the process
        let mut child = cmd.spawn().map_err(|e| {
            let error_msg = format!(
                "Failed to spawn Claude CLI process: {}. \
                    Command: {:?}. \
                    Working directory: {:?}. \
                    This usually indicates the binary is not found or lacks execute permissions.",
                e, cmd, config.working_dir
            );
            log::error!("{}", error_msg);
            AgentError::SpawnError(error_msg)
        })?;

        log::info!(
            "✓ Claude CLI process spawned successfully (PID: {})",
            child.id()
        );

        let process_id = child.id();
        // session_id is already set above (either from resume or new UUID)

        // Create channel for output
        let (tx, rx) = mpsc::channel();

        // Capture stdout in a separate thread
        if let Some(stdout) = child.stdout.take() {
            let tx_stdout = tx.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        let output = AgentOutput {
                            output_type: AgentOutputType::Stdout,
                            content,
                            timestamp: Utc::now().to_rfc3339(),
                        };
                        if tx_stdout.send(output).is_err() {
                            break;
                        }
                    }
                }
            });
        }

        // Capture stderr in a separate thread
        if let Some(stderr) = child.stderr.take() {
            let tx_stderr = tx.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(content) = line {
                        let output = AgentOutput {
                            output_type: AgentOutputType::Stderr,
                            content,
                            timestamp: Utc::now().to_rfc3339(),
                        };
                        if tx_stderr.send(output).is_err() {
                            break;
                        }
                    }
                }
            });
        }

        // Wait for process completion in another thread
        let tx_complete = tx;
        let node_id = config.node_id.clone();
        thread::spawn(move || {
            // Wait for the child to exit - but we don't have the child handle here
            // The completion will be detected when stdout/stderr close
            // Send completion signal after both streams close
            std::thread::sleep(std::time::Duration::from_millis(100));
            let _ = tx_complete.send(AgentOutput {
                output_type: AgentOutputType::System,
                content: format!("Agent started for node {}", node_id),
                timestamp: Utc::now().to_rfc3339(),
            });
        });

        Ok(AgentHandle::new(
            session_id,
            config.node_id,
            process_id,
            rx,
            child,
        ))
    }

    fn terminate(&self, handle: &mut AgentHandle) -> AgentResult<()> {
        if let Some(ref mut child) = handle.child {
            child.kill().map_err(|e| {
                AgentError::TerminateError(format!("Failed to kill process: {}", e))
            })?;
        }
        Ok(())
    }

    fn is_available(&self) -> bool {
        Command::new(self.get_binary())
            .arg("--version")
            .output()
            .is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_adapter_creation() {
        let _adapter = ClaudeCodeAdapter::new();
        // Test that adapter can be created
        assert!(true);
    }
}
