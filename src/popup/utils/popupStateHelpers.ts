import { ScheduleWindow } from '../../types';

export type BlockingUiReason = 'active' | 'disabled' | 'emergency' | 'cooldown' | 'outsideSchedule';

export interface PopupBlockingState {
  isActive: boolean;
  isEnabled: boolean;
  isEmergency: boolean;
  isInCooldown: boolean;
  isWithinSchedule: boolean;
  cooldownMinutesLeft: number | null;
  reason: BlockingUiReason;
}

export interface BlockedDaySummaryRow {
  date: string;
  label: string;
  count: number;
  dateKey: string;
}

const MINUTES_IN_DAY = 1440;

export function isInCooldown(now: number, globalCooldownUntil?: number | null): boolean {
  if (!Number.isFinite(now)) {
    return false;
  }

  if (typeof globalCooldownUntil !== 'number' || !Number.isFinite(globalCooldownUntil)) {
    return false;
  }

  return globalCooldownUntil > now;
}

export function isWithinScheduleWindow(now: number, scheduleWindow: ScheduleWindow | null | undefined): boolean {
  if (!Number.isFinite(now)) {
    return false;
  }

  if (!scheduleWindow) {
    return true;
  }

  const startMinute = normalizeMinute(scheduleWindow.startMinute);
  const endMinute = normalizeMinute(scheduleWindow.endMinute);

  if (startMinute === null || endMinute === null) {
    return true;
  }

  if (startMinute === endMinute) {
    return true;
  }

  const currentMinute = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  if (startMinute < endMinute) {
    return currentMinute >= startMinute && currentMinute < endMinute;
  }

  return currentMinute >= startMinute || currentMinute < endMinute;
}

export function getPopupBlockingState(params: {
  enabled: boolean;
  emergencyMode: boolean;
  globalCooldownUntil: number | null;
  scheduleWindow: ScheduleWindow | null;
  now?: number;
}): PopupBlockingState {
  const now = Number.isFinite(params.now) ? (params.now as number) : Date.now();
  const isCoolingDown = isInCooldown(now, params.globalCooldownUntil);
  const withinSchedule = isWithinScheduleWindow(now, params.scheduleWindow);

  let reason: BlockingUiReason = 'active';
  if (!params.enabled) {
    reason = 'disabled';
  } else if (params.emergencyMode) {
    reason = 'emergency';
  } else if (isCoolingDown) {
    reason = 'cooldown';
  } else if (!withinSchedule) {
    reason = 'outsideSchedule';
  }

  return {
    isEnabled: params.enabled,
    isEmergency: params.emergencyMode,
    isInCooldown: isCoolingDown,
    isWithinSchedule: withinSchedule,
    cooldownMinutesLeft: isCoolingDown ? Math.max(0, Math.ceil((Number(params.globalCooldownUntil) - now) / 60000)) : null,
    isActive: reason === 'active',
    reason
  };
}

export function normalizeMinute(value: unknown): number | null {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  const minute = Number(value);
  if (!Number.isInteger(minute) || minute < 0 || minute >= MINUTES_IN_DAY) {
    return null;
  }

  return minute;
}

export function minuteToTimeString(minute: number): string {
  const normalized = normalizeMinute(minute);
  if (normalized === null) {
    return '00:00';
  }

  const hour = Math.floor(normalized / 60);
  const minuteOfHour = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`;
}

export function timeStringToMinute(value: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

export function summarizeBlockedByDay(
  value: unknown,
  options: { maxDays?: number; now?: Date; locale?: string } = {}
): BlockedDaySummaryRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const now = options.now || new Date();
  const locale = options.locale || 'en-US';
  const maxDays = options.maxDays || 14;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(todayStart);
  windowStart.setDate(windowStart.getDate() - (maxDays - 1));

  const rows: BlockedDaySummaryRow[] = [];

  for (const [rawDate, count] of Object.entries(value)) {
    const normalized = normalizeDateKey(rawDate);
    if (!normalized) {
      continue;
    }

    const date = parseDateKey(normalized);
    if (!date || Number.isNaN(date.getTime())) {
      continue;
    }

    if (date < windowStart) {
      continue;
    }

    const parsedCount = Number.isFinite(Number(count)) ? Number(count) : 0;
    const label = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    rows.push({
      date: rawDate,
      label,
      dateKey: normalized,
      count: parsedCount
    });
  }

  rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return rows;
}

function normalizeDateKey(value: string): string | null {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function parseDateKey(dateKey: string): Date | null {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}
