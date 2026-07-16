//! Applies the desired block list to `/etc/hosts`.
//!
//! Reading the hosts file needs no privileges, so drift detection is free.
//! Writing goes through `osascript … with administrator privileges`, which
//! shows the standard macOS authentication dialog. A timestamped backup of
//! the previous hosts file is kept next to it, and the DNS cache is flushed
//! after every write so the change takes effect immediately in all browsers.

use std::fs;
use std::process::Command;

use blocker_core::hosts;

const HOSTS_PATH: &str = "/etc/hosts";

#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncStatus {
    /// Whether /etc/hosts currently matches the desired block list.
    pub in_sync: bool,
    /// Domains present in the managed section of the live hosts file.
    pub applied_domains: Vec<String>,
    /// Domains that should be blocked right now.
    pub desired_domains: Vec<String>,
}

pub fn read_hosts() -> Result<String, String> {
    fs::read_to_string(HOSTS_PATH).map_err(|e| format!("Could not read {HOSTS_PATH}: {e}"))
}

pub fn status(desired_domains: &[String]) -> Result<SyncStatus, String> {
    let existing = read_hosts()?;
    let desired_content = hosts::apply_to_hosts(&existing, desired_domains);
    Ok(SyncStatus {
        in_sync: desired_content == existing,
        applied_domains: hosts::current_domains(&existing),
        desired_domains: desired_domains.to_vec(),
    })
}

/// Marker the privileged command prints when the live hosts file no longer
/// matches the snapshot the new content was derived from.
const HOSTS_CHANGED_MARKER: &str = "SHORTBLOCK_HOSTS_CHANGED";

enum SyncFailure {
    /// `/etc/hosts` changed between our read and the privileged replace
    /// (another hosts manager, a manual sudo edit). Re-deriving from a fresh
    /// read preserves those outside-marker changes.
    HostsChanged,
    Other(String),
}

fn sha256_hex(content: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(content.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Rewrites the managed hosts-file section to match `desired_domains`.
/// No-op (and no admin prompt) when the file already matches.
/// Returns `true` when a write actually happened.
pub fn sync(desired_domains: &[String]) -> Result<bool, String> {
    // The hosts file can legitimately change while the admin dialog is open.
    // The privileged command detects that and refuses to replace the file;
    // on that signal, re-read and re-derive so the outside-marker edits made
    // in the meantime are merged rather than overwritten.
    for attempt in 0..2 {
        match sync_once(desired_domains) {
            Ok(written) => return Ok(written),
            Err(SyncFailure::HostsChanged) if attempt == 0 => continue,
            Err(SyncFailure::HostsChanged) => {
                return Err(
                    "The hosts file kept changing while it was being updated; please try again"
                        .to_string(),
                )
            }
            Err(SyncFailure::Other(e)) => return Err(e),
        }
    }
    unreachable!("loop either returns or retries exactly once")
}

fn sync_once(desired_domains: &[String]) -> Result<bool, SyncFailure> {
    let existing = read_hosts().map_err(SyncFailure::Other)?;
    let desired_content = hosts::apply_to_hosts(&existing, desired_domains);
    if desired_content == existing {
        return Ok(false);
    }

    let staging_dir = crate::state::data_dir();
    fs::create_dir_all(&staging_dir)
        .map_err(|e| SyncFailure::Other(format!("Could not create {}: {e}", staging_dir.display())))?;
    let staged = staging_dir.join("hosts.staged");
    fs::write(&staged, &desired_content)
        .map_err(|e| SyncFailure::Other(format!("Could not write {}: {e}", staged.display())))?;

    let staged_path = staged.to_string_lossy().to_string();
    if staged_path.contains('\'') {
        return Err(SyncFailure::Other(
            "Home directory path contains an unsupported quote character".to_string(),
        ));
    }

    // Two integrity checks run inside the privileged command itself:
    // 1. The staged file lives in a user-writable directory and the admin
    //    prompt leaves a window in which another same-user process could
    //    swap its contents. The command first copies it into root-owned
    //    /etc (where the user cannot write), then verifies that copy
    //    against the SHA-256 embedded in the command — a mutated staged
    //    file fails closed and nothing lands.
    // 2. The live hosts file is verified against the snapshot the new
    //    content was derived from; if something else edited it while the
    //    prompt was open, the command refuses to clobber those edits and
    //    the caller re-derives from a fresh read.
    // The DNS-cache flush after the replace is best-effort: the write has
    // already succeeded, so a flush hiccup must not report a failed apply
    // (callers roll back state, e.g. strict sessions, on failed applies).
    let staged_digest = sha256_hex(&desired_content);
    let base_digest = sha256_hex(&existing);

    let shell = format!(
        "tmp=\"$(/usr/bin/mktemp {HOSTS_PATH}.shortblock.XXXXXX)\" || exit 1; \
         /bin/cp '{staged_path}' \"$tmp\" || {{ /bin/rm -f \"$tmp\"; exit 1; }}; \
         actual=\"$(/usr/bin/shasum -a 256 \"$tmp\" | /usr/bin/awk '{{print $1}}')\"; \
         if [ \"$actual\" != \"{staged_digest}\" ]; then \
           /bin/rm -f \"$tmp\"; \
           echo 'staged hosts file failed its integrity check' >&2; exit 1; \
         fi; \
         live=\"$(/usr/bin/shasum -a 256 {HOSTS_PATH} | /usr/bin/awk '{{print $1}}')\"; \
         if [ \"$live\" != \"{base_digest}\" ]; then \
           /bin/rm -f \"$tmp\"; \
           echo '{HOSTS_CHANGED_MARKER}' >&2; exit 1; \
         fi; \
         /bin/chmod 644 \"$tmp\" && \
         /bin/cp {HOSTS_PATH} {HOSTS_PATH}.shortblock.bak && \
         /bin/mv \"$tmp\" {HOSTS_PATH} || exit 1; \
         (/usr/bin/dscacheutil -flushcache || true); \
         (/usr/bin/killall -HUP mDNSResponder || true)"
    );
    let script = format!(
        "do shell script \"{}\" with administrator privileges with prompt \"ShortBlock needs to update the system hosts file to apply your block list.\"",
        shell.replace('\\', "\\\\").replace('"', "\\\"")
    );

    let output = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| SyncFailure::Other(format!("Could not run osascript: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains(HOSTS_CHANGED_MARKER) {
            return Err(SyncFailure::HostsChanged);
        }
        if stderr.contains("User canceled") || stderr.contains("-128") {
            return Err(SyncFailure::Other(
                "Authentication was cancelled — the block list was not applied".to_string(),
            ));
        }
        return Err(SyncFailure::Other(format!(
            "Updating {HOSTS_PATH} failed: {}",
            stderr.trim()
        )));
    }

    // Verify the managed section landed as intended. Comparing just the
    // section (not the whole file) keeps an unrelated edit made immediately
    // after our replace from reading as a failed apply.
    let after = read_hosts().map_err(SyncFailure::Other)?;
    if hosts::current_domains(&after) != desired_domains {
        return Err(SyncFailure::Other(
            "The hosts file changed during the update; please try again".to_string(),
        ));
    }
    Ok(true)
}
