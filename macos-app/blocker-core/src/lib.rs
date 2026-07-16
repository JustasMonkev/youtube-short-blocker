//! Platform-independent blocking logic for ShortBlock.
//!
//! Everything here is pure and clock-free: callers pass in the current time
//! (`now_ms`, unix epoch milliseconds) and the current local minute-of-day,
//! so the logic is fully unit-testable on any platform.

pub mod hosts;

use serde::{Deserialize, Serialize};

/// A site the user wants blocked system-wide.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Site {
    pub id: String,
    /// Normalized registrable host, e.g. `youtube.com` (no scheme, no `www.`).
    pub host: String,
    pub label: String,
    pub enabled: bool,
    /// Optional expiry (unix epoch ms). Once passed, the site no longer blocks.
    #[serde(default)]
    pub expires_at: Option<u64>,
}

impl Site {
    pub fn is_active(&self, now_ms: u64) -> bool {
        self.enabled && self.expires_at.map_or(true, |at| at > now_ms)
    }
}

/// A daily focus window expressed in minutes since local midnight.
/// `start == end` means the window covers the whole day.
/// `start > end` wraps past midnight (e.g. 22:00 → 06:00).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleWindow {
    pub start_minute: u16,
    pub end_minute: u16,
}

pub const MINUTES_PER_DAY: u16 = 1440;

impl ScheduleWindow {
    pub fn is_valid(&self) -> bool {
        self.start_minute < MINUTES_PER_DAY && self.end_minute < MINUTES_PER_DAY
    }

    pub fn contains(&self, local_minute: u16) -> bool {
        if self.start_minute == self.end_minute {
            return true;
        }
        if self.start_minute < self.end_minute {
            local_minute >= self.start_minute && local_minute < self.end_minute
        } else {
            local_minute >= self.start_minute || local_minute < self.end_minute
        }
    }
}

/// The full blocking configuration, persisted by the app.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct BlockerConfig {
    pub enabled: bool,
    /// Global pause ("cooldown") until this unix epoch ms.
    #[serde(default)]
    pub paused_until: Option<u64>,
    #[serde(default)]
    pub schedule: Option<ScheduleWindow>,
    #[serde(default)]
    pub sites: Vec<Site>,
}

impl BlockerConfig {
    /// Whether blocking should currently be enforced at all.
    pub fn is_blocking_active(&self, now_ms: u64, local_minute: u16) -> bool {
        if !self.enabled {
            return false;
        }
        if self.paused_until.map_or(false, |until| until > now_ms) {
            return false;
        }
        self.schedule.map_or(true, |w| w.contains(local_minute))
    }

    /// The deduplicated, sorted list of domains that must resolve to nowhere
    /// right now. Each site expands to the bare host plus its `www.` variant,
    /// since `/etc/hosts` cannot express wildcards.
    pub fn active_domains(&self, now_ms: u64, local_minute: u16) -> Vec<String> {
        if !self.is_blocking_active(now_ms, local_minute) {
            return Vec::new();
        }
        let mut domains: Vec<String> = Vec::new();
        for site in self.sites.iter().filter(|s| s.is_active(now_ms)) {
            domains.push(site.host.clone());
            if !site.host.starts_with("www.") {
                domains.push(format!("www.{}", site.host));
            }
        }
        domains.sort();
        domains.dedup();
        domains
    }
}

