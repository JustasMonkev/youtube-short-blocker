// Content script to handle YouTube Shorts blocking on SPA navigation

console.log('[YouTube Shorts Blocker] Content script loaded');

function checkAndBlock() {
    const currentUrl = window.location.href;
    console.log('[YouTube Shorts Blocker] Checking URL:', currentUrl);

    if (currentUrl.includes('/shorts/')) {
        console.log('[YouTube Shorts Blocker] Shorts detected! Blocking...');

        // Check if blocking is enabled
        chrome.storage.sync.get(['enabled'], (result) => {
            if (result.enabled !== false) {
                console.log('[YouTube Shorts Blocker] Redirecting to homepage');
                window.location.replace('https://www.youtube.com');
            } else {
                console.log('[YouTube Shorts Blocker] Blocking disabled, not redirecting');
            }
        });
    }
}

// Initial check
checkAndBlock();

// Listen for YouTube's custom navigation event
window.addEventListener('yt-navigate-finish', () => {
    console.log('[YouTube Shorts Blocker] yt-navigate-finish event fired');
    checkAndBlock();
});

// Also listen for standard popstate (back/forward)
window.addEventListener('popstate', () => {
    console.log('[YouTube Shorts Blocker] popstate event fired');
    checkAndBlock();
});

// Fallback: MutationObserver to detect URL changes if events fail
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        console.log('[YouTube Shorts Blocker] URL changed via MutationObserver:', lastUrl, '->', url);
        lastUrl = url;
        checkAndBlock();
    }
}).observe(document, { subtree: true, childList: true });
