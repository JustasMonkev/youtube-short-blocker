import { CustomSite, ParsedHost } from '../../types';

export function parseHost(value: string): ParsedHost | null {
  let candidate = value.trim();
  if (!candidate) {
    return null;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    const host = normalizeHost(url.hostname);
    if (!host) {
      return null;
    }

    const path = normalizePath(url.pathname);

    const label = path ? `${host}${path}` : host;
    return { host, path, label };
  } catch (error) {
    return null;
  }
}

export function sanitizeSites(value: unknown): CustomSite[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((site, index) => {
      if (!site || !site.host) {
        return null;
      }

      const host = normalizeHost(String(site.host));
      const path = normalizePath(site.path);
      const label = site.label || (path ? `${host}${path}` : host);
      const expiresAt = normalizeExpiresAt(site.expiresAt);

      const sanitizedSite: CustomSite = {
        id: site.id || `site-${index}`,
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

export function createCustomSite(parsed: ParsedHost): CustomSite {
  return {
    id: createId(),
    host: parsed.host,
    path: parsed.path || '',
    label: parsed.label,
    mode: 'block',
    enabled: true,
    expiresAt: null
  };
}

function createId(): string {
  if (self.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `site-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeHost(host: string): string {
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

function normalizeExpiresAt(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}
