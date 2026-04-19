import {
  BlockingDiagnostics,
  CustomSite,
  ScheduleWindow,
  ShortActivitySummary,
  StorageChanges
} from '../types';
import {
  expireFinishedTimers,
  getNextExpiryTime,
  isSiteActive,
  normalizeHost,
  normalizePath,
  sanitizeSites
} from './utils';
import {
  isBlockedBySite,
  isInCooldown,
  isWhitelistedUrl,
  isWithinScheduleWindow
} from './blockingHelpers';
import { incrementBlockedCountByDay, normalizeBlockedCountByDay } from './statsHelpers';

const CUSTOM_RULE_START = 1000;
const MAX_CUSTOM_RULES = 400;
const SITE_EXPIRY_ALARM_NAME = 'customSiteExpiry';
const COOLDOWN_ALARM_NAME = 'globalCooldownExpiry';
const SCHEDULE_WINDOW_ALARM_NAME = 'scheduleWindowTransition';

const DEFAULT_SHORT_ACTIVITY_SUMMARY: ShortActivitySummary = {
  blockedTotal: 0,
  lastBlockedAt: null,
  whitelistSkips: 0,
  cooldownSkips: 0,
  scheduleSkips: 0
};

const DEFAULT_BLOCKING_DIAGNOSTICS: BlockingDiagnostics = {
  lastCheckedAt: null,
  lastCheckedUrl: null,
  lastDecision: 'allowed',
  lastReason: 'disabled',
  activeRules: 0
};

let blockingEnabled = true;
let emergencyMode = false;
let globalCooldownUntil: number | null = null;
let scheduleWindow: ScheduleWindow | null = null;
let cachedCustomSites: CustomSite[] = [];
let blockedCountByDay: Record<string, number> = {};
let shortActivitySummary: ShortActivitySummary = { ...DEFAULT_SHORT_ACTIVITY_SUMMARY };
let blockingDiagnostics: BlockingDiagnostics = { ...DEFAULT_BLOCKING_DIAGNOSTICS };

initializeState();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    [
      'enabled',
      'blockedCount',
      'customSites',
      'blockedCountByDay',
      'globalCooldownUntil',
      'emergencyMode',
      'scheduleWindow',
      'shortActivitySummary',
      'blockingDiagnostics'
    ],
    (result) => {
      const defaults: {
        enabled?: boolean;
        blockedCount?: number;
        customSites?: CustomSite[];
        blockedCountByDay?: Record<string, number>;
        globalCooldownUntil?: number | null;
        emergencyMode?: boolean;
        scheduleWindow?: ScheduleWindow | null;
        shortActivitySummary?: ShortActivitySummary;
        blockingDiagnostics?: BlockingDiagnostics;
      } = {};

      if (typeof result.enabled === 'undefined') {
        defaults.enabled = true;
      }
      if (typeof result.blockedCount === 'undefined') {
        defaults.blockedCount = 0;
      }
      if (!isValidBlockedCountByDay(result.blockedCountByDay)) {
        defaults.blockedCountByDay = {};
      }
      if (!Array.isArray(result.customSites)) {
        defaults.customSites = [];
      }
      if (typeof result.globalCooldownUntil === 'undefined') {
        defaults.globalCooldownUntil = null;
      }
      if (typeof result.emergencyMode !== 'boolean') {
        defaults.emergencyMode = false;
      }
      if (!isValidScheduleWindow(result.scheduleWindow)) {
        defaults.scheduleWindow = null;
      }
      if (!isValidShortActivitySummary(result.shortActivitySummary)) {
        defaults.shortActivitySummary = DEFAULT_SHORT_ACTIVITY_SUMMARY;
      }
      if (!isValidBlockingDiagnostics(result.blockingDiagnostics)) {
        defaults.blockingDiagnostics = DEFAULT_BLOCKING_DIAGNOSTICS;
      }

      if (Object.keys(defaults).length) {
        chrome.storage.sync.set(defaults);
      }
    }
  );
	});

chrome.runtime.onStartup.addListener(() => {
  initializeState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (
    alarm.name !== SITE_EXPIRY_ALARM_NAME &&
    alarm.name !== COOLDOWN_ALARM_NAME &&
    alarm.name !== SCHEDULE_WINDOW_ALARM_NAME
  ) {
    return;
  }
  syncControls();
});

