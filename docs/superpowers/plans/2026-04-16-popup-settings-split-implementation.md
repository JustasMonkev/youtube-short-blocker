# Popup And Settings Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a small action popup that shows only global status and redirects prevented, and move the full configuration dashboard into a dedicated extension tab opened from the popup.

**Architecture:** Keep `popup.html` and `settings.html` as separate entry points backed by separate React app shells. Reuse the existing storage-backed hooks and cards for the richer settings dashboard, and move tab-opening logic into a focused helper that can be tested without rendering the whole extension.

**Tech Stack:** TypeScript, React 19, Chrome Extension Manifest V3, Webpack, Vitest

**Execution note:** The user explicitly asked for no commits in this worktree, so commit steps are intentionally omitted.

---

### Task 1: Add failing tests for the split UI surfaces

**Files:**
- Create: `src/popup/components/PopupApp.test.tsx`
- Create: `src/popup/components/SettingsApp.test.tsx`
- Test: `src/popup/components/PopupApp.test.tsx`
- Test: `src/popup/components/SettingsApp.test.tsx`

- [ ] **Step 1: Write the failing popup-shell test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PopupApp from './PopupApp';

describe('PopupApp', () => {
  it('renders only the quick-view cards and settings action', () => {
    const html = renderToStaticMarkup(
      <PopupApp
        blockedCount={12}
        blockingState={{ isActive: true, reason: 'active', cooldownMinutesLeft: null }}
        onOpenSettings={vi.fn()}
      />
    );

    expect(html).toContain('Global status');
    expect(html).toContain('Redirects prevented');
    expect(html).toContain('Open settings');
    expect(html).not.toContain('Custom sites');
    expect(html).not.toContain('Diagnostics');
  });
});
```

- [ ] **Step 2: Run the popup-shell test to verify it fails**

Run: `npm test -- src/popup/components/PopupApp.test.tsx`
Expected: FAIL because `./PopupApp` does not exist yet.

- [ ] **Step 3: Write the failing settings-shell test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SettingsApp from './SettingsApp';

describe('SettingsApp', () => {
  it('renders the richer dashboard sections', () => {
    const html = renderToStaticMarkup(
      <SettingsApp
        extensionState={{
          blockedCount: 12,
          blockedCountByDay: {},
          blockingState: { isActive: true, reason: 'active', cooldownMinutesLeft: null },
          globalCooldownUntil: null,
          emergencyMode: false,
          scheduleWindow: null,
          shortActivitySummary: {
            blockedTotal: 0,
            lastBlockedAt: null,
            whitelistSkips: 0,
            cooldownSkips: 0,
            scheduleSkips: 0
          },
          blockingDiagnostics: {
            lastCheckedAt: null,
            lastCheckedUrl: null,
            lastDecision: 'allowed',
            lastReason: 'disabled',
            activeRules: 0
          },
          permissionHealth: {
            checked: true,
            permissionsApiAvailable: true,
            missingPermissions: [],
            missingOrigins: [],
            error: null
          },
          storageHealth: {
            checked: true,
            healthy: true,
            error: null
          },
          isInCooldown: false,
          setCooldown: vi.fn(),
          clearCooldown: vi.fn(),
          toggleEmergencyMode: vi.fn(),
          updateScheduleWindow: vi.fn(),
          refreshHealth: vi.fn()
        }}
        customSitesState={{
          customSites: [],
          customUrl: '',
          error: '',
          durationMinutes: 0,
          customMode: 'block',
          customScope: 'all',
          now: 0,
          updateCustomUrl: vi.fn(),
          addSite: vi.fn(),
          removeSite: vi.fn(),
          toggleSite: vi.fn(),
          setDurationMinutes: vi.fn(),
          setCustomMode: vi.fn(),
          setCustomScope: vi.fn(),
          updateSiteDuration: vi.fn(),
          updateSiteMode: vi.fn(),
          updateSiteScope: vi.fn(),
          exportSites: vi.fn(),
          importSites: vi.fn()
        }}
      />
    );

    expect(html).toContain('Custom sites');
    expect(html).toContain('Daily redirect summary');
    expect(html).toContain('Diagnostics');
  });
});
```

- [ ] **Step 4: Run the settings-shell test to verify it fails**

Run: `npm test -- src/popup/components/SettingsApp.test.tsx`
Expected: FAIL because `./SettingsApp` does not exist yet.

### Task 2: Add failing tests for settings-tab navigation and build-time manifest behavior

**Files:**
- Create: `src/popup/utils/openSettingsTab.test.ts`
- Create: `webpack.config.test.ts`
- Test: `src/popup/utils/openSettingsTab.test.ts`
- Test: `webpack.config.test.ts`

- [ ] **Step 1: Write the failing settings-tab helper test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { openOrFocusSettingsTab } from './openSettingsTab';

