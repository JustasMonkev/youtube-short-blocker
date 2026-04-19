# Popup-Only Surface And Settings Tab UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `popup.html` a true extension-popup-only surface with the approved compact `A` layout, and redirect any normal-tab visit of `popup.html` to `settings.html`.

**Architecture:** Keep `PopupApp` focused on the compact popup UI and move popup-vs-tab detection into the popup entry layer. Add a small redirect helper that resolves `settings.html` and swaps the browser location before React renders when the popup bundle is loaded in a normal tab.

**Tech Stack:** TypeScript, React 19, Chrome Extension Manifest V3, Webpack, Vitest

**Execution note:** The user explicitly asked for no commits in this worktree, so commit steps are intentionally omitted.

---

### File Structure

**Files to modify**
- `src/popup/index.tsx`: add the popup-context guard and redirect bootstrapping before rendering.
- `src/popup/App.tsx`: keep this as the popup-only shell entry using extension state and the settings opener.
- `src/popup/components/PopupApp.tsx`: tighten the popup hierarchy to the approved `A` layout.
- `src/popup/styles.css`: size and spacing for a real extension popup, not a tab page.
- `src/popup/components/PopupApp.test.tsx`: cover popup-only rendering and settings button callback.
- `src/popup/index.test.tsx`: cover popup entry redirect behavior in tab context and non-redirect behavior in popup context.
- `tests/webpack.config.test.ts`: keep build-level checks for both `popup.html` and `settings.html`.

**Files to create**
- `src/popup/utils/popupRuntime.ts`: focused helper for deciding whether the popup entry should redirect and for resolving the settings URL.
- `src/popup/utils/popupRuntime.test.ts`: unit tests for popup-runtime detection and redirect decisions.

**Files to leave unchanged**
- `src/settings/index.tsx`: remains the page entry.
- `src/popup/components/SettingsApp.tsx`: remains the full dashboard composition.
- `src/popup/utils/openSettingsTab.ts`: keeps settings-tab reuse/focus behavior.

### Task 1: Add failing tests for popup runtime redirect behavior

**Files:**
- Create: `src/popup/utils/popupRuntime.ts`
- Create: `src/popup/utils/popupRuntime.test.ts`
- Create: `src/popup/index.test.tsx`
- Test: `src/popup/utils/popupRuntime.test.ts`
- Test: `src/popup/index.test.tsx`

- [ ] **Step 1: Write the failing popup-runtime helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { shouldRedirectPopupPage, getSettingsPageUrl } from './popupRuntime';

