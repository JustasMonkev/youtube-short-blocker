// ShortBlock — system-wide distraction blocker for macOS.
// Blocks sites in every browser by managing a section of /etc/hosts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(target_os = "macos"))]
compile_error!("ShortBlock targets macOS only — build it on a Mac with `cargo tauri build`.");

mod engine;
mod state;
mod tray;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use blocker_core::{normalize_host, ScheduleWindow, Site, MINUTES_PER_DAY};
use state::{local_minute_of_day, now_ms, PersistedState};
use tauri::{Emitter, Manager};

pub(crate) struct App {
    pub(crate) state: Mutex<PersistedState>,
    /// Unix ms before which the background loop must not auto-prompt for
    /// admin rights again (set after a cancelled authentication dialog).
    auto_sync_backoff_until: AtomicU64,
    site_seq: AtomicU64,
}

/// Everything the UI needs to render, returned by every command.
#[derive(serde::Serialize)]
struct Snapshot {
    config: blocker_core::BlockerConfig,
    blocking_active: bool,
    strict_active: bool,
    active_domain_count: usize,
    /// host → related domains automatically blocked alongside it.
    coverage: std::collections::HashMap<String, Vec<String>>,
    last_synced_at: Option<u64>,
    sync: Option<engine::SyncStatus>,
    sync_error: Option<String>,
    now_ms: u64,
}

fn snapshot(app: &App, sync_error: Option<String>) -> Snapshot {
    let state = app.state.lock().unwrap();
    let now = now_ms();
    let minute = local_minute_of_day();
    let domains = state.config.active_domains(now, minute);
    let coverage = state
        .config
        .sites
        .iter()
        .filter_map(|site| {
            // Shared packs (x.com/twitter.com) list both hosts; don't show a
            // site as "also blocking" itself.
            let related: Vec<String> = blocker_core::coverage::related_domains(&site.host)
                .iter()
                .filter(|d| **d != site.host)
                .map(|d| d.to_string())
                .collect();
            (!related.is_empty()).then(|| (site.host.clone(), related))
        })
        .collect();
    Snapshot {
        config: state.config.clone(),
        blocking_active: state.config.is_blocking_active(now, minute),
        strict_active: state.config.is_strict_active(now),
        active_domain_count: domains.len(),
        coverage,
        last_synced_at: state.last_synced_at,
        sync: engine::status(&domains).ok(),
        sync_error,
        now_ms: now,
    }
}

/// Guard for actions that would weaken blocking during a strict session.
fn reject_if_strict(app: &App) -> Result<(), String> {
    let state = app.state.lock().unwrap();
    match state.config.strict_until.filter(|_| state.config.is_strict_active(now_ms())) {
        Some(until) => Err(format!(
            "A strict session is locked until {} — this can't be changed until it ends",
            crate::tray::format_clock(until)
        )),
        None => Ok(()),
    }
}

/// Persists state, then tries to bring /etc/hosts in line with it.
/// A failed sync (e.g. cancelled admin prompt) is reported in the snapshot
/// rather than treated as a hard error, so the UI can offer a retry.
pub(crate) fn persist_and_sync(app: &App) -> Snapshot {
    let sync_error = {
        let mut state = app.state.lock().unwrap();
        let save_error = state::save(&state).err();
        let domains = state
            .config
            .active_domains(now_ms(), local_minute_of_day());
        match engine::sync(&domains) {
            Ok(_) => {
                state.last_synced_at = Some(now_ms());
                let _ = state::save(&state);
                // A successful user-driven sync clears any auto-sync backoff.
                app.auto_sync_backoff_until.store(0, Ordering::Relaxed);
                save_error
            }
            Err(e) => Some(save_error.map_or(e.clone(), |s| format!("{s}; {e}"))),
        }
    };
    snapshot(app, sync_error)
}

/// Persist + sync, then keep the menu-bar item's labels in step with the UI.
fn finish(app: &App, handle: &tauri::AppHandle) -> Snapshot {
    let snap = persist_and_sync(app);
    tray::refresh(handle);
    snap
}

#[tauri::command]
fn get_state(app: tauri::State<App>) -> Snapshot {
    snapshot(&app, None)
}

#[tauri::command]
fn set_enabled(
    app: tauri::State<App>,
    handle: tauri::AppHandle,
    enabled: bool,
) -> Result<Snapshot, String> {
    if !enabled {
        reject_if_strict(&app)?;
    }
    {
        let mut state = app.state.lock().unwrap();
        state.config.enabled = enabled;
        if enabled {
            state.config.paused_until = None;
        }
    }
    Ok(finish(&app, &handle))
}