/// Normalizes free-form user input (`https://www.YouTube.com/shorts?x=1`)
/// into a bare lowercase host (`youtube.com`).
pub fn normalize_host(input: &str) -> Result<String, String> {
    let mut host = input.trim().to_ascii_lowercase();

    for scheme in ["https://", "http://"] {
        if let Some(rest) = host.strip_prefix(scheme) {
            host = rest.to_string();
            break;
        }
    }

    // Drop path, query, and fragment.
    if let Some(idx) = host.find(['/', '?', '#']) {
        host.truncate(idx);
    }
    // Drop credentials and port.
    if let Some(idx) = host.rfind('@') {
        host = host[idx + 1..].to_string();
    }
    if let Some(idx) = host.find(':') {
        host.truncate(idx);
    }
    host = host.trim_end_matches('.').to_string();
    if let Some(rest) = host.strip_prefix("www.") {
        host = rest.to_string();
    }

    if host.is_empty() {
        return Err("Enter a website, e.g. youtube.com".to_string());
    }
    if !host.contains('.') {
        return Err(format!("\"{host}\" is not a full domain, e.g. {host}.com"));
    }
    let labels_ok = host.split('.').all(|label| {
        !label.is_empty()
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    });
    if !labels_ok || host.len() > 253 {
        return Err(format!("\"{host}\" is not a valid domain name"));
    }
    Ok(host)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn site(host: &str, enabled: bool, expires_at: Option<u64>) -> Site {
        Site {
            id: format!("id-{host}"),
            host: host.to_string(),
            label: host.to_string(),
            enabled,
            expires_at,
        }
    }

    #[test]
    fn normalize_host_strips_scheme_www_path_port() {
        assert_eq!(normalize_host("https://www.YouTube.com/shorts?x=1").unwrap(), "youtube.com");
        assert_eq!(normalize_host("http://x.com:8080/home").unwrap(), "x.com");
        assert_eq!(normalize_host("  Reddit.com.  ").unwrap(), "reddit.com");
        assert_eq!(normalize_host("user:pass@evil.com").unwrap(), "evil.com");
        assert_eq!(normalize_host("m.youtube.com").unwrap(), "m.youtube.com");
    }

    #[test]
    fn normalize_host_rejects_invalid_input() {
        assert!(normalize_host("").is_err());
        assert!(normalize_host("   ").is_err());
        assert!(normalize_host("youtube").is_err());
        assert!(normalize_host("bad domain.com").is_err());
        assert!(normalize_host("-bad.com").is_err());
        assert!(normalize_host("https://").is_err());
    }

    #[test]
    fn schedule_window_plain_and_wrapping() {
        let plain = ScheduleWindow { start_minute: 540, end_minute: 1020 }; // 09:00-17:00
        assert!(!plain.contains(539));
        assert!(plain.contains(540));
        assert!(plain.contains(1019));
        assert!(!plain.contains(1020));

        let wrapped = ScheduleWindow { start_minute: 1320, end_minute: 360 }; // 22:00-06:00
        assert!(wrapped.contains(1320));
        assert!(wrapped.contains(0));
        assert!(wrapped.contains(359));
        assert!(!wrapped.contains(360));
        assert!(!wrapped.contains(720));

        let all_day = ScheduleWindow { start_minute: 300, end_minute: 300 };
        assert!(all_day.contains(0));
        assert!(all_day.contains(1439));
    }

    #[test]
    fn blocking_respects_enabled_pause_and_schedule() {
        let mut cfg = BlockerConfig {
            enabled: true,
            paused_until: None,
            schedule: None,
            sites: vec![site("youtube.com", true, None)],
        };
        assert!(cfg.is_blocking_active(1000, 0));

        cfg.enabled = false;
        assert!(!cfg.is_blocking_active(1000, 0));

        cfg.enabled = true;
        cfg.paused_until = Some(2000);
        assert!(!cfg.is_blocking_active(1000, 0));
        assert!(cfg.is_blocking_active(2000, 0)); // pause expired exactly now

        cfg.paused_until = None;
        cfg.schedule = Some(ScheduleWindow { start_minute: 540, end_minute: 1020 });
        assert!(cfg.is_blocking_active(1000, 600));
        assert!(!cfg.is_blocking_active(1000, 100));
    }

    #[test]
    fn active_domains_expands_www_dedups_and_sorts() {
        let cfg = BlockerConfig {
            enabled: true,
            paused_until: None,
            schedule: None,
            sites: vec![
                site("youtube.com", true, None),
                site("www.youtube.com", true, None),
                site("x.com", true, None),
                site("reddit.com", false, None),
                site("expired.com", true, Some(500)),
                site("timed.com", true, Some(5000)),
            ],
        };
        assert_eq!(
            cfg.active_domains(1000, 0),
            vec![
                "timed.com",
                "www.timed.com",
                "www.x.com",
                "www.youtube.com",
                "x.com",
                "youtube.com",
            ]
        );
    }

    #[test]
    fn active_domains_empty_when_blocking_inactive() {
        let cfg = BlockerConfig {
            enabled: false,
            paused_until: None,
            schedule: None,
            sites: vec![site("youtube.com", true, None)],
        };
        assert!(cfg.active_domains(1000, 0).is_empty());
    }
}