function initializeState(): void {
  chrome.storage.sync.get(
    [
      'enabled',
      'customSites',
      'blockedCountByDay',
      'globalCooldownUntil',
      'emergencyMode',
      'scheduleWindow',
      'shortActivitySummary',
      'blockingDiagnostics'
    ],
    (result) => {
      blockingEnabled = result.enabled !== false;
      cachedCustomSites = sanitizeSites(result.customSites);
      blockedCountByDay = normalizeBlockedCountByDay(result.blockedCountByDay);
      globalCooldownUntil = normalizeOptionalNumberOrNull(result.globalCooldownUntil);
      emergencyMode = result.emergencyMode === true;
      scheduleWindow = isValidScheduleWindow(result.scheduleWindow) ? result.scheduleWindow : null;
      shortActivitySummary = isValidShortActivitySummary(result.shortActivitySummary)
        ? { ...result.shortActivitySummary }
        : { ...DEFAULT_SHORT_ACTIVITY_SUMMARY };
      blockingDiagnostics = isValidBlockingDiagnostics(result.blockingDiagnostics)
        ? { ...result.blockingDiagnostics }
        : { ...DEFAULT_BLOCKING_DIAGNOSTICS };
      syncControls();
    }
  );
}

chrome.storage.onChanged.addListener((changes: StorageChanges, areaName: string) => {
  if (areaName !== 'sync') {
    return;
  }

  if (changes.customSites) {
    cachedCustomSites = sanitizeSites(changes.customSites.newValue);
  }

  if (changes.blockedCountByDay) {
    blockedCountByDay = normalizeBlockedCountByDay(changes.blockedCountByDay.newValue);
  }

  if (changes.enabled) {
    blockingEnabled = changes.enabled.newValue !== false;
  }

  if (changes.globalCooldownUntil) {
    globalCooldownUntil = normalizeOptionalNumberOrNull(changes.globalCooldownUntil.newValue);
  }

  if (changes.emergencyMode) {
    emergencyMode = changes.emergencyMode.newValue === true;
  }

  if (changes.scheduleWindow) {
    scheduleWindow = isValidScheduleWindow(changes.scheduleWindow.newValue)
      ? changes.scheduleWindow.newValue
      : null;
  }

  if (changes.shortActivitySummary) {
    shortActivitySummary = isValidShortActivitySummary(changes.shortActivitySummary.newValue)
      ? { ...changes.shortActivitySummary.newValue }
      : { ...DEFAULT_SHORT_ACTIVITY_SUMMARY };
  }

  if (changes.blockingDiagnostics) {
    blockingDiagnostics = isValidBlockingDiagnostics(changes.blockingDiagnostics.newValue)
      ? { ...changes.blockingDiagnostics.newValue }
      : { ...DEFAULT_BLOCKING_DIAGNOSTICS };
  }

  syncControls();
});

function syncControls(): void {
  const now = Date.now();
  const { sites, changed } = expireFinishedTimers(cachedCustomSites, now);
  const hasCooldownExpired = globalCooldownUntil !== null && globalCooldownUntil <= now;

  cachedCustomSites = sites;

  const updates: Record<string, unknown> = {};

  if (changed) {
    updates.customSites = sites;
  }

  if (hasCooldownExpired) {
    globalCooldownUntil = null;
    updates.globalCooldownUntil = null;
  }

  if (Object.keys(updates).length) {
    chrome.storage.sync.set(updates);
  }

  applyCustomControls(now);
  scheduleNextChecks(sites, now);
}

