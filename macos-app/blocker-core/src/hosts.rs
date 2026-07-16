//! Rendering and rewriting of the ShortBlock-managed section of `/etc/hosts`.
//!
//! ShortBlock owns exactly one clearly delimited section of the hosts file and
//! never touches anything outside its markers, so user entries and entries
//! from other tools survive every rewrite.

pub const BEGIN_MARKER: &str = "# >>> ShortBlock managed block — do not edit between markers >>>";
pub const END_MARKER: &str = "# <<< ShortBlock managed block <<<";

/// Renders just the managed section for the given domains.
/// Returns an empty string when there is nothing to block.
pub fn render_section(domains: &[String]) -> String {
    if domains.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    out.push_str(BEGIN_MARKER);
    out.push('\n');
    for domain in domains {
        out.push_str(&format!("0.0.0.0 {domain}\n"));
        out.push_str(&format!(":: {domain}\n"));
    }
    out.push_str(END_MARKER);
    out.push('\n');
    out
}

/// Returns the full new hosts-file content: `existing` with the managed
/// section replaced by one for `domains` (or removed entirely when `domains`
/// is empty). Content outside the markers is preserved byte-for-byte, except
/// that a missing trailing newline is added before appending a section.
pub fn apply_to_hosts(existing: &str, domains: &[String]) -> String {
    let mut kept: Vec<&str> = Vec::new();
    let mut inside_section = false;
    for line in existing.lines() {
        if line.trim() == BEGIN_MARKER {
            inside_section = true;
            continue;
        }
        if line.trim() == END_MARKER {
            inside_section = false;
            continue;
        }
        if !inside_section {
            kept.push(line);
        }
    }

    // Drop trailing blank lines we may have left behind when removing the section.
    while kept.last().is_some_and(|l| l.trim().is_empty()) {
        kept.pop();
    }

    let mut out = kept.join("\n");
    if !out.is_empty() {
        out.push('\n');
    }

    let section = render_section(domains);
    if !section.is_empty() {
        out.push('\n');
        out.push_str(&section);
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
    fn removes_section_when_no_domains() {
        let with_section = apply_to_hosts(BASE, &domains(&["x.com"]));
        let cleared = apply_to_hosts(&with_section, &[]);
        assert_eq!(cleared, BASE);
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
}
