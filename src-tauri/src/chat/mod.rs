use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Sender type for chat messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SenderType {
    Human,
    Agent,
}

impl SenderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SenderType::Human => "human",
            SenderType::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "human" => Some(SenderType::Human),
            "agent" => Some(SenderType::Agent),
            _ => None,
        }
    }
}

/// Message type for chat messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Text,
    System,
    Code,
    Error,
}

impl MessageType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageType::Text => "text",
            MessageType::System => "system",
            MessageType::Code => "code",
            MessageType::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "text" => Some(MessageType::Text),
            "system" => Some(MessageType::System),
            "code" => Some(MessageType::Code),
            "error" => Some(MessageType::Error),
            _ => None,
        }
    }
}

/// Chat state for a node or workspace
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChatState {
    Idle,
    Locked,
    AwaitingHuman,
}

impl ChatState {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChatState::Idle => "idle",
            ChatState::Locked => "locked",
            ChatState::AwaitingHuman => "awaiting_human",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "idle" => Some(ChatState::Idle),
            "locked" => Some(ChatState::Locked),
            "awaiting_human" => Some(ChatState::AwaitingHuman),
            _ => None,
        }
    }
}

/// A chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub workspace_id: String,
    pub node_id: Option<String>,
    pub sender_type: SenderType,
    pub sender_id: Option<String>,
    pub content: String,
    pub message_type: MessageType,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Chat state entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStateEntry {
    pub id: String,
    pub workspace_id: String,
    pub node_id: Option<String>,
    pub state: ChatState,
    pub locked_reason: Option<String>,
    pub updated_at: DateTime<Utc>,
}
