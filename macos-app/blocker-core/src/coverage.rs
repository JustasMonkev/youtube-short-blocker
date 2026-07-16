//! Subdomain / related-domain coverage for well-known sites.
//!
//! `/etc/hosts` cannot wildcard subdomains, so blocking `youtube.com` alone
//! leaves `m.youtube.com` reachable. This table maps popular sites to the
//! extra hosts that must be blocked for the block to actually hold: mobile
//! hosts, official mirrors, API endpoints that serve the feed, and the site's
//! URL shorteners. Living in code (not user state) means the packs improve
//! with app updates without touching anyone's saved block list.

/// Related domains that should be blocked alongside `host`.
/// Returns an empty slice for hosts without a coverage pack.
pub fn related_domains(host: &str) -> &'static [&'static str] {
    match host {
        "youtube.com" => &[
            "m.youtube.com",
            "music.youtube.com",
            "youtubei.googleapis.com",
            "youtube-nocookie.com",
            "youtu.be",
        ],
        "reddit.com" => &[
            "old.reddit.com",
            "new.reddit.com",
            "np.reddit.com",
            "sh.reddit.com",
            "i.redd.it",
            "v.redd.it",
            "redd.it",
        ],
        "x.com" | "twitter.com" => &[
            "x.com",
            "twitter.com",
            "mobile.twitter.com",
            "mobile.x.com",
            "t.co",
        ],
        "instagram.com" => &["i.instagram.com", "graph.instagram.com", "instagr.am"],
        "facebook.com" => &[
            "m.facebook.com",
            "mbasic.facebook.com",
            "touch.facebook.com",
            "fb.com",
            "fb.watch",
        ],
        "tiktok.com" => &["m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "us.tiktok.com"],
        "twitch.tv" => &["m.twitch.tv", "clips.twitch.tv", "player.twitch.tv"],
        "netflix.com" => &["m.netflix.com"],
        "pinterest.com" => &["pin.it", "br.pinterest.com", "in.pinterest.com"],
        "linkedin.com" => &["m.linkedin.com", "lnkd.in"],
        "snapchat.com" => &["web.snapchat.com", "story.snapchat.com"],
        "9gag.com" => &["m.9gag.com"],
        "imgur.com" => &["m.imgur.com", "i.imgur.com"],
        _ => &[],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_sites_have_packs() {
        assert!(related_domains("youtube.com").contains(&"m.youtube.com"));
        assert!(related_domains("youtube.com").contains(&"youtu.be"));
        assert!(related_domains("reddit.com").contains(&"old.reddit.com"));
        assert!(related_domains("twitch.tv").contains(&"m.twitch.tv"));
    }

    #[test]
    fn x_and_twitter_cover_each_other() {
        assert!(related_domains("x.com").contains(&"twitter.com"));
        assert!(related_domains("twitter.com").contains(&"x.com"));
        assert!(related_domains("x.com").contains(&"t.co"));
    }

    #[test]
    fn unknown_sites_have_no_pack() {
        assert!(related_domains("example.com").is_empty());
        assert!(related_domains("m.youtube.com").is_empty());
    }
}
