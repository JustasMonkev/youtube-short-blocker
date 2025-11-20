import { CustomSite, StorageChanges } from '../types';

const CUSTOM_RULE_START = 1000;
const MAX_CUSTOM_RULES = 400;
const EXPIRY_ALARM_NAME = 'customSiteExpiry';

let blockingEnabled = true;
let cachedCustomSites: CustomSite[] = [];

initializeState();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled', 'blockedCount', 'customSites'], (result) => {
    const defaults: Partial<{ enabled: boolean; blockedCount: number; customSites: CustomSite[] }> = {};

    if (typeof result.enabled === 'undefined') {
      defaults.enabled = true;
    }
    if (typeof result.blockedCount === 'undefined') {
      defaults.blockedCount = 0;
    }
    if (!Array.isArray(result.customSites)) {
      defaults.customSites = [];
    }

    if (Object.keys(defaults).length) {
      chrome.storage.sync.set(defaults);
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== EXPIRY_ALARM_NAME) {
    return;
  }
  syncControls();
});

function initializeState(): void {
  chrome.storage.sync.get(['enabled', 'customSites'], (result) => {
    blockingEnabled = result.enabled !== false;
    cachedCustomSites = sanitizeSites(result.customSites);
    syncControls();
  });
}

chrome.storage.onChanged.addListener((changes: StorageChanges, areaName: string) => {
  if (areaName !== 'sync') {
    return;
  }

  if (changes.customSites) {
    cachedCustomSites = sanitizeSites(changes.customSites.newValue);
  }

  if (changes.enabled) {
    blockingEnabled = changes.enabled.newValue !== false;
  }

  syncControls();
});

function syncControls(): void {
  const now = Date.now();
  const { sites, changed } = expireFinishedTimers(cachedCustomSites, now);

  cachedCustomSites = sites;
  if (changed) {
    chrome.storage.sync.set({ customSites: sites });
  }

  applyCustomControls(now);
  scheduleNextExpiry(sites, now);
}

function applyCustomControls(now = Date.now()): void {
  const activeSites = blockingEnabled
    ? cachedCustomSites.filter((site) => isSiteActive(site, now))
    : [];

  updateDynamicRulesForSites(activeSites);
}

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (!blockingEnabled) return;

    const matchedSite = cachedCustomSites.find(
      (site) => site.mode === 'block' && isSiteActive(site) && urlMatchesSite(details.url, site)
    );

    if (!matchedSite) {
      return;
    }

    chrome.storage.sync.get(['blockedCount'], (result) => {
      const newCount = (result.blockedCount || 0) + 1;
      chrome.storage.sync.set({ blockedCount: newCount });
    });

    const fallbackUrl = createFallbackUrl(details.url);
    chrome.tabs.update(details.tabId, { url: fallbackUrl });
  }
);

function updateDynamicRulesForSites(sites: CustomSite[]): void {
  const blockSites = sites.filter((site) => site.mode === 'block');
  const addRules = blockSites.slice(0, MAX_CUSTOM_RULES).map((site, index) => ({
    id: CUSTOM_RULE_START + index,
    priority: 1,
    action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
    condition: buildRuleCondition(site)
  }));

  const removeRuleIds = Array.from({ length: MAX_CUSTOM_RULES }, (_, idx) => CUSTOM_RULE_START + idx);

  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules }, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to update custom blocking rules:', chrome.runtime.lastError);
    }
  });
}

function sanitizeSites(value: any): CustomSite[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((site, index) => {
      if (typeof site === 'string') {
        const host = site.toLowerCase();
        const sanitizedSite: CustomSite = {
          id: `${host}-${index}`,
          host,
          path: '',
          label: host,
          mode: 'block',
          enabled: true,
          expiresAt: null
        };
        return sanitizedSite;
      }

      if (!site || !site.host) {
        return null;
      }

      const host = normalizeHost(site.host);
      const path = normalizePath(site.path);
      const label = site.label || (path ? `${host}${path}` : host);
      const expiresAt = normalizeExpiresAt(site.expiresAt);

      if (!host) {
        return null;
      }

      const sanitizedSite: CustomSite = {
        id: site.id || `${host}-${index}`,
        host,
        path,
        label,
        mode: site.mode === 'disable_js' ? 'disable_js' : 'block',
        enabled: site.enabled !== false,
        expiresAt
      };
      return sanitizedSite;
    })
    .filter((site): site is CustomSite => site !== null);
}

function isSiteActive(site: CustomSite, now: number = Date.now()): boolean {
  return site.enabled && (!site.expiresAt || site.expiresAt > now);
}

function expireFinishedTimers(
  sites: CustomSite[],
  now: number
): { sites: CustomSite[]; changed: boolean } {
  let changed = false;

  const nextSites = sites.map((site) => {
    if (site.enabled && site.expiresAt && site.expiresAt <= now) {
      changed = true;
      return { ...site, enabled: false, expiresAt: null };
    }
    return site;
  });

  return { sites: nextSites, changed };
}

function scheduleNextExpiry(sites: CustomSite[], now: number = Date.now()): void {
  const upcoming = sites
    .filter((site) => site.enabled && typeof site.expiresAt === 'number' && site.expiresAt > now)
    .map((site) => site.expiresAt as number);

  if (!upcoming.length) {
    chrome.alarms.clear(EXPIRY_ALARM_NAME);
    return;
  }

  const soonest = Math.min(...upcoming);
  chrome.alarms.create(EXPIRY_ALARM_NAME, { when: soonest + 1000 });
}

function buildRuleCondition(site: CustomSite): chrome.declarativeNetRequest.RuleCondition {
  const normalizedHost = normalizeHost(site.host);
  const normalizedPath = normalizePath(site.path);
  const escapedHost = escapeForRegex(normalizedHost);

  const regexFilter = normalizedPath
    ? `^https?://([\\w-]+\\.)*${escapedHost}${escapeForRegex(normalizedPath)}.*`
    : `^https?://([\\w-]+\\.)*${escapedHost}(/.*)?$`;

  return {
    regexFilter,
    requestDomains: [normalizedHost],
    resourceTypes: [
      chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
      chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
      chrome.declarativeNetRequest.ResourceType.STYLESHEET,
      chrome.declarativeNetRequest.ResourceType.SUB_FRAME
    ]
  };
}

function urlMatchesSite(candidate: string, site: CustomSite): boolean {
  try {
    const url = new URL(candidate);
    if (!domainMatches(url.hostname, site.host)) {
      return false;
    }

    if (!site.path) {
      return true;
    }

    const path = normalizePath(site.path);
    return url.pathname.startsWith(path);
  } catch (error) {
    console.error('Failed to parse URL for matching', candidate, error);
    return false;
  }
}

function domainMatches(currentHost: string, targetHost: string): boolean {
  const normalizedCurrent = normalizeHost(currentHost);
  const normalizedTarget = normalizeHost(targetHost);
  return normalizedCurrent === normalizedTarget || normalizedCurrent.endsWith(`.${normalizedTarget}`);
}

function createFallbackUrl(original: string): string {
  try {
    const url = new URL(original);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'about:blank';
  }
}

function normalizeHost(host: string): string {
  const trimmed = String(host || '').trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('www.') ? trimmed.slice(4) : trimmed;
}

function normalizePath(value?: string): string {
  if (!value || value === '/') {
    return '';
  }

  const path = String(value);
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
