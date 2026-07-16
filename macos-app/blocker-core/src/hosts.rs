//! Rendering and rewriting of the ShortBlock-managed section of `/etc/hosts`.
//!
//! ShortBlock owns exactly one clearly delimited section of the hosts file and
//! never touches anything outside its markers, so user entries and entries
//! from other tools survive every rewrite. The section is replaced in place at
//! its original position; when there is no section and nothing to add, the
//! file is returned byte-for-byte unchanged so no privileged write is needed.

pub const BEGIN_MARKER: &str = "# >>> ShortBlock managed block — do not edit between markers >>>";
pub const END_MARKER: &str = "# <<< ShortBlock managed block <<<";

/// Last line of defense before content reaches a privileged write: only
/// plain domain names may be rendered, so a corrupted or tampered state file
/// cannot inject arbitrary hosts entries (e.g. via embedded newlines).
fn is_safe_domain(domain: &str) -> bool {
    !domain.is_empty()
        && domain.len() <= 253
        && domain
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

/// Renders just the managed section for the given domains.
/// Unsafe entries are skipped; returns an empty string when nothing remains.
pub fn render_section(domains: &[String]) -> String {
    let safe: Vec<&String> = domains.iter().filter(|d| is_safe_domain(d)).collect();
    if safe.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    out.push_str(BEGIN_MARKER);
    out.push('\n');
    for domain in safe {
        out.push_str(&format!("0.0.0.0 {domain}\n"));
        out.push_str(&format!(":: {domain}\n"));
    }
    out.push_str(END_MARKER);
    out.push('\n');
    out
}

/// Returns the full new hosts-file content: `existing` with the managed
/// section replaced in place by one for `domains` (or removed entirely when
/// `domains` is empty). Content outside the markers is preserved in order;
/// with no existing section and no domains the input is returned unchanged.
pub fn apply_to_hosts(existing: &str, domains: &[String]) -> String {
    let section = render_section(domains);
    let lines: Vec<&str> = existing.lines().collect();
    let begin = lines.iter().position(|l| l.trim() == BEGIN_MARKER);

    let Some(begin) = begin else {
        // No managed section yet. Nothing to block → leave the file alone.
        if section.is_empty() {
            return existing.to_string();
        }
        let mut out = existing.to_string();
        if !out.is_empty() && !out.ends_with('\n') {
            out.push('\n');
        }
        if !out.is_empty() {
            out.push('\n'); // blank separator before the managed section
        }
        out.push_str(&section);
        return out;
    };

    // A missing end marker means a truncated/tampered section; recover by
    // treating everything from the begin marker onward as ours.
    let after_start = lines[begin..]
        .iter()
        .position(|l| l.trim() == END_MARKER)
        .map_or(lines.len(), |off| begin + off + 1);

    let mut before: Vec<&str> = lines[..begin].to_vec();
    if section.is_empty() {
        // Removing the section: also drop the blank separator we inserted
        // above it, so add→remove round-trips to the original file.
        while before.last().is_some_and(|l| l.trim().is_empty()) {
            before.pop();
        }
    }

    let mut out = String::new();
    for line in &before {
        out.push_str(line);
        out.push('\n');
    }
    out.push_str(&section);
    for line in &lines[after_start..] {
        out.push_str(line);
        out.push('\n');
    }
    out
}

/// Extracts the domains currently listed in the managed section, sorted and
/// deduplicated, so callers can diff the live file against the desired state.
pub fn current_domains(existing: &str) -> Vec<String> {
    let mut domains: Vec<String> = Vec::new();
    let mut inside_section = false;
    for line in existing.lines() {
        let trimmed = line.trim();
        if trimmed == BEGIN_MARKER {
            inside_section = true;
            continue;
        }
        if trimmed == END_MARKER {
            inside_section = false;
            continue;
        }
        if inside_section {
            let mut parts = trimmed.split_whitespace();
            if let (Some(_addr), Some(domain)) = (parts.next(), parts.next()) {
                domains.push(domain.to_string());
            }
        }
    }
    domains.sort();
    domains.dedup();
    domains
}

#[cfg(test)]
mod tests {
    use super::*;

    const BASE: &str = "##\n# Host Database\n##\n127.0.0.1\tlocalhost\n255.255.255.255\tbroadcasthost\n::1             localhost\n";

    fn domains(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn appends_section_to_untouched_file() {
        let result = apply_to_hosts(BASE, &domains(&["www.youtube.com", "youtube.com"]));
        assert!(result.starts_with(BASE));
        assert!(result.contains(BEGIN_MARKER));
        assert!(result.contains("0.0.0.0 youtube.com\n"));
        assert!(result.contains(":: youtube.com\n"));
        assert!(result.contains("0.0.0.0 www.youtube.com\n"));
        assert!(result.ends_with(&format!("{END_MARKER}\n")));
    }

    #[test]
    fn replaces_existing_section_in_place() {
        let first = apply_to_hosts(BASE, &domains(&["x.com"]));
        let second = apply_to_hosts(&first, &domains(&["reddit.com"]));
        assert!(!second.contains("x.com"));
        assert!(second.contains("0.0.0.0 reddit.com\n"));
        assert_eq!(second.matches(BEGIN_MARKER).count(), 1);
        assert_eq!(second.matches(END_MARKER).count(), 1);
    }

    #[test]
    fn keeps_entries_after_the_section_in_place() {
        let with_section = apply_to_hosts(BASE, &domains(&["x.com"]));
        let with_trailer = format!("{with_section}10.0.0.5 printer.local\n");
        let updated = apply_to_hosts(&with_trailer, &domains(&["reddit.com"]));
        let end_idx = updated.find(END_MARKER).unwrap();
        let trailer_idx = updated.find("10.0.0.5 printer.local").unwrap();
        assert!(
            trailer_idx > end_idx,
            "entries after the managed section must stay after it"
        );
        assert!(updated.contains("0.0.0.0 reddit.com\n"));
        assert!(!updated.contains("x.com"));
    }

    #[test]
    fn removes_section_when_no_domains() {
        let with_section = apply_to_hosts(BASE, &domains(&["x.com"]));
        let cleared = apply_to_hosts(&with_section, &[]);
        assert_eq!(cleared, BASE);
    }

    #[test]
    fn noop_without_section_and_without_domains() {
        // Trailing blank lines and a missing final newline are untouched:
        // no drift is reported, so no privileged rewrite is triggered.
        let with_blanks = format!("{BASE}\n\n");
        assert_eq!(apply_to_hosts(&with_blanks, &[]), with_blanks);
        let no_newline = "127.0.0.1 localhost";
        assert_eq!(apply_to_hosts(no_newline, &[]), no_newline);
        assert_eq!(apply_to_hosts("", &[]), "");
    }

    #[test]
    fn preserves_user_entries_outside_markers() {
        let custom = format!("{BASE}192.168.1.10 my-nas.local\n");
        let with_section = apply_to_hosts(&custom, &domains(&["x.com"]));
        let cleared = apply_to_hosts(&with_section, &[]);
        assert_eq!(cleared, custom);
    }

    #[test]
    fn recovers_from_truncated_section_missing_end_marker() {
        let broken = format!("{BASE}\n{BEGIN_MARKER}\n0.0.0.0 x.com\n");
        let fixed = apply_to_hosts(&broken, &domains(&["reddit.com"]));
        assert!(!fixed.contains("x.com"));
        assert!(fixed.contains("0.0.0.0 reddit.com\n"));
        assert!(fixed.ends_with(&format!("{END_MARKER}\n")));
    }

    #[test]
    fn handles_file_without_trailing_newline() {
        let no_newline = "127.0.0.1 localhost";
        let result = apply_to_hosts(no_newline, &domains(&["x.com"]));
        assert!(result.starts_with("127.0.0.1 localhost\n"));
        assert!(result.contains("0.0.0.0 x.com\n"));
    }

    #[test]
    fn idempotent_when_domains_unchanged() {
        let once = apply_to_hosts(BASE, &domains(&["x.com", "www.x.com"]));
        let twice = apply_to_hosts(&once, &domains(&["x.com", "www.x.com"]));
        assert_eq!(once, twice);
    }

    #[test]
    fn current_domains_round_trips() {
        let file = apply_to_hosts(BASE, &domains(&["www.x.com", "x.com", "youtube.com"]));
        assert_eq!(current_domains(&file), domains(&["www.x.com", "x.com", "youtube.com"]));
        assert!(current_domains(BASE).is_empty());
    }

    #[test]
    fn render_section_empty_for_no_domains() {
        assert_eq!(render_section(&[]), "");
    }

    #[test]
    fn render_section_skips_unsafe_domains() {
        let malicious = domains(&["evil.com\n1.2.3.4 bank.com", "ok.com", "bad domain.com", ""]);
        let section = render_section(&malicious);
        assert!(section.contains("0.0.0.0 ok.com\n"));
        assert!(!section.contains("bank.com"));
        assert!(!section.contains("bad domain.com"));
        assert_eq!(render_section(&domains(&["evil.com\nx"])), "");
    }
}
