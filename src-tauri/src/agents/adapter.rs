use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::mpsc;
use thiserror::Error;

/// Agent adapter errors
#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Failed to spawn agent: {0}")]
    SpawnError(String),

    #[error("Agent process not found: {0}")]
    NotFound(String),

    #[error("Agent process already running for node: {0}")]
    AlreadyRunning(String),

    #[error("Failed to terminate agent: {0}")]
    TerminateError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

pub type AgentResult<T> = Result<T, AgentError>;

/// File attachment data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentData {
    pub name: String,
    pub content: String, // Base64 encoded content
    pub file_type: String,
    pub size: usize,
}

/// Agent execution mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AgentMode {
    /// Normal mode - standard execution with permission prompts
    #[default]
    Normal,
    /// Plan mode - agent plans before executing
    Plan,
    /// Accept mode - auto-accept file edits
    Accept,
    /// AutoApprove mode - skip ALL permission prompts (for PR operations)
    AutoApprove,
}

impl AgentMode {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "normal" => Some(Self::Normal),
            "plan" => Some(Self::Plan),
            "accept" => Some(Self::Accept),
            "auto_approve" | "autoapprove" => Some(Self::AutoApprove),
            _ => None,
        }
    }
}

/// Configuration for spawning an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Branch ID this agent is working on
    pub node_id: String,

    /// Working directory (worktree path)
    pub working_dir: PathBuf,

    /// Goal or task description
    pub goal: String,

    /// Additional context (assumptions, ground rules, etc.)
    pub context: Option<String>,

    /// Whether to run in headless/non-interactive mode
    pub headless: bool,

    /// Optional timeout in seconds
    pub timeout_secs: Option<u64>,

    /// Session ID to resume (for continuing conversations)
    pub resume_session_id: Option<String>,

    /// File attachments to pass to agent
    pub attachments: Vec<AttachmentData>,

    /// Model to use (e.g., "opus", "sonnet", "haiku")
    pub model: Option<String>,

    /// Agent execution mode (normal, plan, auto)
    pub agent_mode: AgentMode,
}

impl AgentConfig {
    pub fn new(node_id: String, working_dir: PathBuf, goal: String) -> Self {
        Self {
            node_id,
            working_dir,
            goal,
            context: None,
            headless: true,
            timeout_secs: None,
            resume_session_id: None,
            attachments: Vec::new(),
            model: None,
            agent_mode: AgentMode::default(),
        }
    }

    pub fn with_resume_session(mut self, session_id: String) -> Self {
        self.resume_session_id = Some(session_id);
        self
    }

    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }

    pub fn with_attachments(mut self, attachments: Vec<AttachmentData>) -> Self {
        self.attachments = attachments;
        self
    }

    pub fn with_model(mut self, model: String) -> Self {
        self.model = Some(model);
        self
    }

    pub fn with_agent_mode(mut self, mode: AgentMode) -> Self {
        self.agent_mode = mode;
        self
    }
}

/// Output from an agent process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    /// Type of output
    pub output_type: AgentOutputType,

    /// Content of the output
    pub content: String,

    /// Timestamp
    pub timestamp: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentOutputType {
    Stdout,
    Stderr,
    System,
    Complete,
    Error,
    Pending, // Agent needs user input
}

/// Handle to a running agent process
pub struct AgentHandle {
    /// Unique identifier for this agent session
    pub id: String,

    /// Branch ID this agent is working on
    pub node_id: String,

    /// OS process ID
    pub process_id: u32,

    /// Channel to receive output from the agent (Option so it can be taken)
    pub output_rx: Option<mpsc::Receiver<AgentOutput>>,

    /// Child process handle (for termination)
    pub(crate) child: Option<std::process::Child>,
}

impl AgentHandle {
    pub fn new(
        id: String,
        node_id: String,
        process_id: u32,
        output_rx: mpsc::Receiver<AgentOutput>,
        child: std::process::Child,
    ) -> Self {
        Self {
            id,
            node_id,
            process_id,
            output_rx: Some(output_rx),
            child: Some(child),
        }
    }

    /// Take the output receiver (can only be called once)
    pub fn take_receiver(&mut self) -> Option<mpsc::Receiver<AgentOutput>> {
        self.output_rx.take()
    }
}

/// Trait for agent adapters
pub trait AgentAdapter: Send + Sync {
    /// Spawn a new agent process
    fn spawn(&self, config: AgentConfig) -> AgentResult<AgentHandle>;

    /// Terminate the agent process
    fn terminate(&self, handle: &mut AgentHandle) -> AgentResult<()>;

    /// Check if the adapter is available (CLI installed, etc.)
    fn is_available(&self) -> bool;
}
