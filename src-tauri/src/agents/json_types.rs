//! JSON types for parsing Claude Code's structured output
//!
//! When Claude Code is invoked with `--output-format stream-json --verbose`,
//! it outputs JSONL (one JSON object per line) with rich structured data
//! including thinking blocks, tool calls, and results.

use serde::{Deserialize, Serialize};

/// Top-level event from Claude Code's JSON stream
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeEvent {
    /// System initialization event
    System(SystemEvent),
    /// Assistant message with content blocks
    Assistant(AssistantEvent),
    /// User message (typically tool results)
    User(UserEvent),
    /// Final result event when agent completes
    Result(ResultEvent),
}

/// System event - emitted at session start
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemEvent {
    pub subtype: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub cwd: Option<String>,
}

/// Assistant event - contains message with content blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantEvent {
    pub message: AssistantMessage,
    #[serde(default)]
    pub session_id: Option<String>,
}

/// Assistant message containing content blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub content: Vec<ContentBlock>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub stop_reason: Option<String>,
    #[serde(default)]
    pub usage: Option<UsageInfo>,
}

/// Content block within an assistant message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Extended thinking/reasoning block
    Thinking {
        thinking: String,
        #[serde(default)]
        signature: Option<String>,
    },
    /// Tool use request
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// Text output
    Text { text: String },
}

/// Token usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    #[serde(default)]
    pub input_tokens: Option<u64>,
    #[serde(default)]
    pub output_tokens: Option<u64>,
    #[serde(default)]
    pub cache_creation_input_tokens: Option<u64>,
    #[serde(default)]
    pub cache_read_input_tokens: Option<u64>,
}

/// User event - typically contains tool results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserEvent {
    pub message: UserMessage,
    #[serde(default)]
    pub session_id: Option<String>,
}

/// User message with tool results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    #[serde(default)]
    pub content: Vec<ToolResultBlock>,
}

/// Tool result block
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolResultBlock {
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default)]
        is_error: Option<bool>,
    },
}

/// Result event - emitted when agent completes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultEvent {
    pub subtype: String,
    #[serde(default)]
    pub is_error: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub duration_api_ms: Option<u64>,
    #[serde(default)]
    pub num_turns: Option<u32>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub total_cost_usd: Option<f64>,
}

/// A single option in a user input request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInputOption {
    /// Display label for the option
    pub label: String,
    /// Optional description/explanation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Structured event emitted to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum StructuredEvent {
    /// Session initialized
    Init {
        session_id: String,
        model: Option<String>,
        tools: Vec<String>,
    },
    /// Thinking block received
    Thinking { content: String, message_id: String },
    /// Tool call started
    ToolStart {
        tool_id: String,
        tool_name: String,
        tool_input: serde_json::Value,
        message_id: String,
    },
    /// Tool call completed
    ToolComplete {
        tool_id: String,
        tool_output: String,
        is_error: bool,
        duration_ms: Option<u64>,
    },
    /// Text output received
    Text { content: String, message_id: String },
    /// Agent completed
    Complete {
        duration_ms: Option<u64>,
        num_turns: Option<u32>,
        is_error: bool,
        result: Option<String>,
    },
    /// Agent is requesting user input (multi-choice question)
    UserInputRequest {
        /// Unique ID for this tool call (for resuming)
        tool_id: String,
        /// The question being asked
        question: String,
        /// Short header/category for the question
        #[serde(skip_serializing_if = "Option::is_none")]
        header: Option<String>,
        /// Available options to choose from
        options: Vec<UserInputOption>,
        /// Whether multiple selections are allowed
        #[serde(default)]
        multi_select: bool,
        /// Associated message ID
        message_id: String,
    },
}

/// Parse a single line of JSON output from Claude Code
pub fn parse_claude_event(line: &str) -> Option<ClaudeEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    serde_json::from_str(trimmed).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_system_event() {
        let json = r#"{"type":"system","subtype":"init","session_id":"abc123","tools":["Read","Write"],"model":"claude-3"}"#;
        let event = parse_claude_event(json).unwrap();
        match event {
            ClaudeEvent::System(sys) => {
                assert_eq!(sys.subtype, "init");
                assert_eq!(sys.session_id, Some("abc123".to_string()));
            }
            _ => panic!("Expected System event"),
        }
    }

    #[test]
    fn test_parse_assistant_event_with_tool_use() {
        let json = r#"{"type":"assistant","message":{"id":"msg1","content":[{"type":"tool_use","id":"tool1","name":"Read","input":{"file_path":"/test.txt"}}]}}"#;
        let event = parse_claude_event(json).unwrap();
        match event {
            ClaudeEvent::Assistant(asst) => {
                assert_eq!(asst.message.id, "msg1");
                assert_eq!(asst.message.content.len(), 1);
            }
            _ => panic!("Expected Assistant event"),
        }
    }
}