function applyCustomControls(now = Date.now()): void {
  const shouldBlock = isBlockingEnabled(now);
  const activeSites = shouldBlock
    ? cachedCustomSites.filter((site) => site.mode !== 'whitelist' && isSiteActive(site, now))
    : [];
  const activeRules = activeSites.slice(0, MAX_CUSTOM_RULES).length;

  if (blockingDiagnostics.activeRules !== activeRules) {
    blockingDiagnostics.activeRules = activeRules;
    chrome.storage.sync.set({ blockingDiagnostics });
  }
  updateDynamicRulesForSites(activeSites);
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0 || !details.url) {
    return;
  }

  const now = Date.now();

  if (!isBlockingEnabled(now)) {
    if (isInCooldown(now, globalCooldownUntil)) {
      shortActivitySummary.cooldownSkips += 1;
      recordDecision({
        now,
        url: details.url,
        decision: 'skipped',
        reason: 'cooldown'
      });
    } else if (!isWithinScheduleWindow(now, scheduleWindow)) {
      shortActivitySummary.scheduleSkips += 1;
      recordDecision({
        now,
        url: details.url,
        decision: 'skipped',
        reason: 'scheduleWindow'
      });
    } else {
      recordDecision({
        now,
        url: details.url,
        decision: 'allowed',
        reason: 'disabled'
      });
    }
    return;
  }

  if (isWhitelistedUrl(details.url, cachedCustomSites, now)) {
    shortActivitySummary.whitelistSkips += 1;
    recordDecision({
      now,
      url: details.url,
      decision: 'allowed',
      reason: 'whitelisted'
    });
    return;
  }

  const matchedSite = cachedCustomSites.find((site) => isBlockedBySite(details.url, site, now));

  if (!matchedSite) {
    return;
  }

  chrome.storage.sync.get(['blockedCount', 'blockedCountByDay'], (result) => {
    const newCount = Number(result.blockedCount || 0) + 1;
    const updatedBlockedCountByDay = incrementBlockedCountByDay(
      result.blockedCountByDay as Record<string, number> | undefined,
      now
    );

    blockedCountByDay = { ...updatedBlockedCountByDay };

    shortActivitySummary.blockedTotal += 1;
    shortActivitySummary.lastBlockedAt = now;
    chrome.storage.sync.set({
      blockedCount: newCount,
      blockedCountByDay,
      shortActivitySummary
    });
  });

  recordDecision({
    now,
    url: details.url,
    decision: 'blocked',
    reason: 'ruleBlock'
  });

  const fallbackUrl = createFallbackUrl(details.url);
  chrome.tabs.update(details.tabId, { url: fallbackUrl });
});

function isBlockingEnabled(now = Date.now()): boolean {
  if (!blockingEnabled || emergencyMode) {
    return false;
  }

  if (isInCooldown(now, globalCooldownUntil)) {
    return false;
  }

  if (!isWithinScheduleWindow(now, scheduleWindow)) {
    return false;
  }

  return true;
}

