import { describe, expect, it } from 'vitest';
import {
  domainMatches,
  expireFinishedTimers,
  getNextExpiryTime,
  isSiteActive,
  normalizeHost,
  normalizePath,
  sanitizeSites,
  urlMatchesSite
} from './utils';
import { CustomSite } from '../types';

const blockSite = (site: Omit<CustomSite, 'mode'>): CustomSite => ({ ...site, mode: 'block' });

describe('sanitizeSites', () => {
  it('accepts legacy string entries and normalizes object entries', () => {
      expect(
      sanitizeSites([
        'www.Legacy.com',
        { host: '  api.Example.com ', path: 'feed', mode: 'disable_js', expiresAt: 100 },
        { host: '', path: '/bad' }
      ])
    ).toEqual([
      {
        id: 'www.legacy.com-0',
        host: 'www.legacy.com',
        path: '',
        label: 'www.legacy.com',
        scope: 'all',
        mode: 'block',
        enabled: true,
        expiresAt: null
      },
      {
        id: 'api.example.com-1',
        host: 'api.example.com',
        path: '/feed',
        label: 'api.example.com/feed',
        scope: 'all',
        mode: 'disable_js',
        enabled: true,
        expiresAt: 100
      }
    ]);
  });

  it('returns [] when input is not an array', () => {
    expect(sanitizeSites(undefined)).toEqual([]);
  });
});

describe('isSiteActive', () => {
  it('returns false after expiry time', () => {
    expect(
      isSiteActive(
        blockSite({ id: '1', host: 'x.com', path: '', label: 'x', enabled: true, expiresAt: 100 }) as CustomSite,
        200
      )
    ).toBe(false);
  });

  it('returns true when enabled and unexpired', () => {
    expect(
      isSiteActive(
        blockSite({ id: '1', host: 'x.com', path: '', label: 'x', enabled: true, expiresAt: 200 }) as CustomSite,
        100
      )
    ).toBe(true);
  });

  it('respects explicit disabled state', () => {
    expect(
      isSiteActive(
        blockSite({ id: '1', host: 'x.com', path: '', label: 'x', enabled: false, expiresAt: null }) as CustomSite,
        100
      )
    ).toBe(false);
  });
});

describe('expireFinishedTimers', () => {
  it('clears only expired active timers', () => {
    const input: CustomSite[] = [
      blockSite({ id: 'active', host: 'x.com', path: '', label: 'x', enabled: true, expiresAt: 100 }),
      blockSite({ id: 'future', host: 'y.com', path: '', label: 'y', enabled: true, expiresAt: 300 }),
      blockSite({ id: 'disabled', host: 'z.com', path: '', label: 'z', enabled: false, expiresAt: 50 })
    ];

    expect(expireFinishedTimers(input, 200)).toEqual({
      changed: true,
      sites: [
        blockSite({ id: 'active', host: 'x.com', path: '', label: 'x', enabled: false, expiresAt: null }),
        blockSite({ id: 'future', host: 'y.com', path: '', label: 'y', enabled: true, expiresAt: 300 }),
        blockSite({ id: 'disabled', host: 'z.com', path: '', label: 'z', enabled: false, expiresAt: 50 })
      ]
    });
  });

  it('does not mutate expired disabled sites', () => {
    const input: CustomSite[] = [
      blockSite({ id: 'disabled', host: 'z.com', path: '', label: 'z', enabled: false, expiresAt: 50 })
    ];
    const { sites } = expireFinishedTimers(input, 200);
    expect(sites).toEqual(input);
  });
});

describe('getNextExpiryTime', () => {
  it('returns nearest expiry in the future', () => {
    expect(
      getNextExpiryTime(
        [
          blockSite({ id: 'a', host: 'a.com', path: '', label: 'a', enabled: true, expiresAt: 500 }),
          blockSite({ id: 'b', host: 'b.com', path: '', label: 'b', enabled: true, expiresAt: 250 }),
          blockSite({ id: 'c', host: 'c.com', path: '', label: 'c', enabled: true, expiresAt: 300 }),
          blockSite({ id: 'd', host: 'd.com', path: '', label: 'd', enabled: false, expiresAt: 100 })
        ],
        200
      )
    ).toBe(250);
  });

  it('returns null when no future expiry exists', () => {
    expect(
      getNextExpiryTime(
        [
          blockSite({ id: 'a', host: 'a.com', path: '', label: 'a', enabled: false, expiresAt: 100 }),
          blockSite({ id: 'b', host: 'b.com', path: '', label: 'b', enabled: true, expiresAt: 100 })
        ],
        200
      )
    ).toBeNull();
  });
});

describe('urlMatchesSite', () => {
  const target: CustomSite = blockSite({
    id: '1',
    host: 'youtube.com',
    path: '/shorts',
    label: 'yt',
    enabled: true,
    expiresAt: null
  });

  it('matches on host and path scope', () => {
    expect(urlMatchesSite('https://www.youtube.com/shorts/abc', target)).toBe(true);
  });

  it('rejects URLs outside the site scope', () => {
    expect(urlMatchesSite('https://youtube.com/live', target)).toBe(false);
    expect(urlMatchesSite('https://other.com/shorts', target)).toBe(false);
  });

  it('matches every path for host-only sites', () => {
    expect(urlMatchesSite('https://www.youtube.com/anything', { ...target, path: '' })).toBe(true);
  });
});

describe('normalize helpers', () => {
  it('normalizes hosts and paths consistently', () => {
    expect(normalizeHost('  WWW.Example.COM ')).toBe('example.com');
    expect(normalizePath('')).toBe('');
    expect(normalizePath('foo/bar')).toBe('/foo/bar');
    expect(normalizePath('/foo/bar')).toBe('/foo/bar');
    expect(normalizePath('/')).toBe('');
  });

  it('resolves domain matching including subdomain scope', () => {
    expect(domainMatches('api.youtube.com', 'youtube.com')).toBe(true);
    expect(domainMatches('youtube.com', 'youtube.com')).toBe(true);
    expect(domainMatches('example.com', 'youtube.com')).toBe(false);
  });
});
