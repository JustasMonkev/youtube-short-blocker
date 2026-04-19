import { CustomSite, SiteScope } from '../types';

export interface ExpiryResult {
  sites: CustomSite[];
  changed: boolean;
}

export function sanitizeSites(value: unknown): CustomSite[] {
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
          scope: 'all',
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
        mode: site.mode === 'whitelist' ? 'whitelist' : site.mode === 'disable_js' ? 'disable_js' : 'block',
        scope: normalizeSiteScope(site.scope),
        enabled: site.enabled !== false,
        expiresAt
      };

      return sanitizedSite;
    })
    .filter((site): site is CustomSite => site !== null);
}

export function isSiteActive(site: CustomSite, now: number = Date.now()): boolean {
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

export function expireFinishedTimers(sites: CustomSite[], now: number): ExpiryResult {
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

export function getNextExpiryTime(sites: CustomSite[], now: number): number | null {
  const upcoming = sites
    .filter((site) => site.enabled && typeof site.expiresAt === 'number' && site.expiresAt > now)
    .map((site) => site.expiresAt as number);

  if (!upcoming.length) {
    return null;
  }

  return Math.min(...upcoming);
}

export function normalizeHost(host: string): string {
  const trimmed = String(host || '').trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('www.') ? trimmed.slice(4) : trimmed;
}

export function normalizePath(value?: string): string {
  if (!value || value === '/') {
    return '';
  }

  const path = String(value);
  return path.startsWith('/') ? path : `/${path}`;
}

export function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function normalizeSiteScope(value: unknown): SiteScope {
  if (value === 'all' || value === 'home' || value === 'watch' || value === 'search') {
    return value;
  }

  return 'all';
}

export function domainMatches(currentHost: string, targetHost: string): boolean {
  const normalizedCurrent = normalizeHost(currentHost);
  const normalizedTarget = normalizeHost(targetHost);
  return normalizedCurrent === normalizedTarget || normalizedCurrent.endsWith(`.${normalizedTarget}`);
}

export function urlMatchesSite(candidate: string, site: CustomSite): boolean {
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
