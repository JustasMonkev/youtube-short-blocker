import { describe, expect, it } from 'vitest';
import { createCustomSite, parseHost, sanitizeSites } from './siteHelpers';

describe('parseHost', () => {
  it('parses host-only entries', () => {
    expect(parseHost('Example.COM')).toEqual({
      host: 'example.com',
      path: '',
      label: 'example.com'
    });
  });

  it('parses full URLs and normalizes host/path', () => {
    expect(parseHost('https://www.youtube.com/shorts/test')).toEqual({
      host: 'youtube.com',
      path: '/shorts/test',
      label: 'youtube.com/shorts/test'
    });
  });

  it('returns null for blank or malformed values', () => {
    expect(parseHost('')).toBeNull();
    expect(parseHost('::::not-a-url')).toBeNull();
  });
});

describe('sanitizeSites', () => {
  it('normalizes and sanitizes custom site objects', () => {
    const sites = sanitizeSites([
      {
        host: '  WWW.Example.COM ',
        path: 'foo',
        mode: 'disable_js',
        enabled: false,
        expiresAt: Number.NaN
      },
      { host: 'youtube.com', path: '/', label: 'YouTube', id: 'custom-id' },
      { id: 'bad-site', host: '' },
      null
    ]);

    expect(sites).toEqual([
      {
        id: 'site-0',
        host: 'example.com',
        path: '/foo',
        label: 'example.com/foo',
        isProtected: false,
        scope: 'all',
        mode: 'disable_js',
        enabled: false,
        expiresAt: null
      },
      {
        id: 'custom-id',
        host: 'youtube.com',
        path: '',
        label: 'YouTube',
        isProtected: false,
        scope: 'all',
        mode: 'block',
        enabled: true,
        expiresAt: null
      }
    ]);
  });

  it('returns an empty list for non-arrays', () => {
    expect(sanitizeSites(null)).toEqual([]);
    expect(sanitizeSites('abc')).toEqual([]);
  });

  it('preserves explicit protection flags', () => {
    const sites = sanitizeSites([
      {
        host: 'youtube.com',
        isProtected: true,
        mode: 'block',
        enabled: true
      }
    ]);

    expect(sites).toEqual([
      {
        id: 'site-0',
        host: 'youtube.com',
        path: '',
        label: 'youtube.com',
        isProtected: true,
        scope: 'all',
        mode: 'block',
        enabled: true,
        expiresAt: null
      }
    ]);
  });
});

describe('createCustomSite', () => {
  it('marks newly created sites as unprotected by default', () => {
    expect(createCustomSite({ host: 'example.com', path: '', label: 'example.com' }).isProtected).toBe(false);
  });

  it('accepts explicit protection flag', () => {
    expect(
      createCustomSite({ host: 'example.com', path: '/x', label: 'example.com/x' }, { isProtected: true }).isProtected
    ).toBe(true);
  });
});
