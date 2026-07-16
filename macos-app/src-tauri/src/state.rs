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

/// Loads persisted state. The second value is a warning when the state file
/// existed but could not be parsed: the caller must not treat the returned
/// defaults as the user's real configuration (in particular, must not sync
/// an empty block list over existing hosts entries) until the user acts.
pub fn load() -> (PersistedState, Option<String>) {
    let path = state_path();
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        // Only a missing file is a fresh install; defaults are correct.
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return (PersistedState::default(), None);
        }
        // Any other read failure (permissions, I/O) means real settings
        // exist but are unreachable — the defaults are placeholders and
        // must not be allowed to sync away existing blocks.
        Err(err) => {
            let warning = format!(
                "Your saved settings could not be read ({err}). Existing blocks in the \
                 hosts file are left untouched until you change something."
            );
            return (PersistedState::default(), Some(warning));
        }
    };
    match serde_json::from_str::<PersistedState>(&raw) {
        Ok(mut state) => {
            sanitize(&mut state);
            (state, None)
        }
        Err(err) => {
            // A corrupt file (e.g. interrupted write) must not silently
            // erase the block list. Preserve it for inspection and tell the
            // caller these defaults are a placeholder, not user intent.
            let backup = path.with_extension("json.corrupt");
            let _ = fs::copy(&path, &backup);
            let warning = format!(
                "Your saved settings could not be read ({err}). The unreadable file was kept at {}. \
                 Existing blocks in the hosts file are left untouched until you change something.",
                backup.display()
            );
            (PersistedState::default(), Some(warning))
        }
    }
}

/// Re-validates persisted data before it can influence a privileged write.
/// `state.json` is plain user-writable JSON: a corrupted or tampered file
/// must not smuggle un-normalized host strings (e.g. containing newlines)
/// into the hosts-file renderer, so every site host is re-run through
/// `normalize_host` and anything invalid is dropped.
fn sanitize(state: &mut PersistedState) {
    state.config.sites.retain_mut(|site| {
        match blocker_core::normalize_host(&site.host) {
            Ok(normalized) => {
                site.host = normalized;
                true
            }
            Err(_) => false,
        }
    });
    if state.config.schedule.is_some_and(|w| !w.is_valid()) {
        state.config.schedule = None;
    }
}

pub fn save(state: &PersistedState) -> Result<(), String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let path = state_path();
    // Write-then-rename so a crash mid-save can never leave a truncated
    // state.json behind — the previous complete file survives instead.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Could not replace {}: {e}", path.display()))
}