describe('popup runtime detection', () => {
  it('returns the settings page url from the popup page url', () => {
    expect(getSettingsPageUrl('chrome-extension://abc/popup.html')).toBe(
      'chrome-extension://abc/settings.html'
    );
  });

  it('redirects when popup.html is running in a browser tab', () => {
    expect(
      shouldRedirectPopupPage({
        href: 'chrome-extension://abc/popup.html',
        pathname: '/popup.html',
        innerWidth: 1280,
        innerHeight: 900
      })
    ).toBe(true);
  });

  it('does not redirect when popup.html is running in popup-sized dimensions', () => {
    expect(
      shouldRedirectPopupPage({
        href: 'chrome-extension://abc/popup.html',
        pathname: '/popup.html',
        innerWidth: 360,
        innerHeight: 520
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the popup-runtime tests to verify they fail**

Run: `npm test -- src/popup/utils/popupRuntime.test.ts`
Expected: FAIL because `./popupRuntime` does not exist yet.

- [ ] **Step 3: Write the failing popup-entry boot test**

```tsx
import { describe, expect, it, vi } from 'vitest';
import * as runtime from './utils/popupRuntime';

describe('popup entry bootstrap', () => {
  it('redirects popup.html tab visits to settings.html before rendering', async () => {
    const replace = vi.fn();
    vi.spyOn(runtime, 'redirectPopupPageIfNeeded').mockImplementation(() => true);
    vi.stubGlobal('window', {
      location: { href: 'chrome-extension://abc/popup.html', replace }
    });

    await import('./index');

    expect(runtime.redirectPopupPageIfNeeded).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the popup-entry test to verify it fails**

Run: `npm test -- src/popup/index.test.tsx`
Expected: FAIL because the entry does not gate rendering or redirect yet.

### Task 2: Implement popup runtime detection and redirect gate

**Files:**
- Create: `src/popup/utils/popupRuntime.ts`
- Modify: `src/popup/index.tsx`
- Test: `src/popup/utils/popupRuntime.test.ts`
- Test: `src/popup/index.test.tsx`

- [ ] **Step 1: Write the minimal popup-runtime helper**

```ts
export function getSettingsPageUrl(popupUrl: string): string {
  return popupUrl.replace(/popup\.html([?#].*)?$/, 'settings.html');
}

export function shouldRedirectPopupPage(input: {
  href: string;
  pathname: string;
  innerWidth: number;
  innerHeight: number;
}): boolean {
  if (!input.pathname.endsWith('/popup.html')) {
    return false;
  }

  return input.innerWidth > 420 || input.innerHeight > 700;
}

export function redirectPopupPageIfNeeded(targetWindow = window): boolean {
  if (
    shouldRedirectPopupPage({
      href: targetWindow.location.href,
      pathname: targetWindow.location.pathname,
      innerWidth: targetWindow.innerWidth,
      innerHeight: targetWindow.innerHeight
    })
  ) {
    targetWindow.location.replace(getSettingsPageUrl(targetWindow.location.href));
    return true;
  }

  return false;
}
```

- [ ] **Step 2: Run the popup-runtime tests to verify they pass**

Run: `npm test -- src/popup/utils/popupRuntime.test.ts`
Expected: PASS

- [ ] **Step 3: Gate popup rendering in the entry file**

```tsx
import { redirectPopupPageIfNeeded } from './utils/popupRuntime';

if (!redirectPopupPageIfNeeded(window)) {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

- [ ] **Step 4: Run popup-entry tests to verify redirect and non-redirect behavior**

Run: `npm test -- src/popup/index.test.tsx`
Expected: PASS

### Task 3: Refine the popup shell to the approved compact `A` layout

**Files:**
- Modify: `src/popup/components/PopupApp.tsx`
- Modify: `src/popup/styles.css`
- Modify: `src/popup/components/PopupApp.test.tsx`
- Test: `src/popup/components/PopupApp.test.tsx`

- [ ] **Step 1: Extend the popup-shell test to assert the compact `A` hierarchy**

```tsx
expect(html).toContain('YouTube Shorts Blocker');
expect(html).toContain('Global status');
expect(html).toContain('Redirects prevented');
expect(html).toContain('Open settings');
expect(html).not.toContain('Custom sites');
expect(html).not.toContain('Diagnostics');
```

- [ ] **Step 2: Run the popup-shell test to verify the new UX expectations fail**

Run: `npm test -- src/popup/components/PopupApp.test.tsx`
Expected: FAIL because the current popup shell has no branded header or compact `A` structure.

- [ ] **Step 3: Implement the minimal approved popup layout**

```tsx
const PopupApp = ({ blockedCount, blockingState, onOpenSettings }) => (
  <main className="popup-shell">
    <header className="popup-brand">
      <p className="popup-kicker">YouTube Shorts Blocker</p>
      <h1 className="popup-title">Focused</h1>
    </header>
    <section className="popup-stack">
      <StatusCard ... />
      <StatsCard blockedCount={blockedCount} />
    </section>
    <button ...>Open settings</button>
  </main>
);
```

- [ ] **Step 4: Tighten popup container sizing in CSS**

```css
body {
  min-width: 340px;
  min-height: 0;
}

#root {
  width: 340px;
}
```

- [ ] **Step 5: Run the popup-shell test to verify it passes**

Run: `npm test -- src/popup/components/PopupApp.test.tsx`
Expected: PASS

### Task 4: Run regression checks for popup/page split behavior

**Files:**
- Modify: `tests/webpack.config.test.ts`
- Test: `src/popup/utils/openSettingsTab.test.ts`
- Test: `tests/webpack.config.test.ts`

- [ ] **Step 1: Keep the webpack test aligned to the split**

```ts
expect(entries).toMatchObject({
  popup: './src/popup/index.tsx',
  settings: './src/settings/index.tsx'
});
```

- [ ] **Step 2: Run the settings-tab helper and webpack tests**

Run: `npm test -- src/popup/utils/openSettingsTab.test.ts tests/webpack.config.test.ts`
Expected: PASS

### Task 5: Run full verification and inspect output

**Files:**
- Modify: `docs/superpowers/plans/2026-04-16-popup-only-settings-tab-ux-implementation.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS and emitted assets include `popup.html` and `settings.html`

- [ ] **Step 4: Inspect emitted routing markers**

Run: `rg -n "default_popup|popup.html|settings.html" dist/manifest.json manifest.json`
Expected: both manifests keep `default_popup: "popup.html"` and the build still emits the settings page.

- [ ] **Step 5: Update this checklist as tasks complete**

```md
- [x] Step completed
```
