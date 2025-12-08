import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logic from './backgroundLogic';
import { CustomSite } from '../types';

describe('backgroundLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logic.setState(true, []);
  });

  describe('normalizeHost', () => {
    it('normalizes host correctly', () => {
      expect(logic.normalizeHost('example.com')).toBe('example.com');
      expect(logic.normalizeHost('www.example.com')).toBe('example.com');
      expect(logic.normalizeHost('  Example.com  ')).toBe('example.com');
      expect(logic.normalizeHost('')).toBe('');
    });
  });

  describe('normalizePath', () => {
    it('normalizes path correctly', () => {
      expect(logic.normalizePath('/foo')).toBe('/foo');
      expect(logic.normalizePath('foo')).toBe('/foo');
      expect(logic.normalizePath('')).toBe('');
      expect(logic.normalizePath('/')).toBe('');
    });
  });

  describe('escapeForRegex', () => {
    it('escapes special regex characters', () => {
      expect(logic.escapeForRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
    });
  });

  describe('createFallbackUrl', () => {
    it('returns root url', () => {
      expect(logic.createFallbackUrl('https://example.com/foo/bar')).toBe('https://example.com');
    });

    it('returns about:blank for invalid url', () => {
      // Force URL constructor to throw
      const originalURL = global.URL;
      // Using a class ensures 'new URL()' works and satisfies internal checks if any
      global.URL = class MockURL {
          constructor() {
              throw new Error('Invalid URL');
          }
      } as any;

      expect(logic.createFallbackUrl('invalid-url')).toBe('about:blank');

      global.URL = originalURL;
    });
  });

  describe('domainMatches', () => {
    it('matches exact domain', () => {
      expect(logic.domainMatches('example.com', 'example.com')).toBe(true);
    });

    it('matches subdomain', () => {
      expect(logic.domainMatches('sub.example.com', 'example.com')).toBe(true);
    });

    it('does not match different domain', () => {
      expect(logic.domainMatches('example.org', 'example.com')).toBe(false);
    });
  });

  describe('urlMatchesSite', () => {
    it('matches site without path', () => {
      const site = { host: 'example.com', path: '' } as CustomSite;
      expect(logic.urlMatchesSite('https://example.com/foo', site)).toBe(true);
    });

    it('matches site with path', () => {
      const site = { host: 'example.com', path: '/foo' } as CustomSite;
      expect(logic.urlMatchesSite('https://example.com/foo/bar', site)).toBe(true);
      expect(logic.urlMatchesSite('https://example.com/bar', site)).toBe(false);
    });

    it('handles invalid urls', () => {
      const site = { host: 'example.com' } as CustomSite;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(logic.urlMatchesSite('invalid', site)).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('buildRuleCondition', () => {
    it('builds condition for domain only', () => {
      const site = { host: 'example.com', path: '' } as CustomSite;
      const condition = logic.buildRuleCondition(site);
      expect(condition.requestDomains).toContain('example.com');
      expect(condition.regexFilter).toContain('^https?://([\\w-]+\\.)*example\\.com(/.*)?$');
    });

    it('builds condition for domain and path', () => {
      const site = { host: 'example.com', path: '/foo' } as CustomSite;
      const condition = logic.buildRuleCondition(site);
      expect(condition.regexFilter).toContain('^https?://([\\w-]+\\.)*example\\.com/foo.*');
    });
  });

  describe('sanitizeSites', () => {
    it('handles legacy string format', () => {
      const input = ['example.com'];
      const output = logic.sanitizeSites(input);
      expect(output[0].host).toBe('example.com');
    });

    it('handles object format', () => {
      const input = [{ host: 'example.com', enabled: false }];
      const output = logic.sanitizeSites(input);
      expect(output[0].host).toBe('example.com');
      expect(output[0].enabled).toBe(false);
    });

    it('returns empty array if not array', () => {
        expect(logic.sanitizeSites(null)).toEqual([]);
    });

    it('filters invalid objects', () => {
        const input = [
            null,
            { host: '' }
        ];
        expect(logic.sanitizeSites(input)).toEqual([]);
    });
  });

  describe('expireFinishedTimers', () => {
    it('expires timers correctly', () => {
      const now = 1000;
      const sites = [
        { host: 'a.com', enabled: true, expiresAt: 500 } as CustomSite, // expired
        { host: 'b.com', enabled: true, expiresAt: 1500 } as CustomSite, // active
      ];
      const { sites: newSites, changed } = logic.expireFinishedTimers(sites, now);
      expect(changed).toBe(true);
      expect(newSites[0].enabled).toBe(false);
      expect(newSites[0].expiresAt).toBeNull();
      expect(newSites[1].enabled).toBe(true);
    });

    it('does nothing if no expiry needed', () => {
      const now = 1000;
      const sites = [
        { host: 'b.com', enabled: true, expiresAt: 1500 } as CustomSite,
      ];
      const { sites: newSites, changed } = logic.expireFinishedTimers(sites, now);
      expect(changed).toBe(false);
      expect(newSites).toEqual(sites);
    });
  });

  describe('scheduleNextExpiry', () => {
    it('clears alarm if no upcoming expiry', () => {
      logic.scheduleNextExpiry([], Date.now());
      expect(chrome.alarms.clear).toHaveBeenCalledWith(logic.EXPIRY_ALARM_NAME);
    });

    it('schedules alarm for soonest expiry', () => {
      const now = 1000;
      const sites = [
        { host: 'a.com', enabled: true, expiresAt: 2000 } as CustomSite,
        { host: 'b.com', enabled: true, expiresAt: 3000 } as CustomSite,
      ];
      logic.scheduleNextExpiry(sites, now);
      expect(chrome.alarms.create).toHaveBeenCalledWith(logic.EXPIRY_ALARM_NAME, expect.objectContaining({
        when: 2000 + 1000, // soonest + 1000ms padding
      }));
    });
  });

  describe('isSiteActive', () => {
    it('returns true if enabled and no expiry', () => {
      const site = { enabled: true, expiresAt: null } as CustomSite;
      expect(logic.isSiteActive(site)).toBe(true);
    });

    it('returns false if disabled', () => {
      const site = { enabled: false } as CustomSite;
      expect(logic.isSiteActive(site)).toBe(false);
    });

    it('returns true if not expired', () => {
      const site = { enabled: true, expiresAt: Date.now() + 1000 } as CustomSite;
      expect(logic.isSiteActive(site)).toBe(true);
    });

    it('returns false if expired', () => {
        const site = { enabled: true, expiresAt: Date.now() - 1000 } as CustomSite;
        expect(logic.isSiteActive(site)).toBe(false);
    });
  });

  describe('handleInstalled', () => {
      it('sets defaults if missing', () => {
          // @ts-ignore
          chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));
          logic.handleInstalled();
          expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
              enabled: true,
              blockedCount: 0,
              customSites: [],
          }));
      });

      it('does not overwrite existing settings', () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({
            enabled: false,
            blockedCount: 10,
            customSites: ['foo']
        }));
        logic.handleInstalled();
        expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      });
  });

  describe('handleAlarm', () => {
      it('ignores unrelated alarms', () => {
          logic.handleAlarm({ name: 'other' } as any);
          expect(chrome.storage.sync.set).not.toHaveBeenCalled(); // syncControls calls set if changed or updates rules
      });

      it('handles expiry alarm', () => {
        // Setup state with expired site
        const now = Date.now();
        const site = { host: 'a.com', enabled: true, expiresAt: now - 1000, mode: 'block' } as CustomSite;
        logic.setState(true, [site]);

        logic.handleAlarm({ name: logic.EXPIRY_ALARM_NAME } as any);

        // Should update storage because site expired
        expect(chrome.storage.sync.set).toHaveBeenCalled();
      });
  });

  describe('handleStorageChange', () => {
      it('ignores non-sync area', () => {
          logic.handleStorageChange({}, 'local');
          expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
      });

      it('updates customSites', () => {
          const sites = [{ host: 'new.com', mode: 'block' }];
          logic.handleStorageChange({
              customSites: { newValue: sites } as any
          }, 'sync');
          const state = logic.getState();
          expect(state.cachedCustomSites[0].host).toBe('new.com');
          expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalled();
      });

      it('updates blockingEnabled', () => {
          logic.handleStorageChange({
              enabled: { newValue: false } as any
          }, 'sync');
          expect(logic.getState().blockingEnabled).toBe(false);
      });
  });

  describe('handleHistoryStateUpdated', () => {
      it('ignores non-main frames', () => {
          logic.handleHistoryStateUpdated({ frameId: 1 } as any);
          expect(chrome.tabs.update).not.toHaveBeenCalled();
      });

      it('ignores if blocking disabled', () => {
          logic.setState(false, []);
          logic.handleHistoryStateUpdated({ frameId: 0 } as any);
          expect(chrome.tabs.update).not.toHaveBeenCalled();
      });

      it('blocks matching site', () => {
          const site = { host: 'bad.com', mode: 'block', enabled: true } as CustomSite;
          logic.setState(true, [site]);

          // Mock blockedCount retrieval
          // @ts-ignore
          chrome.storage.sync.get.mockImplementationOnce((keys, cb) => cb({ blockedCount: 10 }));

          logic.handleHistoryStateUpdated({
              frameId: 0,
              url: 'https://bad.com/shorts',
              tabId: 123
          } as any);

          expect(chrome.tabs.update).toHaveBeenCalledWith(123, { url: 'https://bad.com' });
          expect(chrome.storage.sync.set).toHaveBeenCalledWith({ blockedCount: 11 });
      });

      it('does not block non-matching site', () => {
        const site = { host: 'bad.com', mode: 'block', enabled: true } as CustomSite;
        logic.setState(true, [site]);

        logic.handleHistoryStateUpdated({
            frameId: 0,
            url: 'https://good.com',
            tabId: 123
        } as any);

        expect(chrome.tabs.update).not.toHaveBeenCalled();
      });
  });

  describe('initializeState', () => {
      it('loads state from storage', () => {
        const site = { host: 'stored.com', mode: 'block' };
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({
            enabled: false,
            customSites: [site]
        }));

        logic.initializeState();

        const state = logic.getState();
        expect(state.blockingEnabled).toBe(false);
        expect(state.cachedCustomSites[0].host).toBe('stored.com');
      });
  });

  describe('updateDynamicRulesForSites', () => {
      it('updates rules via chrome api', () => {
          const sites = [
              { host: 'a.com', mode: 'block' } as CustomSite,
              { host: 'b.com', mode: 'disable_js' } as CustomSite // should be ignored by updateDynamicRulesForSites logic as it filters mode==block?
          ];
          // Check implementation: yes, filters mode==block.

          logic.updateDynamicRulesForSites(sites);

          expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith(
              expect.objectContaining({
                  addRules: expect.arrayContaining([
                      expect.objectContaining({ condition: expect.objectContaining({ requestDomains: ['a.com'] }) })
                  ]),
                  removeRuleIds: expect.any(Array)
              }),
              expect.any(Function)
          );
      });

      it('logs error if runtime.lastError', () => {
          const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
          // @ts-ignore
          chrome.declarativeNetRequest.updateDynamicRules.mockImplementation((opts, cb) => {
              // @ts-ignore
              chrome.runtime.lastError = { message: 'oops' };
              if (cb) cb();
              // @ts-ignore
              chrome.runtime.lastError = undefined;
          });

          logic.updateDynamicRulesForSites([{ host: 'a.com', mode: 'block' } as CustomSite]);
          expect(consoleSpy).toHaveBeenCalled();
      });
  });

  describe('normalizeExpiresAt', () => {
      it('returns null for non-numbers', () => {
          expect(logic.normalizeExpiresAt('foo')).toBeNull();
      });
  });
});
