import { describe, expect, test } from 'vitest';
import {
  SiteScope,
  ScheduleWindow
} from '../src/types';
import {
  isInCooldown,
  isWithinScheduleWindow,
  isUrlInScope,
  isBlockedBySite,
  isWhitelistedUrl
} from '../src/background/blockingHelpers';

import { CustomSite } from '../src/types';

describe('cooldown guard', () => {
  test('returns true only while cooldown window is active', () => {
    const now = Date.now();

    expect(isInCooldown(now, null)).toBe(false);
    expect(isInCooldown(now, now - 60_000)).toBe(false);
    expect(isInCooldown(now, now + 60_000)).toBe(true);
    expect(isInCooldown(now, now)).toBe(false);
  });
});

describe('schedule window', () => {
  test('allows when schedule is missing', () => {
    expect(isWithinScheduleWindow(Date.now(), null)).toBe(true);
  });

  test('supports normal day windows', () => {
    const schedule: ScheduleWindow = { startMinute: 8 * 60, endMinute: 18 * 60 };
    const morning = new Date(2026, 0, 2, 9, 30).getTime();
    const outside = new Date(2026, 0, 2, 7, 30).getTime();

    expect(isWithinScheduleWindow(morning, schedule)).toBe(true);
    expect(isWithinScheduleWindow(outside, schedule)).toBe(false);
  });

  test('supports overnight windows', () => {
    const schedule: ScheduleWindow = { startMinute: 22 * 60, endMinute: 6 * 60 };
    const evening = new Date(2026, 0, 2, 23, 10).getTime();
    const lateNight = new Date(2026, 0, 3, 2, 5).getTime();
    const midDay = new Date(2026, 0, 3, 12, 0).getTime();

    expect(isWithinScheduleWindow(evening, schedule)).toBe(true);
    expect(isWithinScheduleWindow(lateNight, schedule)).toBe(true);
    expect(isWithinScheduleWindow(midDay, schedule)).toBe(false);
  });
});

describe('scoped url matching', () => {
  test('matches all scope for all URLs', () => {
    expect(isUrlInScope('https://www.youtube.com/watch?v=abc', 'all')).toBe(true);
    expect(isUrlInScope('https://www.youtube.com/shorts/abc', undefined as SiteScope)).toBe(true);
  });

  test('matches youtube home/watch/search scopes', () => {
    expect(isUrlInScope('https://www.youtube.com/', 'home')).toBe(true);
    expect(isUrlInScope('https://www.youtube.com/feed/subscriptions', 'home')).toBe(true);
    expect(isUrlInScope('https://www.youtube.com/watch?v=abc', 'home')).toBe(false);

    expect(isUrlInScope('https://www.youtube.com/watch?v=abc', 'watch')).toBe(true);
    expect(isUrlInScope('https://www.youtube.com/shorts/abc', 'watch')).toBe(false);

    expect(isUrlInScope('https://www.youtube.com/results?search_query=fun', 'search')).toBe(true);
    expect(isUrlInScope('https://www.youtube.com/c/some/channel', 'search')).toBe(false);
  });

  test('returns false for invalid URLs', () => {
    expect(isUrlInScope('not-a-url', 'watch')).toBe(false);
  });
});

describe('site blocking decision', () => {
  test('blocks active non-expired matching sites', () => {
    const site: CustomSite = {
      id: '1',
      host: 'youtube.com',
      path: '/shorts',
      label: 'youtube shorts',
      mode: 'block' as const,
      enabled: true,
      scope: 'all',
      expiresAt: null
    };

    expect(isBlockedBySite('https://www.youtube.com/shorts/abc', site, Date.now())).toBe(true);
    expect(isBlockedBySite('https://www.youtube.com/watch?v=abc', site, Date.now())).toBe(false);
  });

  test('blocks youtube scoped sites when scope matches', () => {
    const site: CustomSite = {
      id: '2',
      host: 'youtube.com',
      path: '',
      label: 'youtube watch',
      mode: 'block' as const,
      enabled: true,
      scope: 'watch',
      expiresAt: null
    };

    expect(isBlockedBySite('https://www.youtube.com/watch?v=abc', site, Date.now())).toBe(true);
    expect(isBlockedBySite('https://www.youtube.com/shorts/abc', site, Date.now())).toBe(false);
  });

  test('skips disabled or expired sites and whitelist mode', () => {
    const blocked = {
      id: '3',
      host: 'x.com',
      path: '',
      label: 'disabled',
      mode: 'block' as const,
      enabled: false,
      scope: 'all' as const,
      expiresAt: null
    };
    const expired = {
      id: '4',
      host: 'x.com',
      path: '',
      label: 'expired',
      mode: 'block' as const,
      enabled: true,
      scope: 'all' as const,
      expiresAt: Date.now() - 1
    };
    const whitelist = {
      id: '5',
      host: 'x.com',
      path: '',
      label: 'allow',
      mode: 'whitelist' as const,
      enabled: true,
      scope: 'all' as const,
      expiresAt: null
    };

    expect(isBlockedBySite('https://x.com/feed', blocked, Date.now())).toBe(false);
    expect(isBlockedBySite('https://x.com/feed', expired, Date.now())).toBe(false);
    expect(isBlockedBySite('https://x.com/feed', whitelist, Date.now())).toBe(false);
  });
});

describe('whitelist matching', () => {
  test('allows URLs that match active whitelist entries', () => {
    const whitelist: CustomSite = {
      id: '7',
      host: 'youtube.com',
      path: '/watch',
      label: 'youtube watch allowlist',
      mode: 'whitelist',
      enabled: true,
      scope: 'watch',
      expiresAt: null
    };

    const blockedSite: CustomSite = {
      id: '8',
      host: 'youtube.com',
      path: '',
      label: 'youtube',
      mode: 'block',
      enabled: true,
      scope: 'all',
      expiresAt: null
    };

    expect(isWhitelistedUrl('https://www.youtube.com/watch?v=abc', [whitelist, blockedSite], Date.now())).toBe(true);
    expect(isWhitelistedUrl('https://www.youtube.com/shorts/abc', [whitelist, blockedSite], Date.now())).toBe(false);
  });

  test('excludes expired or disabled whitelist entries', () => {
    const whitelist: CustomSite = {
      id: '9',
      host: 'youtube.com',
      path: '/watch',
      label: 'youtube watch allowlist',
      mode: 'whitelist',
      enabled: true,
      scope: 'watch',
      expiresAt: Date.now() - 1
    };

    expect(isWhitelistedUrl('https://www.youtube.com/watch?v=abc', [whitelist], Date.now())).toBe(false);
  });
});