/// Starts an unstoppable strict session: blocking locks on and cannot be
/// turned off, paused, or weakened until the session ends.
#[tauri::command]
fn start_strict(
    app: tauri::State<App>,
    handle: tauri::AppHandle,
    minutes: u64,
) -> Result<Snapshot, String> {
    if minutes == 0 || minutes > 24 * 60 {
        return Err("Strict sessions can last between 1 minute and 24 hours".to_string());
    }
    {
        let mut state = app.state.lock().unwrap();
        let until = now_ms() + minutes * 60_000;
        // Extending an already-running session is allowed; shortening is not.
        if state.config.strict_until.is_some_and(|cur| cur > until) {
            return Err("A longer strict session is already running".to_string());
        }
        state.config.strict_until = Some(until);
        state.config.enabled = true;
        state.config.paused_until = None;
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn add_site(
    app: tauri::State<App>,
    handle: tauri::AppHandle,
    input: String,
    label: Option<String>,
    minutes: Option<u64>,
) -> Result<Snapshot, String> {
    let host = normalize_host(&input)?;
    {
        let mut state = app.state.lock().unwrap();
        if state.config.sites.iter().any(|s| s.host == host) {
            return Err(format!("{host} is already in your block list"));
        }
        let label = label
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .unwrap_or_else(|| host.clone());
        let seq = app.site_seq.fetch_add(1, Ordering::Relaxed);
        state.config.sites.push(Site {
            id: format!("site-{}-{seq}", now_ms()),
            host,
            label,
            enabled: true,
            expires_at: minutes.filter(|m| *m > 0).map(|m| now_ms() + m * 60_000),
        });
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn remove_site(
    app: tauri::State<App>,
    handle: tauri::AppHandle,
    id: String,
) -> Result<Snapshot, String> {
    reject_if_strict(&app)?;
    {
        let mut state = app.state.lock().unwrap();
        state.config.sites.retain(|s| s.id != id);
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn toggle_site(
    app: tauri::State<App>,
    handle: tauri::AppHandle,
    id: String,
    enabled: bool,
) -> Result<Snapshot, String> {
    if !enabled {
        reject_if_strict(&app)?;
    }
    {
        let mut state = app.state.lock().unwrap();
        if let Some(site) = state.config.sites.iter_mut().find(|s| s.id == id) {
            site.enabled = enabled;
            if enabled {
                // Re-enabling a site whose timer already ran out clears the timer.
                if site.expires_at.is_some_and(|at| at <= now_ms()) {
                    site.expires_at = None;
                }
            }
        }
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn pause(app: tauri::State<App>, handle: tauri::AppHandle, minutes: u64) -> Result<Snapshot, String> {
    reject_if_strict(&app)?;
    if minutes == 0 || minutes > 24 * 60 {
        return Err("Pause length must be between 1 minute and 24 hours".to_string());
    }
    {
        let mut state = app.state.lock().unwrap();
        state.config.paused_until = Some(now_ms() + minutes * 60_000);
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn resume(app: tauri::State<App>, handle: tauri::AppHandle) -> Snapshot {
    {
        let mut state = app.state.lock().unwrap();
        state.config.paused_until = None;
    }
    finish(&app, &handle)
}

#[tauri::command]
fn set_schedule(app: tauri::State<App>, handle: tauri::AppHandle, start_minute: u16, end_minute: u16) -> Result<Snapshot, String> {
    if start_minute >= MINUTES_PER_DAY || end_minute >= MINUTES_PER_DAY {
        return Err("Schedule times must be within a single day".to_string());
    }
    {
        let mut state = app.state.lock().unwrap();
        state.config.schedule = Some(ScheduleWindow { start_minute, end_minute });
    }
    Ok(finish(&app, &handle))
}

#[tauri::command]
fn clear_schedule(app: tauri::State<App>, handle: tauri::AppHandle) -> Snapshot {
    {
        let mut state = app.state.lock().unwrap();
        state.config.schedule = None;
    }
    finish(&app, &handle)
}

#[tauri::command]
fn sync_now(app: tauri::State<App>, handle: tauri::AppHandle) -> Snapshot {
    finish(&app, &handle)
}

/// Watches for time-driven transitions (site timers, pause expiry, schedule
/// boundaries) and external hosts-file drift, and re-applies the block list.
/// After a cancelled admin prompt it backs off for 30 minutes instead of
/// re-prompting every tick; any user action in the UI clears the backoff.
fn spawn_sync_loop(handle: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        let app = handle.state::<App>();
        let now = now_ms();
        if app.auto_sync_backoff_until.load(Ordering::Relaxed) > now {
            continue;
        }

        let desired = {
            let state = app.state.lock().unwrap();
            state.config.active_domains(now, local_minute_of_day())
        };
        let drifted = matches!(engine::status(&desired), Ok(s) if !s.in_sync);
        if !drifted {
            continue;
        }

        match engine::sync(&desired) {
            Ok(_) => {
                let mut state = app.state.lock().unwrap();
                state.last_synced_at = Some(now_ms());
                let _ = state::save(&state);
            }
            Err(_) => {
                app.auto_sync_backoff_until
                    .store(now + 30 * 60_000, Ordering::Relaxed);
            }
        }
        let _ = handle.emit("shortblock://state-changed", ());
        tray::refresh(&handle);
    });
}

fn main() {
    tauri::Builder::default()
        .manage(App {
            state: Mutex::new(state::load()),
            auto_sync_backoff_until: AtomicU64::new(0),
            site_seq: AtomicU64::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_enabled,
            start_strict,
            add_site,
            remove_site,
            toggle_site,
            pause,
            resume,
            set_schedule,
            clear_schedule,
            sync_now
        ])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window is defined in tauri.conf.json");

            #[cfg(target_os = "macos")]
            window_vibrancy::apply_vibrancy(
                &window,
                window_vibrancy::NSVisualEffectMaterial::UnderWindowBackground,
                Some(window_vibrancy::NSVisualEffectState::Active),
                Some(28.0),
            )
            .expect("vibrancy is supported on macOS 10.14+");

            tray::init(app.handle())?;
            spawn_sync_loop(app.handle().clone());
            Ok(())
        })
        // Closing the window keeps ShortBlock alive in the menu bar;
        // "Quit ShortBlock" in the tray menu exits for real.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start ShortBlock");
}
