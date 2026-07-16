//! Persistence of the blocker configuration to
//! `~/Library/Application Support/ShortBlock/state.json`.

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use blocker_core::BlockerConfig;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    pub config: BlockerConfig,
    /// Unix ms of the last successful hosts-file sync, for the UI.
    #[serde(default)]
    pub last_synced_at: Option<u64>,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            config: BlockerConfig {
                enabled: true,
                ..Default::default()
            },
            last_synced_at: None,
        }
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Minutes since local midnight, for schedule-window evaluation.
pub fn local_minute_of_day() -> u16 {
    use chrono::Timelike;
    let now = chrono::Local::now();
    (now.hour() * 60 + now.minute()) as u16
}

pub fn data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("ShortBlock")
}

fn state_path() -> PathBuf {
    data_dir().join("state.json")
}

pub fn load() -> PersistedState {
    let path = state_path();
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => PersistedState::default(),
    }
}

pub fn save(state: &PersistedState) -> Result<(), String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let path = state_path();
    fs::write(&path, raw).map_err(|e| format!("Could not write {}: {e}", path.display()))
}
