import { describe, expect, it } from 'vitest';
import {
  getPopupBlockingState,
  isInCooldown,
  isWithinScheduleWindow,
  minuteToTimeString,
  summarizeBlockedByDay,
  timeStringToMinute
} from './popupStateHelpers';

describe('schedule helpers', () => {
  it('decodes and encodes minute windows', () => {
    expect(minuteToTimeString(0)).toBe('00:00');
    expect(minuteToTimeString(1439)).toBe('23:59');
    expect(timeStringToMinute('08:30')).toBe(510);
    expect(timeStringToMinute('24:00')).toBeNull();
  });

  it('reports cooldown status with strict end bound', () => {
    const now = 1_000;
    expect(isInCooldown(now, null)).toBe(false);
    expect(isInCooldown(now, 500)).toBe(false);
    expect(isInCooldown(now, now + 1)).toBe(true);
    expect(isInCooldown(now, now)).toBe(false);
  });

  it('checks normal and overnight windows', () => {
    const morning = new Date(2026, 0, 1, 9, 10).getTime();
    const evening = new Date(2026, 0, 1, 20, 10).getTime();
    const overnightStart = 22 * 60;
    const overnightEnd = 2 * 60;

    expect(isWithinScheduleWindow(morning, { startMinute: 8 * 60, endMinute: 18 * 60 })).toBe(true);
    expect(isWithinScheduleWindow(evening, { startMinute: 8 * 60, endMinute: 18 * 60 })).toBe(false);
    expect(isWithinScheduleWindow(morning, { startMinute: overnightStart, endMinute: overnightEnd })).toBe(false);
    expect(isWithinScheduleWindow(
      new Date(2026, 0, 1, 23, 5).getTime(),
      { startMinute: overnightStart, endMinute: overnightEnd }
    )).toBe(true);
  });
});

describe('blocking state derivation', () => {
  it('marks active when all gates are clear', () => {
    expect(
      getPopupBlockingState({
        enabled: true,
        emergencyMode: false,
        globalCooldownUntil: null,
        scheduleWindow: null,
        now: 1_000_000
      }).isActive
    ).toBe(true);
  });

  it('reports blocked when emergency mode is active', () => {
    const state = getPopupBlockingState({
      enabled: true,
      emergencyMode: true,
      globalCooldownUntil: null,
      scheduleWindow: null,
      now: 1_000_000
    });

    expect(state.isActive).toBe(false);
    expect(state.reason).toBe('emergency');
  });
});

describe('blocked-by-day summary', () => {
  it('filters malformed data and returns last-day summary rows', () => {
    const result = summarizeBlockedByDay(
      {
        '2026-01-01': 3,
        'invalid-date': 10,
        '2026-01-02': 6
      },
      {
        now: new Date('2026-01-03T00:00:00'),
        maxDays: 7,
        locale: 'en-US'
      }
    );

    expect(result).toEqual([
      {
        date: '2026-01-01',
        dateKey: '2026-01-01',
        label: 'Jan 1',
        count: 3
      },
      {
        date: '2026-01-02',
        dateKey: '2026-01-02',
        label: 'Jan 2',
        count: 6
      }
    ]);
  });

  it('returns empty list for non-objects', () => {
    expect(summarizeBlockedByDay(null)).toEqual([]);
  });
});
