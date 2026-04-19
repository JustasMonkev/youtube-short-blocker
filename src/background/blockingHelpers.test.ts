import { describe, expect, it } from 'vitest';
import {
  isInCooldown,
  isUrlInScope,
  isWithinScheduleWindow,
  isBlockedBySite,
  isWhitelistedUrl,
  matchesSite
} from './blockingHelpers';
import { CustomSite } from '../types';

function asNow(hours: number, minutes: number): number {
  return new Date(2026, 0, 1, hours, minutes, 0, 0).getTime();
}

describe('Cooldown and schedule helpers', () => {
  it('detects active global cooldown windows', () => {
    expect(isInCooldown(asNow(12, 0), asNow(13, 0))).toBe(true);
    expect(isInCooldown(asNow(13, 0), asNow(12, 0))).toBe(false);
  });

  it('treats invalid cooldown values as inactive', () => {
    expect(isInCooldown(asNow(12, 0), null)).toBe(false);
    expect(isInCooldown(asNow(12, 0), Number.NaN)).toBe(false);
  });

  it('honors schedule windows including midnight wrap', () => {
    const start = 23 * 60;
    const end = 1 * 60;

    expect(isWithinScheduleWindow(asNow(23, 30), { startMinute: start, endMinute: end })).toBe(true);
    expect(isWithinScheduleWindow(asNow(2, 0), { startMinute: start, endMinute: end })).toBe(false);
  });

  it('returns true for equal start/end schedule bounds', () => {
    expect(isWithinScheduleWindow(asNow(10, 0), { startMinute: 600, endMinute: 600 })).toBe(true);
  });
});

describe('Scope helpers', () => {
  it('returns true for all-scope matching', () => {
    expect(isUrlInScope('https://youtube.com/watch?v=abc', 'all')).toBe(true);
  });

  it('respects home and watch scope rules', () => {
    expect(isUrlInScope('https://youtube.com/feed', 'home')).toBe(true);
    expect(isUrlInScope('https://youtube.com/watch?v=abc', 'watch')).toBe(true);
    expect(isUrlInScope('https://youtube.com/search?q=a', 'watch')).toBe(false);
  });
});

describe('Whitelist and blocking checks', () => {
  const sampleUrl = 'https://youtube.com/shorts/abc';
  const scopeSite: CustomSite = {
    id: 'scope-1',
    host: 'youtube.com',
    path: '/shorts',
    label: 'yt shorts',
    mode: 'block',
    enabled: true,
    scope: 'all'
  };

  const watchSite: CustomSite = {
    ...scopeSite,
    id: 'scope-2',
    path: '',
    scope: 'watch'
  };

  const whitelistSite: CustomSite = {
    id: 'scope-3',
    host: 'youtube.com',
    path: '/shorts',
    label: 'yt whitelist',
    mode: 'whitelist',
    enabled: true,
    scope: 'all'
  };

  it('blocks matching non-whitelist sites when active', () => {
    expect(isBlockedBySite(sampleUrl, scopeSite, asNow(12, 0))).toBe(true);
    expect(isBlockedBySite(sampleUrl, { ...scopeSite, enabled: false }, asNow(12, 0))).toBe(false);
    expect(isBlockedBySite('https://youtube.com/other', scopeSite, asNow(12, 0))).toBe(false);
  });

  it('does not block when whitelist mode is configured', () => {
    expect(isBlockedBySite(sampleUrl, whitelistSite, asNow(12, 0))).toBe(false);
  });

  it('recognizes whitelist matches independently', () => {
    expect(isWhitelistedUrl(sampleUrl, [whitelistSite], asNow(12, 0))).toBe(true);
    expect(isWhitelistedUrl('https://youtube.com/other', [whitelistSite], asNow(12, 0))).toBe(false);
  });

  it('uses site scope during match checks', () => {
    expect(matchesSite(sampleUrl, watchSite, asNow(12, 0))).toBe(false);
    expect(matchesSite('https://youtube.com/watch?v=abc', watchSite, asNow(12, 0))).toBe(true);
  });

  it('applies youtube scope on YouTube subdomains', () => {
    expect(
      isBlockedBySite(
        'https://m.youtube.com/watch?v=abc',
        {
          id: 'scope-4',
          host: 'youtube.com',
          path: '',
          label: 'yt watch',
          mode: 'block',
          enabled: true,
          scope: 'watch'
        },
        asNow(12, 0)
      )
    ).toBe(true);
  });

  it('ignores watch/search/home scope for non-youTube hosts', () => {
    expect(
      isBlockedBySite(
        'https://example.com/watch',
        {
          id: 'scope-5',
          host: 'example.com',
          path: '',
          label: 'example all',
          mode: 'block',
          enabled: true,
          scope: 'watch'
        },
        asNow(12, 0)
      )
    ).toBe(true);
  });
});
