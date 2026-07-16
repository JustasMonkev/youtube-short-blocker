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

/// Rewrites the managed hosts-file section to match `desired_domains`.
/// No-op (and no admin prompt) when the file already matches.
/// Returns `true` when a write actually happened.
pub fn sync(desired_domains: &[String]) -> Result<bool, String> {
    let existing = read_hosts()?;
    let desired_content = hosts::apply_to_hosts(&existing, desired_domains);
    if desired_content == existing {
        return Ok(false);
    }

    let staging_dir = crate::state::data_dir();
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("Could not create {}: {e}", staging_dir.display()))?;
    let staged = staging_dir.join("hosts.staged");
    fs::write(&staged, &desired_content)
        .map_err(|e| format!("Could not write {}: {e}", staged.display()))?;

    let staged_path = staged.to_string_lossy().to_string();
    if staged_path.contains('\'') {
        return Err("Home directory path contains an unsupported quote character".to_string());
    }

    // The staged file lives in a user-writable directory and the admin
    // prompt leaves a window in which another same-user process could swap
    // its contents before the privileged copy runs. The privileged command
    // therefore first copies the staged file into root-owned /etc (where the
    // user cannot write), then verifies that root-owned copy against the
    // SHA-256 embedded in the command itself, and only then installs it —
    // a staged file mutated at any point fails the check and nothing lands.
    let digest = {
        use sha2::{Digest, Sha256};
        let hash = Sha256::digest(desired_content.as_bytes());
        hash.iter().map(|b| format!("{b:02x}")).collect::<String>()
    };

    let shell = format!(
        "tmp=\"$(/usr/bin/mktemp {HOSTS_PATH}.shortblock.XXXXXX)\" || exit 1; \
         /bin/cp '{staged_path}' \"$tmp\" || {{ /bin/rm -f \"$tmp\"; exit 1; }}; \
         actual=\"$(/usr/bin/shasum -a 256 \"$tmp\" | /usr/bin/awk '{{print $1}}')\"; \
         if [ \"$actual\" != \"{digest}\" ]; then \
           /bin/rm -f \"$tmp\"; \
           echo 'staged hosts file failed its integrity check' >&2; exit 1; \
         fi; \
         /bin/chmod 644 \"$tmp\" && \
         /bin/cp {HOSTS_PATH} {HOSTS_PATH}.shortblock.bak && \
         /bin/mv \"$tmp\" {HOSTS_PATH} && \
         /usr/bin/dscacheutil -flushcache && \
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
        .map_err(|e| format!("Could not run osascript: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("-128") {
            return Err("Authentication was cancelled — the block list was not applied".to_string());
        }
        return Err(format!("Updating {HOSTS_PATH} failed: {}", stderr.trim()));
    }

    // Verify the write landed as intended.
    let after = read_hosts()?;
    if after != desired_content {
        return Err("The hosts file changed during the update; please try again".to_string());
    }
    Ok(true)
}
