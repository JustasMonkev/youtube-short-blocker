export type BlockedCountByDay = Record<string, number>;

const MAX_DAYS_RETENTION = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateKey(value: unknown): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return KEY_REGEX.test(trimmed) ? trimmed : null;
}

export function toDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return toDateKey(Date.now());
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeBlockedCountByDay(value: unknown): BlockedCountByDay {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const safe: BlockedCountByDay = {};
  Object.entries(value as Record<string, unknown>).forEach(([dateKey, count]) => {
    if (!normalizeDateKey(dateKey)) {
      return;
    }

    const parsed = Number(count);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
      safe[dateKey] = parsed;
    }
  });

  return safe;
}

export function incrementBlockedCountByDay(
  blockedCountByDay: BlockedCountByDay | undefined,
  timestamp: number
): BlockedCountByDay {
  const todayKey = toDateKey(timestamp);
  const next = normalizeBlockedCountByDay(blockedCountByDay);
  const previous = Number.isFinite(next[todayKey]) && next[todayKey] >= 0 ? next[todayKey] : 0;
  next[todayKey] = Math.trunc(previous) + 1;
  return trimBlockedCountByDay(next, timestamp);
}

export function trimBlockedCountByDay(blockedCountByDay: BlockedCountByDay, now: number = Date.now()): BlockedCountByDay {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const cutoff = safeNow - MAX_DAYS_RETENTION * MS_PER_DAY;
  const cutoffDate = new Date(cutoff);
  const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(
    cutoffDate.getDate()
  ).padStart(2, '0')}`;

  const safe = normalizeBlockedCountByDay(blockedCountByDay);
  Object.keys(safe).forEach((dateKey) => {
    if (dateKey < cutoffKey) {
      delete safe[dateKey];
    }
  });
  return safe;
}
