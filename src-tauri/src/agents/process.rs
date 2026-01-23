use super::{
    adapter::{AgentAdapter, AgentConfig, AgentError, AgentHandle, AgentOutput, AgentResult},
    claude_code::ClaudeCodeAdapter,
    AgentAdapterType, AgentSession, AgentSessionStatus,
};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};

/// Session metadata stored alongside handles
#[derive(Clone)]
struct SessionMetadata {
    adapter_type: AgentAdapterType,
    started_at: String,
}

/// Manages running agent processes and their sessions
pub struct ProcessManager {
    /// Active agent handles by session ID
    handles: Arc<Mutex<HashMap<String, AgentHandle>>>,

    /// Session metadata (adapter type, start time) by session ID
    metadata: Arc<Mutex<HashMap<String, SessionMetadata>>>,

    /// Claude Code adapter
    claude_code_adapter: ClaudeCodeAdapter,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
            metadata: Arc::new(Mutex::new(HashMap::new())),
            claude_code_adapter: ClaudeCodeAdapter::new(),
        }
    }

    /// Get the adapter for a given type
    fn get_adapter(&self, adapter_type: AgentAdapterType) -> &dyn AgentAdapter {
        match adapter_type {
            AgentAdapterType::ClaudeCode => &self.claude_code_adapter,
        }
    }

    /// Spawn a new agent for a node
    pub fn spawn_agent(
        &self,
        adapter_type: AgentAdapterType,
        config: AgentConfig,
    ) -> AgentResult<AgentSession> {
        let node_id = config.node_id.clone();

        // Check if an agent is already running for this node
        {
            let handles = self.handles.lock().unwrap();
            for handle in handles.values() {
                if handle.node_id == node_id {
                    return Err(AgentError::AlreadyRunning(node_id));
                }
            }
        }

        // Get the appropriate adapter
        let adapter = self.get_adapter(adapter_type);

        // Spawn the agent
        let handle = adapter.spawn(config)?;

        let started_at = Utc::now().to_rfc3339();
        let session = AgentSession {
            id: handle.id.clone(),
            node_id: handle.node_id.clone(),
            adapter_type,
            process_id: Some(handle.process_id),
            status: AgentSessionStatus::Running,
            started_at: started_at.clone(),
            ended_at: None,
        };

        // Store the handle and metadata
        {
            let mut handles = self.handles.lock().unwrap();
            handles.insert(session.id.clone(), handle);

            let mut metadata = self.metadata.lock().unwrap();
            metadata.insert(
                session.id.clone(),
                SessionMetadata {
                    adapter_type,
                    started_at,
                },
            );
        }

        Ok(session)
    }

    /// Get agent session for a node
    pub fn get_session_for_node(&self, node_id: &str) -> Option<AgentSession> {
        let handles = self.handles.lock().unwrap();
        let metadata = self.metadata.lock().unwrap();

        handles
            .values()
            .find(|h| h.node_id == node_id)
            .and_then(|h| {
                metadata.get(&h.id).map(|meta| AgentSession {
                    id: h.id.clone(),
                    node_id: h.node_id.clone(),
                    adapter_type: meta.adapter_type,
                    process_id: Some(h.process_id),
                    status: AgentSessionStatus::Running,
                    started_at: meta.started_at.clone(),
                    ended_at: None,
                })
            })
    }

    /// Terminate an agent by session ID
    pub fn terminate_agent(&self, session_id: &str) -> AgentResult<()> {
        let mut handles = self.handles.lock().unwrap();
        let mut metadata = self.metadata.lock().unwrap();

        if let Some(handle) = handles.get_mut(session_id) {
            // Use stored adapter type to get the correct adapter
            let adapter_type = metadata
                .get(session_id)
                .map(|m| m.adapter_type)
                .unwrap_or(AgentAdapterType::ClaudeCode);

            let adapter = self.get_adapter(adapter_type);
            adapter.terminate(handle)?;

            handles.remove(session_id);
            metadata.remove(session_id);
            Ok(())
        } else {
            Err(AgentError::NotFound(session_id.to_string()))
        }
    }

    /// Terminate agent for a node
    pub fn terminate_agent_for_node(&self, node_id: &str) -> AgentResult<()> {
        let session_id = {
            let handles = self.handles.lock().unwrap();
            handles
                .values()
                .find(|h| h.node_id == node_id)
                .map(|h| h.id.clone())
        };

        if let Some(id) = session_id {
            self.terminate_agent(&id)
        } else {
            Err(AgentError::NotFound(format!(
                "No agent for node {}",
                node_id
            )))
        }
    }

    /// Check if a specific adapter is available
    pub fn is_adapter_available(&self, adapter_type: AgentAdapterType) -> bool {
        self.get_adapter(adapter_type).is_available()
    }

    /// Get available adapters
    pub fn get_available_adapters(&self) -> Vec<AgentAdapterType> {
        let mut available = Vec::new();

        if self.claude_code_adapter.is_available() {
            available.push(AgentAdapterType::ClaudeCode);
        }

        available
    }

    /// Take the output receiver from a session (can only be called once per session)
    pub fn take_receiver(&self, session_id: &str) -> Option<Receiver<AgentOutput>> {
        let mut handles = self.handles.lock().unwrap();
        if let Some(handle) = handles.get_mut(session_id) {
            handle.take_receiver()
        } else {
            None
        }
    }

    /// Remove a handle when agent completes (called by OutputStreamer)
    pub fn remove_handle(&self, session_id: &str) {
        let mut handles = self.handles.lock().unwrap();
        handles.remove(session_id);
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

// Global process manager instance
lazy_static::lazy_static! {
    static ref PROCESS_MANAGER: ProcessManager = ProcessManager::new();
}

/// Get the global process manager
pub fn get_process_manager() -> &'static ProcessManager {
    &PROCESS_MANAGER
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_manager_creation() {
        let _manager = ProcessManager::new();
        // Test that manager can be created
        assert!(true);
    }

    #[test]
    fn test_get_available_adapters() {
        let _manager = ProcessManager::new();
        let _adapters = _manager.get_available_adapters();
        // Result depends on whether CLIs are installed
    }
}
