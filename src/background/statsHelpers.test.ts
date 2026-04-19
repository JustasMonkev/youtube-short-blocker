import { describe, expect, it } from 'vitest';
import { incrementBlockedCountByDay, normalizeBlockedCountByDay, toDateKey, trimBlockedCountByDay } from './statsHelpers';

describe('blocked count by day helpers', () => {
  it('creates date key in local YYYY-MM-DD format', () => {
    const key = toDateKey(new Date('2026-04-16T14:23:00Z').getTime());
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normalizes stored counts and drops invalid rows', () => {
    expect(
      normalizeBlockedCountByDay({
        '2026-01-01': 3,
        'bad-date': 10,
        '2026-01-02': 0,
        '2026-01-03': '4'
      } as unknown as Record<string, unknown>)
    ).toEqual({
      '2026-01-01': 3,
      '2026-01-02': 0,
      '2026-01-03': 4
    });
  });

  it('increments today count and keeps counters numeric', () => {
    const start = normalizeBlockedCountByDay({
      '2026-01-01': 4
    });
    expect(incrementBlockedCountByDay(start, new Date('2026-01-01T10:00:00Z').getTime())).toEqual({
      '2026-01-01': 5
    });
  });

  it('trims counts older than retention window', () => {
    const now = new Date('2026-04-16T10:00:00Z').getTime();
    const tooOld = new Date('2026-01-01T00:00:00Z').toISOString().slice(0, 10);
    const recent = new Date('2026-04-15T00:00:00Z').toISOString().slice(0, 10);

    expect(
      trimBlockedCountByDay(
        {
          [tooOld]: 2,
          [recent]: 5
        },
        now
      )
    ).toEqual({
      [recent]: 5
    });
  });
});
