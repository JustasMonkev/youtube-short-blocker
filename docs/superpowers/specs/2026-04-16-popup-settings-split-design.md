# Popup And Settings Split Design

## Summary

The extension will use two distinct surfaces:

- A small action popup for quick visibility.
- A dedicated settings dashboard opened in a normal extension tab.

The popup will show only the most important at-a-glance information:

- Global status
- Redirects prevented
- An `Open settings` button

All configuration for blocked sites, focus hours, and related controls will move to the settings dashboard. The extension icon will open the popup again instead of opening a full-page dashboard tab.

## Goals

- Keep the action popup simple and fast to scan.
- Provide a full in-tab dashboard for configuration.
- Reuse existing state and logic instead of duplicating behavior.
- Avoid mixing lightweight popup interactions with dense configuration UI.

## Non-Goals

- Building a multi-page settings experience.
- Moving configuration into Chrome's built-in options UI.
- Adding new blocking features as part of this UI split.
- Redesigning the extension's underlying blocking logic.

## User Experience

### Popup

Clicking the extension icon opens a small popup. The popup contains:

- Global status card
- Redirects prevented count
- `Open settings` button

The popup does not contain site management, focus hour editing, timers, diagnostics, or advanced controls.

### Settings Dashboard

Clicking `Open settings` opens a normal browser tab for an extension page dedicated to settings. The dashboard contains the existing configuration controls, including:

- Site blocking management
- Focus hours or schedule controls
- Existing global controls already present in the extension UI
- Supporting diagnostics or summaries that remain useful in a full-page context

If a settings tab is already open, the extension should focus that tab instead of opening duplicates.

## Technical Design

### Entry Points

The extension will expose two separate HTML entry points:

- `popup.html` for the action popup
- `settings.html` for the in-tab settings dashboard

This is preferred over using a single page in two modes because the popup and settings dashboard have materially different responsibilities and layout constraints. Separate entry points reduce conditional UI branching and make future maintenance simpler.

### Manifest Behavior

The manifest will restore `action.default_popup` so the toolbar icon opens the popup again.

The settings dashboard will not use `options_ui` because the requested behavior is a normal extension tab, not Chrome's built-in options page.

### Opening The Settings Tab

The popup's `Open settings` button will call logic that:

1. Resolves the settings page URL with `chrome.runtime.getURL('settings.html')`
2. Searches for an existing matching tab
3. Focuses the existing tab and its window when found
4. Creates a new tab otherwise

This behavior keeps the UI predictable and avoids duplicate settings tabs.

### Component Boundaries

The implementation should split the UI into:

- Popup-specific app shell
- Settings-specific app shell
- Shared hooks and shared presentational components where useful

The popup should depend on shared state readers but not on the heavier settings composition. The settings page can reuse the current richer dashboard content after it is moved out of the popup entry point.

### State And Data Flow

Existing extension state in `chrome.storage.sync` remains the source of truth. Both popup and settings page read from the same storage-backed hooks. No new persistent data model is required for this split.

The background script keeps ownership of blocking logic. UI surfaces remain consumers of stored state and command-style actions.

## Error Handling

- If opening or focusing the settings tab fails, fall back to creating a new tab.
- If popup state cannot be read, show safe default values instead of crashing.
- If settings data is partially missing, the existing storage normalization logic should continue to provide defaults.

## Testing Strategy

Implementation should cover the split with targeted tests:

- Popup renders the minimal quick-view content only.
- Popup exposes an `Open settings` action.
- Settings tab opening logic reuses an existing tab when present.
- Settings tab opening logic creates a new tab when no existing tab matches.
- Existing state readers still render blocked count and status correctly in the popup.

Build verification should confirm both HTML entry points are emitted and the manifest points the browser action back to `popup.html`.

## Migration Notes

The current full-page dashboard behavior triggered from the extension icon will be removed. Any code that forces toolbar clicks to open `popup.html` in a tab should be deleted or rewritten so:

- Toolbar click opens the popup via `default_popup`
- Popup button opens `settings.html` in a normal tab

This keeps the responsibilities clear and aligns the extension with the intended UX.