describe('openOrFocusSettingsTab', () => {
  it('focuses an existing settings tab before creating a new one', () => {
    const updateWindow = vi.fn((_windowId, _info, callback) => callback());
    const updateTab = vi.fn((_tabId, _info, callback) => callback());
    const createTab = vi.fn();

    openOrFocusSettingsTab({
      settingsUrl: 'chrome-extension://id/settings.html',
      queryTabs: (callback) =>
        callback([{ id: 3, windowId: 5, url: 'chrome-extension://id/settings.html' }]),
      focusWindow: updateWindow,
      activateTab: updateTab,
      createTab
    });

    expect(updateWindow).toHaveBeenCalledWith(5, { focused: true }, expect.any(Function));
    expect(updateTab).toHaveBeenCalledWith(3, { active: true }, expect.any(Function));
    expect(createTab).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the settings-tab helper test to verify it fails**

Run: `npm test -- src/popup/utils/openSettingsTab.test.ts`
Expected: FAIL because `./openSettingsTab` does not exist yet.

- [ ] **Step 3: Write the failing webpack-manifest test**

```ts
import webpackConfig from '../webpack.config';

describe('webpack manifest transform', () => {
  it('preserves popup.html as the action popup', () => {
    const plugin = webpackConfig.plugins.find(
      (candidate) => candidate.constructor.name === 'CopyPlugin'
    );

    const manifestPattern = plugin.patterns.find(
      (pattern) => pattern.from === 'manifest.json'
    );

    const output = JSON.parse(
      manifestPattern.transform(
        Buffer.from(
          JSON.stringify({
            background: { service_worker: 'background.js' },
            action: { default_popup: 'popup.html' }
          })
        )
      ).toString()
    );

    expect(output.action.default_popup).toBe('popup.html');
  });
});
```

- [ ] **Step 4: Run the webpack-manifest test to verify it fails**

Run: `npm test -- webpack.config.test.ts`
Expected: FAIL because the current transform deletes `action.default_popup`.

### Task 3: Implement the popup shell and settings-tab helper

**Files:**
- Create: `src/popup/components/PopupApp.tsx`
- Create: `src/popup/components/SettingsApp.tsx`
- Create: `src/popup/utils/openSettingsTab.ts`
- Modify: `src/popup/App.tsx`
- Modify: `src/popup/index.tsx`
- Modify: `src/popup/styles.css`
- Test: `src/popup/components/PopupApp.test.tsx`
- Test: `src/popup/components/SettingsApp.test.tsx`
- Test: `src/popup/utils/openSettingsTab.test.ts`

- [ ] **Step 1: Write the minimal popup and settings components**

```tsx
export const PopupApp = ({ blockedCount, blockingState, onOpenSettings }) => (
  <div>{/* popup-only cards and button */}</div>
);

export const SettingsApp = ({ extensionState, customSitesState }) => (
  <main>{/* richer dashboard cards and site controls */}</main>
);
```

- [ ] **Step 2: Run focused tests and make them pass**

Run: `npm test -- src/popup/components/PopupApp.test.tsx src/popup/components/SettingsApp.test.tsx src/popup/utils/openSettingsTab.test.ts`
Expected: PASS

- [ ] **Step 3: Refactor `src/popup/App.tsx` into a thin popup entry**

```tsx
const App = () => {
  const extensionState = useExtensionState();

  return (
    <PopupApp
      blockedCount={extensionState.blockedCount}
      blockingState={extensionState.blockingState}
      onOpenSettings={() => openOrFocusSettingsTab()}
    />
  );
};
```

- [ ] **Step 4: Add a dedicated settings entry point**

```tsx
const SettingsRoot = () => {
  const extensionState = useExtensionState();
  const customSitesState = useCustomSites();

  return <SettingsApp extensionState={extensionState} customSitesState={customSitesState} />;
};
```

- [ ] **Step 5: Run the same focused tests again**

Run: `npm test -- src/popup/components/PopupApp.test.tsx src/popup/components/SettingsApp.test.tsx src/popup/utils/openSettingsTab.test.ts`
Expected: PASS

### Task 4: Wire manifest, webpack, and background behavior to the split entry points

**Files:**
- Create: `src/settings/index.tsx`
- Modify: `manifest.json`
- Modify: `webpack.config.js`
- Modify: `src/background/background.ts`
- Test: `webpack.config.test.ts`

- [ ] **Step 1: Add the settings bundle entry and emitted HTML page**

```js
entry: {
  background: './src/background/background.ts',
  popup: './src/popup/index.tsx',
  settings: './src/settings/index.tsx',
  content: './src/content/content.ts',
}
```

- [ ] **Step 2: Restore the action popup in the manifest transform**

```js
manifest.action = {
  ...(manifest.action || {}),
  default_popup: 'popup.html',
};
```

- [ ] **Step 3: Remove the toolbar click hijack from the background script**

```ts
// delete the chrome.action.onClicked dashboard binding
// keep blocking/state logic unchanged
```

- [ ] **Step 4: Run the manifest/build-focused test to confirm the behavior**

Run: `npm test -- webpack.config.test.ts`
Expected: PASS

### Task 5: Run integration verification and inspect the result

**Files:**
- Modify: `docs/superpowers/plans/2026-04-16-popup-settings-split-implementation.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS and emitted assets include `popup.html` and `settings.html`

- [ ] **Step 3: Inspect the built manifest and output files**

Run: `rg -n "default_popup|settings.html|popup.html" dist manifest.json`
Expected: `dist/manifest.json` contains `default_popup`, and build output includes both HTML entry points.

- [ ] **Step 4: Update the task checklist in this plan file**

```md
- [x] Step completed
```
