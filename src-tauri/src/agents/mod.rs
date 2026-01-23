pub mod adapter;
pub mod claude_code;
pub mod json_types;
pub mod process;
pub mod streaming;

use serde::{Deserialize, Serialize};

/// Agent adapter type identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentAdapterType {
    ClaudeCode,
}

impl AgentAdapterType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "claude_code" | "claude-code" => Some(Self::ClaudeCode),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude-code",
        }
    }
}

/// Agent session status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentSessionStatus {
    Idle,
    Running,
    Completed,
    Failed,
    Terminated,
    Pending, // Agent is waiting for user input
}

impl AgentSessionStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "idle" => Some(Self::Idle),
            "running" => Some(Self::Running),
            "completed" => Some(Self::Completed),
            "failed" => Some(Self::Failed),
            "terminated" => Some(Self::Terminated),
            "pending" => Some(Self::Pending),
            _ => None,
        }
    }
}

/// Agent session record stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    pub id: String,
    pub node_id: String,
    pub adapter_type: AgentAdapterType,
    pub process_id: Option<u32>,
    pub status: AgentSessionStatus,
    pub started_at: String,
    pub ended_at: Option<String>,
}
