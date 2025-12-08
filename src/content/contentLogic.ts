// Content script to handle YouTube Shorts blocking on SPA navigation

// Logic export for testing
export function checkAndBlock(
  url: string,
  locationReplace: (url: string) => void,
  getEnabled: (cb: (enabled: boolean) => void) => void
) {
    if (url.includes('/shorts/')) {
        console.log('[YouTube Shorts Blocker] Shorts detected! Blocking...');

        getEnabled((enabled) => {
            if (enabled) {
                console.log('[YouTube Shorts Blocker] Redirecting to homepage');
                locationReplace('https://www.youtube.com');
            } else {
                console.log('[YouTube Shorts Blocker] Blocking disabled, not redirecting');
            }
        });
    }
}

// Initial check function
export function initializeContentScript(
  win: Window,
  doc: Document
) {
    console.log('[YouTube Shorts Blocker] Content script loaded');

    const replace = (u: string) => win.location.replace(u);
    const getEnabled = (cb: (enabled: boolean) => void) => {
        chrome.storage.sync.get(['enabled'], (result) => {
            cb(result.enabled !== false);
        });
    };

    const runCheck = () => {
        console.log('[YouTube Shorts Blocker] Checking URL:', win.location.href);
        checkAndBlock(win.location.href, replace, getEnabled);
    };

    // Initial check
    runCheck();

    // Listen for YouTube's custom navigation event
    win.addEventListener('yt-navigate-finish', () => {
        console.log('[YouTube Shorts Blocker] yt-navigate-finish event fired');
        runCheck();
    });

    // Also listen for standard popstate (back/forward)
    win.addEventListener('popstate', () => {
        console.log('[YouTube Shorts Blocker] popstate event fired');
        runCheck();
    });

    // Fallback: MutationObserver to detect URL changes if events fail
    let lastUrl = win.location.href;
    const observer = new MutationObserver(() => {
        const url = win.location.href;
        if (url !== lastUrl) {
            console.log('[YouTube Shorts Blocker] URL changed via MutationObserver:', lastUrl, '->', url);
            lastUrl = url;
            runCheck();
        }
    });

    observer.observe(doc, { subtree: true, childList: true });

    return observer; // For testing cleanup
}
