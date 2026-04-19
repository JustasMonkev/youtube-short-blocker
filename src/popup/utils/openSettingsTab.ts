export interface SettingsTabCandidate {
  id?: number | undefined;
  windowId?: number | undefined;
  url?: string | undefined;
}

interface FocusedTabHandlers {
  settingsUrl: string;
  queryTabs: (callback: (tabs: SettingsTabCandidate[]) => void) => void;
  focusWindow: (windowId: number, info: { focused: boolean }, callback: () => void) => void;
  activateTab: (tabId: number, info: { active: boolean }, callback: () => void) => void;
  createTab: (options: { url: string }, callback?: () => void) => void;
  getLastError: () => Error | null;
}

const SETTINGS_URL_PATTERN_HASH = '#';
const SETTINGS_URL_PATTERN_QUERY = '?';

interface OpenSettingsTabOptions {
  settingsUrl?: string;
  queryTabs?: FocusedTabHandlers['queryTabs'];
  focusWindow?: FocusedTabHandlers['focusWindow'];
  activateTab?: FocusedTabHandlers['activateTab'];
  createTab?: FocusedTabHandlers['createTab'];
  getLastError?: FocusedTabHandlers['getLastError'];
}

export function openOrFocusSettingsTab(options: OpenSettingsTabOptions = {}): void {
  const handlers = resolveHandlers(options);
  handlers.queryTabs((tabs) => {
    const existingTab = tabs.find((tab) => isSettingsTab(tab.url || '', handlers.settingsUrl));

    if (!existingTab?.id || !Number.isInteger(existingTab.windowId)) {
      handlers.createTab({ url: handlers.settingsUrl });
      return;
    }

    handlers.focusWindow(existingTab.windowId as number, { focused: true }, () => {
      if (handlers.getLastError()) {
        handlers.createTab({ url: handlers.settingsUrl });
        return;
      }

      handlers.activateTab(existingTab.id as number, { active: true }, () => {
        if (handlers.getLastError()) {
          handlers.createTab({ url: handlers.settingsUrl });
        }
      });
    });
  });
}

function resolveHandlers(overrides: OpenSettingsTabOptions): FocusedTabHandlers {
  return {
    settingsUrl: overrides.settingsUrl ?? getSettingsUrl(),
    queryTabs: overrides.queryTabs ?? queryAllTabs,
    focusWindow: overrides.focusWindow ?? focusWindow,
    activateTab: overrides.activateTab ?? activateTab,
    createTab: overrides.createTab ?? createTab,
    getLastError: overrides.getLastError ?? getLastError,
  };
}

function isSettingsTab(url: string, settingsUrl: string): boolean {
  if (url === settingsUrl) {
    return true;
  }

  const hasQuery = settingsUrl + SETTINGS_URL_PATTERN_QUERY;
  const hasHash = settingsUrl + SETTINGS_URL_PATTERN_HASH;
  return url.startsWith(hasQuery) || url.startsWith(hasHash);
}

function getSettingsUrl(): string {
  return typeof chrome !== 'undefined' ? chrome.runtime.getURL('settings.html') : 'settings.html';
}

function queryAllTabs(callback: (tabs: SettingsTabCandidate[]) => void): void {
  if (!('chrome' in globalThis) || !chrome.tabs?.query) {
    callback([]);
    return;
  }

  chrome.tabs.query({}, callback);
}

function focusWindow(windowId: number, info: { focused: boolean }, callback: () => void): void {
  if (!('chrome' in globalThis) || !chrome.windows?.update) {
    callback();
    return;
  }

  chrome.windows.update(windowId, info, callback);
}

function activateTab(tabId: number, info: { active: boolean }, callback: () => void): void {
  if (!('chrome' in globalThis) || !chrome.tabs?.update) {
    callback();
    return;
  }

  chrome.tabs.update(tabId, info, callback);
}

function createTab(options: { url: string }, callback?: () => void): void {
  if (!('chrome' in globalThis) || !chrome.tabs?.create) {
    if (callback) {
      callback();
    }
    return;
  }

  if (callback) {
    chrome.tabs.create(options, () => callback());
    return;
  }

  chrome.tabs.create(options);
}

function getLastError(): Error | null {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.lastError) {
    return null;
  }

  return new Error(chrome.runtime.lastError.message);
}
