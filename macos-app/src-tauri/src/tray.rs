//! Menu-bar (status bar) presence: a template glyph next to the clock with a
//! menu to toggle blocking, take a break, open the window, or quit.
//!
//! The menu is rebuilt from current state whenever anything changes, so its
//! labels ("Turn Blocking Off", "Paused until …") always match reality.
//! All tauri menu APIs must run on the main thread; `refresh` marshals itself
//! there so background threads can call it safely.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::state::{local_minute_of_day, now_ms};
use crate::App;

const TRAY_ID: &str = "shortblock-tray";

pub fn init(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("ShortBlock")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| handle_menu_event(app, event.id.as_ref()))
        .build(app)?;
    Ok(())
}

/// Rebuilds the tray menu to reflect current state. Safe from any thread.
pub fn refresh(app: &AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(tray) = handle.tray_by_id(TRAY_ID) {
            if let Ok(menu) = build_menu(&handle) {
                let _ = tray.set_menu(Some(menu));
            }
        }
    });
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let (enabled, paused_until, strict_until, blocking_active, domain_count) = {
        let state = app.state::<App>();
        let state = state.state.lock().unwrap();
        let now = now_ms();
        let minute = local_minute_of_day();
        (
            state.config.enabled,
            state.config.paused_until.filter(|until| *until > now),
            state.config.strict_until.filter(|_| state.config.is_strict_active(now)),
            state.config.is_blocking_active(now, minute),
            state.config.active_domains(now, minute).len(),
        )
    };

    let status_text = if let Some(until) = strict_until {
        format!("Strict session until {}", format_clock(until))
    } else if !enabled {
        "Blocking is off".to_string()
    } else if let Some(until) = paused_until {
        format!("On a break until {}", format_clock(until))
    } else if !blocking_active {
        "Outside focus hours".to_string()
    } else {
        format!(
            "Blocking {domain_count} domain{}",
            if domain_count == 1 { "" } else { "s" }
        )
    };

    let menu = Menu::new(app)?;
    menu.append(&MenuItem::with_id(app, "status", status_text, false, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // During a strict session there is deliberately nothing to click that
    // could weaken blocking — only a lock notice, open, and quit.
    if strict_until.is_some() {
        menu.append(&MenuItem::with_id(
            app,
            "locked",
            "Blocking is locked on",
            false,
            None::<&str>,
        )?)?;
    } else {
        menu.append(&MenuItem::with_id(
            app,
            "toggle",
            if enabled { "Turn Blocking Off" } else { "Turn Blocking On" },
            true,
            None::<&str>,
        )?)?;

        if paused_until.is_some() {
            menu.append(&MenuItem::with_id(app, "resume", "Resume Blocking Now", true, None::<&str>)?)?;
        } else if enabled {
            menu.append(&MenuItem::with_id(app, "pause-15", "Take a 15 Minute Break", true, None::<&str>)?)?;
            menu.append(&MenuItem::with_id(app, "pause-60", "Take a 1 Hour Break", true, None::<&str>)?)?;
        }
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "open", "Open ShortBlock…", true, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit ShortBlock", true, None::<&str>)?)?;
    Ok(menu)
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    // A menu built before a strict session started could still deliver
    // weakening actions; re-check the lock at event time.
    let strict = {
        let state = app.state::<App>();
        let state = state.state.lock().unwrap();
        state.config.is_strict_active(now_ms())
    };
    match id {
        "toggle" if !strict => {
            let state = app.state::<App>();
            {
                let mut state = state.state.lock().unwrap();
                state.config.enabled = !state.config.enabled;
                if state.config.enabled {
                    state.config.paused_until = None;
                }
            }
            apply_and_notify(app);
        }
        "pause-15" | "pause-60" if !strict => {
            let minutes: u64 = if id == "pause-15" { 15 } else { 60 };
            let state = app.state::<App>();
            {
                let mut state = state.state.lock().unwrap();
                state.config.paused_until = Some(now_ms() + minutes * 60_000);
            }
            apply_and_notify(app);
        }
        "resume" => {
            let state = app.state::<App>();
            {
                let mut state = state.state.lock().unwrap();
                state.config.paused_until = None;
            }
            apply_and_notify(app);
        }
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

fn apply_and_notify(app: &AppHandle) {
    let state = app.state::<App>();
    crate::persist_and_sync(&state);
    let _ = app.emit("shortblock://state-changed", ());
    refresh(app);
}

pub(crate) fn format_clock(unix_ms: u64) -> String {
    use chrono::TimeZone;
    match chrono::Local.timestamp_millis_opt(unix_ms as i64) {
        chrono::LocalResult::Single(t) => t.format("%H:%M").to_string(),
        _ => "later".to_string(),
    }
}
