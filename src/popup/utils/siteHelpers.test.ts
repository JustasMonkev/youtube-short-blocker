import { describe, it, expect } from 'vitest';
import { parseHost, sanitizeSites, createCustomSite } from './siteHelpers';
import { CustomSite } from '../../types';

describe('siteHelpers', () => {
  describe('parseHost', () => {
    it('returns null for empty string', () => {
      expect(parseHost('')).toBeNull();
      expect(parseHost('   ')).toBeNull();
    });

    it('parses domain only', () => {
      expect(parseHost('example.com')).toEqual({
        host: 'example.com',
        path: '',
        label: 'example.com',
      });
    });

    it('parses domain with protocol', () => {
      expect(parseHost('https://example.com')).toEqual({
        host: 'example.com',
        path: '',
        label: 'example.com',
      });
    });

    it('parses domain with path', () => {
      expect(parseHost('example.com/foo')).toEqual({
        host: 'example.com',
        path: '/foo',
        label: 'example.com/foo',
      });
    });

    it('parses domain with www prefix', () => {
        expect(parseHost('www.example.com')).toEqual({
            host: 'example.com',
            path: '',
            label: 'example.com',
        });
    });

    it('returns null for invalid url', () => {
        // "http://" is technically valid URL constructor input (host is empty string),
        // but normalizeHost returns empty string for empty host.
        expect(parseHost('http://')).toBeNull();
    });

    it('returns null if hostname is empty after normalization', () => {
        // url.hostname is empty for 'https://'
        // normalizeHost returns ''
        expect(parseHost('https://#')).toBeNull();
    });
  });

  describe('sanitizeSites', () => {
    it('returns empty array if input is not an array', () => {
      expect(sanitizeSites(null)).toEqual([]);
      expect(sanitizeSites({})).toEqual([]);
    });

    it('sanitizes valid sites', () => {
      const input = [
        { host: 'example.com', mode: 'block' },
        { host: 'test.com', mode: 'disable_js', enabled: false, path: '/foo' },
      ];
      const result = sanitizeSites(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        host: 'example.com',
        mode: 'block',
        enabled: true,
      });
      expect(result[1]).toMatchObject({
        host: 'test.com',
        mode: 'disable_js',
        enabled: false,
        path: '/foo',
      });
    });

    it('filters out invalid sites', () => {
      const input = [
        null,
        {},
        { host: '' }, // empty host
        { host: '   ' }, // whitespace host -> normalizeHost returns ''
        { host: 'valid.com' },
      ];
      const result = sanitizeSites(input);
      expect(result).toHaveLength(1);
      expect(result[0].host).toBe('valid.com');
    });

    it('generates IDs if missing (fallback)', () => {
        const originalCrypto = global.crypto;
        Object.defineProperty(global, 'crypto', {
            value: undefined,
            writable: true,
            configurable: true,
        });

        const input = [{ host: 'example.com' }];
        const result = sanitizeSites(input);
        expect(result[0].id).toBeDefined();
        expect(result[0].id).toContain('site-');

        // Restore
        Object.defineProperty(global, 'crypto', {
            value: originalCrypto,
            writable: true,
            configurable: true,
        });
    });

    it('generates IDs using crypto.randomUUID', () => {
        const randomUUID = vi.fn().mockReturnValue('uuid-123');
        const originalCrypto = global.crypto;
        Object.defineProperty(global, 'crypto', {
            value: { randomUUID },
            writable: true,
            configurable: true,
        });

        const input = [{ host: 'example.com' }];
        const result = sanitizeSites(input);
        expect(result[0].id).toBe('uuid-123');

        // Restore
        Object.defineProperty(global, 'crypto', {
            value: originalCrypto,
            writable: true,
            configurable: true,
        });
    });

    it('normalizes expiresAt', () => {
        const input = [
            { host: 'a.com', expiresAt: 12345 },
            { host: 'b.com', expiresAt: 'invalid' },
            { host: 'c.com', expiresAt: Infinity },
        ];
        const result = sanitizeSites(input);
        expect(result[0].expiresAt).toBe(12345);
        expect(result[1].expiresAt).toBeNull();
        expect(result[2].expiresAt).toBeNull();
    });
  });

  describe('createCustomSite', () => {
    it('creates a new custom site object', () => {
      const parsed = { host: 'example.com', path: '/foo', label: 'My Site' };
      const site = createCustomSite(parsed);
      expect(site).toEqual({
        id: expect.any(String),
        host: 'example.com',
        path: '/foo',
        label: 'My Site',
        mode: 'block',
        enabled: true,
        expiresAt: null,
      });
    });

    it('uses empty path if missing', () => {
        const parsed = { host: 'example.com', label: 'My Site' } as any;
        const site = createCustomSite(parsed);
        expect(site.path).toBe('');
    });

    it('creates site with crypto ID', () => {
        const randomUUID = vi.fn().mockReturnValue('uuid-custom');
        const originalCrypto = global.crypto;
        Object.defineProperty(global, 'crypto', {
            value: { randomUUID },
            writable: true,
            configurable: true,
        });

        const parsed = { host: 'example.com', label: 'My Site' } as any;
        const site = createCustomSite(parsed);
        expect(site.id).toBe('uuid-custom');

        // Restore
        Object.defineProperty(global, 'crypto', {
            value: originalCrypto,
            writable: true,
            configurable: true,
        });
    });
  });
});
