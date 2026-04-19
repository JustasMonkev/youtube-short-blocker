import { CustomSite, SiteScope, ScheduleWindow } from '../types';

const DEFAULT_MINUTE = 0;
const MINUTES_IN_DAY = 1440;

export function isInCooldown(now: number, globalCooldownUntil?: number | null): boolean {
  if (!Number.isFinite(now)) {
    return false;
  }

  if (typeof globalCooldownUntil !== 'number' || !Number.isFinite(globalCooldownUntil)) {
    return false;
  }

  return globalCooldownUntil > now;
}

export function isWithinScheduleWindow(now: number, scheduleWindow?: ScheduleWindow | null): boolean {
  if (!Number.isFinite(now)) {
    return false;
  }

  if (!scheduleWindow) {
    return true;
  }

  const startMinute = normalizeMinute(scheduleWindow.startMinute);
  const endMinute = normalizeMinute(scheduleWindow.endMinute);

  if (startMinute === null || endMinute === null) {
    return true;
  }

  if (startMinute === endMinute) {
    return true;
  }

  const nowDate = new Date(now);
  const currentMinute = nowDate.getHours() * 60 + nowDate.getMinutes();

  if (startMinute < endMinute) {
    return currentMinute >= startMinute && currentMinute < endMinute;
  }

  return currentMinute >= startMinute || currentMinute < endMinute;
}

export function isUrlInScope(candidate: string, scope: SiteScope = 'all'): boolean {
  if (scope === 'all') {
    return true;
  }

  try {
    const parsed = new URL(candidate);
    const pathname = parsed.pathname || '/';

    switch (scope) {
      case 'home':
        return pathname === '/' || pathname.startsWith('/feed');
      case 'watch':
        return pathname.startsWith('/watch');
      case 'search':
        return pathname.startsWith('/results') || pathname.startsWith('/search');
      default:
        return true;
    }
  } catch {
    return false;
  }
}

export function isBlockedBySite(candidate: string, site: CustomSite, now: number = Date.now()): boolean {
  if (site.mode === 'whitelist') {
    return false;
  }

  if (!isSiteActive(site, now)) {
    return false;
  }

  return matchesSite(candidate, site);
}

export function isWhitelistedUrl(candidate: string, sites: CustomSite[], now: number = Date.now()): boolean {
  if (!Array.isArray(sites) || !sites.length) {
    return false;
  }

  return sites.some((site) => site.mode === 'whitelist' && matchesSite(candidate, site, now));
}

export function matchesSite(candidate: string, site: CustomSite, now?: number): boolean {
  try {
    const parsed = new URL(candidate);
    const normalizedSiteHost = normalizeHost(site.host);
    const normalizedHost = normalizeHost(parsed.hostname);
    const normalizedPath = normalizePath(site.path);

    if (!normalizedSiteHost || !normalizedHost) {
      return false;
    }

    const siteActive = isSiteActive(site, now);
    if (!siteActive) {
      return false;
    }

    if (!domainMatches(normalizedHost, normalizedSiteHost)) {
      return false;
    }

    if (normalizedPath && !parsed.pathname.startsWith(normalizedPath)) {
      return false;
    }

    return !isYouTubeSite(normalizedHost) || isUrlInScope(candidate, site.scope || 'all');
  } catch {
    return false;
  }
}

function isYouTubeSite(host: string): boolean {
  return host === 'youtube.com' || host.endsWith('.youtube.com');
}

function normalizeMinute(value: unknown): number | null {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  const minute = Number(value);
  if (!Number.isInteger(minute) || minute < DEFAULT_MINUTE || minute >= MINUTES_IN_DAY) {
    return null;
  }

  return minute;
}

export function normalizeHost(host: string): string {
  if (!host) {
    return '';
  }

  const trimmed = host.trim().toLowerCase();
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

function domainMatches(currentHost: string, targetHost: string): boolean {
  return currentHost === targetHost || currentHost.endsWith(`.${targetHost}`);
}

function isSiteActive(site: CustomSite, now = Date.now()): boolean {
  if (!site || !site.enabled) {
    return false;
  }

  if (!site.expiresAt) {
    return true;
  }

  if (!Number.isFinite(site.expiresAt)) {
    return false;
  }

  return now < site.expiresAt;
}