function updateDynamicRulesForSites(sites: CustomSite[]): void {
  const addRules = sites
    .filter((site) => site.mode === 'block' || site.mode === 'disable_js')
    .map((site, index) => ({
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

function scheduleNextChecks(sites: CustomSite[], now: number = Date.now()): void {
  const nextExpiryTime = getNextExpiryTime(sites, now);
  if (nextExpiryTime) {
    chrome.alarms.create(SITE_EXPIRY_ALARM_NAME, { when: nextExpiryTime + 1000, periodInMinutes: 1 });
  } else {
    chrome.alarms.clear(SITE_EXPIRY_ALARM_NAME);
  }

  if (globalCooldownUntil && globalCooldownUntil > now) {
    chrome.alarms.create(COOLDOWN_ALARM_NAME, { when: globalCooldownUntil + 1 });
  } else {
    chrome.alarms.clear(COOLDOWN_ALARM_NAME);
  }

  const nextTransitionAt = getNextScheduleTransitionAt(now, scheduleWindow);
  if (nextTransitionAt) {
    chrome.alarms.create(SCHEDULE_WINDOW_ALARM_NAME, { when: nextTransitionAt });
  } else {
    chrome.alarms.clear(SCHEDULE_WINDOW_ALARM_NAME);
  }
}

function buildRuleCondition(site: CustomSite): chrome.declarativeNetRequest.RuleCondition {
  const normalizedHost = normalizeHost(site.host);
  const normalizedPath = normalizePath(site.path);
  const escapedHost = escapeForRegex(normalizedHost);
  const scope = isYouTubeHost(normalizedHost) ? site.scope || 'all' : 'all';
  const scopePath = buildRulePathPattern(scope, normalizedPath);

  const regexFilter = `^https?://([\\w-]+\\.)*${escapedHost}${scopePath}(?:\\?.*)?$`;

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

function buildRulePathPattern(scope: 'all' | 'home' | 'watch' | 'search', path: string): string {
  if (scope === 'watch') {
    const watchPrefix = path ? `/watch${path}` : '/watch';
    return `${escapeForRegex(watchPrefix)}(?:/.*)?`;
  }

  if (scope === 'search') {
    const searchPrefix = path ? `/results${path}` : '/results';
    return `${escapeForRegex(searchPrefix)}(?:/.*)?`;
  }

  if (scope === 'home' && !path) {
    return '(?:/|/feed(?:/.*)?)';
  }

  return path ? `${escapeForRegex(path)}(?:/.*)?` : '(/.*)?';
}

function createFallbackUrl(original: string): string {
  try {
    const url = new URL(original);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'about:blank';
  }
}

function getNextScheduleTransitionAt(now: number, scheduleWindow: ScheduleWindow | null): number | null {
  if (!scheduleWindow || scheduleWindow.startMinute === scheduleWindow.endMinute) {
    return null;
  }

  const isWindowActive = isWithinScheduleWindow(now, scheduleWindow);
  const minuteStart = now - (now % 60000);

  for (let offsetMinutes = 1; offsetMinutes <= 1440; offsetMinutes += 1) {
    const candidate = minuteStart + offsetMinutes * 60_000;
    if (isWithinScheduleWindow(candidate, scheduleWindow) !== isWindowActive) {
      return candidate;
    }
  }

  return null;
}

function recordDecision(params: {
  now: number;
  url: string;
  decision: BlockingDiagnostics['lastDecision'];
  reason: BlockingDiagnostics['lastReason'];
}): void {
  blockingDiagnostics.lastCheckedAt = params.now;
  blockingDiagnostics.lastCheckedUrl = params.url;
  blockingDiagnostics.lastDecision = params.decision;
  blockingDiagnostics.lastReason = params.reason;
  chrome.storage.sync.set({
    shortActivitySummary,
    blockingDiagnostics
  });
}

function normalizeOptionalNumberOrNull(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isValidScheduleWindow(value: unknown): value is ScheduleWindow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ScheduleWindow>;
  return (
    isValidMinute(candidate.startMinute) &&
    isValidMinute(candidate.endMinute)
  );
}

function isValidBlockedCountByDay(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = value as Record<string, unknown>;
  return Object.values(entries).every(
    (count) => Number.isFinite(Number(count)) && Number.isInteger(Number(count)) && Number(count) >= 0
  );
}

function isValidMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440;
}

function isValidShortActivitySummary(value: unknown): value is ShortActivitySummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<ShortActivitySummary>;
  return (
    typeof summary.blockedTotal === 'number' &&
    Number.isInteger(summary.blockedTotal) &&
    summary.blockedTotal >= 0 &&
    (summary.lastBlockedAt === null || (typeof summary.lastBlockedAt === 'number' && Number.isFinite(summary.lastBlockedAt))) &&
    typeof summary.whitelistSkips === 'number' &&
    Number.isInteger(summary.whitelistSkips) &&
    summary.whitelistSkips >= 0 &&
    typeof summary.cooldownSkips === 'number' &&
    Number.isInteger(summary.cooldownSkips) &&
    summary.cooldownSkips >= 0 &&
    typeof summary.scheduleSkips === 'number' &&
    Number.isInteger(summary.scheduleSkips) &&
    summary.scheduleSkips >= 0
  );
}

function isValidBlockingDiagnostics(value: unknown): value is BlockingDiagnostics {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const diagnostics = value as Partial<BlockingDiagnostics>;
  return (
    diagnostics.lastCheckedAt === null ||
    (typeof diagnostics.lastCheckedAt === 'number' && Number.isFinite(diagnostics.lastCheckedAt))
  ) &&
    (diagnostics.lastCheckedUrl === null || typeof diagnostics.lastCheckedUrl === 'string') &&
    (diagnostics.lastDecision === 'allowed' ||
      diagnostics.lastDecision === 'blocked' ||
      diagnostics.lastDecision === 'skipped') &&
    (diagnostics.lastReason === 'disabled' ||
      diagnostics.lastReason === 'cooldown' ||
      diagnostics.lastReason === 'scheduleWindow' ||
      diagnostics.lastReason === 'whitelisted' ||
      diagnostics.lastReason === 'ruleBlock' ||
      diagnostics.lastReason === 'error') &&
    typeof diagnostics.activeRules === 'number' &&
    Number.isInteger(diagnostics.activeRules) &&
    diagnostics.activeRules >= 0;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isYouTubeHost(host: string): boolean {
  return host === 'youtube.com' || host.endsWith('.youtube.com');
}
