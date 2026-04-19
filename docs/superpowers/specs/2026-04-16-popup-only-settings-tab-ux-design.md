# Popup-Only Surface And Settings Tab UX Design

## Summary

The extension will separate the compact action popup from the full settings page more strictly:

- `popup.html` is only the extension popup surface.
- `settings.html` is the only full-page dashboard surface.

The popup will use the approved compact `A` layout direction:

- Branded header
- Global status card
- Redirects prevented card
- One `Open settings` button

If `popup.html` is opened directly in a normal browser tab, it should immediately redirect to `settings.html` instead of rendering the popup UI in a tab-sized page.

## Goals

- Make the browser-action popup feel purpose-built for a small extension surface.
- Remove ambiguity between popup and full-page dashboard URLs.
- Ensure the only full-page management experience lives at `settings.html`.
- Improve popup hierarchy and readability without adding more controls to it.

## Non-Goals

- Adding new blocking features.
- Changing the underlying blocking/storage architecture.
- Moving settings into Chrome `options_ui`.
- Creating multiple full-page dashboard routes.

## User Experience

### Popup

Clicking the extension icon opens a true extension popup. The popup is compact and visually focused, using a stacked card layout:

- Header / brand strip
- Global status
- Redirects prevented
- `Open settings`

The popup does not show:

- Site management
- Focus hours editing
- Timers
- Diagnostics
- Advanced controls

The popup should feel like a quick status glance, not a compressed dashboard.

### Settings Page

Clicking `Open settings` opens or focuses `settings.html` in a normal browser tab. This page remains the main dashboard for:

- Site blocking management
- Focus hours and schedule controls
- Timers
- Diagnostics
- Existing advanced controls

`settings.html` is the canonical full-page management URL.

### Direct URL Behavior

If `popup.html` is opened directly in a browser tab, it must not behave like a page-sized dashboard. Instead:

1. Detect that the popup entry is running in a browser tab rather than a popup surface
2. Immediately navigate to `settings.html`

This keeps the URL responsibilities clear:

- `popup.html` = popup only
- `settings.html` = page only

## Technical Design

### Entry Responsibilities

- `src/popup/index.tsx` remains the popup entry bundle
- `src/settings/index.tsx` remains the settings-page entry bundle

The popup entry should gain a small context guard that decides whether it is running in popup context or tab context. If it is tab context, redirect before rendering the compact popup layout.

### Context Detection

The popup entry should use a lightweight browser-safe check to determine whether it is in an extension popup window versus a normal tab. The exact mechanism can be implementation-led, but the behavior requirement is strict:

- popup context: render popup UI
- tab context: redirect to `settings.html`

The detection logic should stay local to the popup entry layer instead of leaking into shared UI components.

### Popup Composition

`PopupApp` should remain a dedicated popup-only shell. It should present the approved compact `A` layout and continue using the existing state hooks as read-only inputs.

The popup button should continue using the settings-tab helper that:

- Resolves `settings.html`
- Reuses an existing matching tab if present
- Focuses that tab and window when found
- Creates a new settings tab otherwise

### Settings Composition

`SettingsApp` remains the richer composition root for all controls and summaries. Existing dashboard sections stay in `settings.html`; they should not be reintroduced into the popup.

## Error Handling

- If the popup-to-settings redirect check fails unexpectedly, fail safe by navigating to `settings.html`.
- If focusing an existing settings tab fails, create a new one.
- If popup state is temporarily unavailable, continue showing safe default popup values instead of crashing.

## Testing Strategy

The updated split should be verified with targeted tests:

- Popup component renders only compact popup content.
- Popup button invokes the settings-opening action.
- Popup entry redirects to `settings.html` when run in tab context.
- Popup entry does not redirect when running in popup context.
- Settings-tab helper still reuses an existing settings tab when possible.
- Build verification still confirms emitted `popup.html` and `settings.html`.

Tests must be discoverable by the configured test runner.

## Migration Notes

The current implementation already restored the real popup and split out `settings.html`. This change tightens the behavior further by making `popup.html` invalid as a page destination and redirecting it to `settings.html`.

After this update:

- Toolbar icon opens popup
- `Open settings` opens page
- Manual tab navigation to `popup.html` redirects to `settings.html`
