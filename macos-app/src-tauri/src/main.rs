// ShortBlock — system-wide distraction blocker for macOS.
// Blocks sites in every browser by managing a section of /etc/hosts.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![forbid(unsafe_code)]

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
    /// Set when state.json existed but couldn't be read or parsed. While
    /// present, the in-memory defaults are a placeholder — auto-sync and all
    /// tray actions are suppressed so they can't remove existing hosts
    /// entries. Cleared by the first deliberate user action in the window,
    /// which makes the in-memory state authoritative again.
    pub(crate) startup_warning: Mutex<Option<String>>,
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
    startup_warning: Option<String>,
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
        startup_warning: app.startup_warning.lock().unwrap().clone(),
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
    // A deliberate change makes the in-memory state authoritative, even if
    // it was seeded from defaults after a corrupt state file.
    *app.startup_warning.lock().unwrap() = None;
    let sync_error = {
        let mut state = app.state.lock().unwrap();
        match state::save(&state) {
            // If the new state can't be persisted, don't touch /etc/hosts:
            // a hosts file ahead of what survives a restart would be undone
            // by the background loop after relaunch.
            Err(e) => Some(format!(
                "Settings could not be saved ({e}); the hosts file was left unchanged"
            )),
            Ok(()) => {
                let domains = state
                    .config
                    .active_domains(now_ms(), local_minute_of_day());
                match engine::sync(&domains) {
                    Ok(_) => {
                        state.last_synced_at = Some(now_ms());
                        let _ = state::save(&state);
                        // A successful user-driven sync clears any auto-sync backoff.
                        app.auto_sync_backoff_until.store(0, Ordering::Relaxed);
                        None
                    }
                    Err(e) => {
                        // The user just saw (and possibly cancelled) an auth
                        // prompt. Back the background loop off too — otherwise
                        // its next tick sees hosts drift against the persisted
                        // desired state and re-prompts right after they declined.
                        app.auto_sync_backoff_until
                            .store(now_ms() + 30 * 60_000, Ordering::Relaxed);
                        Some(e)
                    }
                }
            }
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
    let previous = {
        let mut state = app.state.lock().unwrap();
        let until = now_ms() + minutes * 60_000;
        // Extending an already-running session is allowed; shortening is not.
        if state.config.strict_until.is_some_and(|cur| cur > until) {
            return Err("A longer strict session is already running".to_string());
        }
        // Only strict_until is set: it already overrides `enabled`, pauses,
        // and the schedule while active, and the user's underlying settings
        // (switch off, running break) come back intact when the lock ends.
        let previous = state.config.strict_until;
        state.config.strict_until = Some(until);
        previous
    };
    let snap = finish(&app, &handle);
    if let Some(err) = snap.sync_error {
        // The lock must never outrun the hosts file: a strict session whose
        // apply was cancelled would freeze the controls without blocking
        // anything. Roll it back and report why it didn't start.
        {
            let mut state = app.state.lock().unwrap();
            state.config.strict_until = previous;
            let _ = state::save(&state);
        }
        tray::refresh(&handle);
        return Err(format!("Strict session was not started: {err}"));
    }
    Ok(snap)
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
fn resume(app: tauri::State<App>, handle: tauri::AppHandle) -> Result<Snapshot, String> {
    // Strict already masks the break; clearing it now would silently erase
    // the break that should come back when the lock ends.
    reject_if_strict(&app)?;
    {
        let mut state = app.state.lock().unwrap();
        state.config.paused_until = None;
    }
    Ok(finish(&app, &handle))
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
/// boundaries, strict-session expiry) and external hosts-file drift, and
/// re-applies the block list. After a cancelled admin prompt it backs off for
/// 30 minutes instead of re-prompting every tick; any user action clears the
/// backoff.
fn spawn_sync_loop(handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        // (strict, blocking_active, desired domains) — when this changes
        // between ticks, the UI and tray must be told even if /etc/hosts
        // needs no rewrite (e.g. a strict session over an unchanged block
        // list expires: the tray must swap its locked menu for the normal
        // one despite zero hosts drift).
        let mut last_fingerprint: Option<(bool, bool, Vec<String>)> = None;
        loop {
            std::thread::sleep(Duration::from_secs(30));
            let app = handle.state::<App>();
            let now = now_ms();

            // Defaults loaded from a corrupt state file are placeholders,
            // not user intent — never let them drive a hosts-file rewrite.
            if app.startup_warning.lock().unwrap().is_some() {
                continue;
            }

            let fingerprint = {
                let state = app.state.lock().unwrap();
                let minute = local_minute_of_day();
                (
                    state.config.is_strict_active(now),
                    state.config.is_blocking_active(now, minute),
                    state.config.active_domains(now, minute),
                )
            };
            let time_transition =
                last_fingerprint.as_ref().is_some_and(|prev| *prev != fingerprint);
            let desired = fingerprint.2.clone();
            last_fingerprint = Some(fingerprint);

            if time_transition {
                let _ = handle.emit("shortblock://state-changed", ());
                tray::refresh(&handle);
            }

            // The backoff exists to stop re-prompting after a declined
            // dialog, not to delay time-driven cleanup: when a timer, break,
            // focus window, or strict session just transitioned, attempt the
            // sync anyway so an expired block doesn't linger for the rest of
            // the backoff. A cancelled prompt re-arms the backoff below.
            let backoff_active = app.auto_sync_backoff_until.load(Ordering::Relaxed) > now;
            if backoff_active && !time_transition {
                continue;
            }
            let drifted = matches!(engine::status(&desired), Ok(s) if !s.in_sync);
            if !drifted {
                continue;
            }

            // Same invariant as the foreground path: /etc/hosts must never
            // get ahead of durable state. A failed user-action save leaves
            // edits in memory only, so prove the config is persisted before
            // rewriting the hosts file; retry next tick (e.g. once disk
            // space frees up) rather than syncing something a restart would
            // silently revert. The desired set is recomputed under the same
            // lock as the save so a user change that landed mid-tick is
            // applied, not overwritten by the stale snapshot taken above.
            let desired = {
                let state = app.state.lock().unwrap();
                if state::save(&state).is_err() {
                    continue;
                }
                state
                    .config
                    .active_domains(now_ms(), local_minute_of_day())
            };
            if matches!(engine::status(&desired), Ok(s) if s.in_sync) {
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
        }
    });
}

fn main() {
    let (loaded_state, startup_warning) = state::load();
    tauri::Builder::default()
        .manage(App {
            state: Mutex::new(loaded_state),
            auto_sync_backoff_until: AtomicU64::new(0),
            startup_warning: Mutex::new(startup_warning),
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
        .build(tauri::generate_context!())
        .expect("failed to start ShortBlock")
        // Quitting during a strict session would leave the hosts entries in
        // place with no process left to lift them at strict_until, turning a
        // timed lock into an indefinite one. Refuse to exit until it ends
        // (the tray's Quit item is also disabled while strict is active).
        .run(|handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                let app = handle.state::<App>();
                let (strict, desired) = {
                    let state = app.state.lock().unwrap();
                    let now = now_ms();
                    (
                        state.config.is_strict_active(now),
                        state.config.active_domains(now, local_minute_of_day()),
                    )
                };
                if strict {
                    api.prevent_exit();
                    return;
                }
                // A time-driven unblock (strict/timer/break expiry) may not
                // have hit the hosts file yet — the loop only ticks every
                // 30 s. Quitting in that window would orphan those entries,
                // so attempt one cleanup sync when the live file blocks
                // domains the desired state no longer wants. If the user
                // declines the prompt, the quit proceeds — that's an
                // informed choice, and only ever when placeholder defaults
                // aren't in play (unreadable state suppresses this too).
                let unreadable = app.startup_warning.lock().unwrap().is_some();
                if !unreadable {
                    if let Ok(status) = engine::status(&desired) {
                        let stale = status
                            .applied_domains
                            .iter()
                            .any(|d| !status.desired_domains.contains(d));
                        if stale {
                            let _ = engine::sync(&desired);
                        }
                    }
                }
            }
        });
}
