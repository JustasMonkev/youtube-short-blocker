import { useCallback, useEffect, useState } from 'react';
import { BlockingDiagnostics, ScheduleWindow, ShortActivitySummary, StorageChanges } from '../../types';
import { getPopupBlockingState, isInCooldown } from '../utils/popupStateHelpers';

const DEFAULT_SUMMARY: ShortActivitySummary = {
  blockedTotal: 0,
  lastBlockedAt: null,
  whitelistSkips: 0,
  cooldownSkips: 0,
  scheduleSkips: 0
};

const DEFAULT_DIAGNOSTICS: BlockingDiagnostics = {
  lastCheckedAt: null,
  lastCheckedUrl: null,
  lastDecision: 'allowed',
  lastReason: 'disabled',
  activeRules: 0
};

interface PermissionHealth {
  checked: boolean;
  permissionsApiAvailable: boolean;
  missingPermissions: string[];
  missingOrigins: string[];
  error: string | null;
}

const DEFAULT_PERMISSION_HEALTH: PermissionHealth = {
  checked: false,
  permissionsApiAvailable: true,
  missingPermissions: [],
  missingOrigins: [],
  error: null
};

interface StorageHealth {
  checked: boolean;
  healthy: boolean;
  error: string | null;
}

const DEFAULT_STORAGE_HEALTH: StorageHealth = {
  checked: false,
  healthy: true,
  error: null
};

const REQUIRED_PERMISSIONS: chrome.runtime.ManifestPermission[] = [
  'declarativeNetRequest',
  'declarativeNetRequestWithHostAccess',
  'alarms',
  'tabs',
  'storage',
  'webNavigation',
  'contentSettings'
];

export function useExtensionState() {
  const [enabled, setEnabled] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  const [blockedCountByDay, setBlockedCountByDay] = useState<Record<string, number>>({});
  const [darkMode, setDarkMode] = useState(false);
  const [globalCooldownUntil, setGlobalCooldownUntil] = useState<number | null>(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [scheduleWindow, setScheduleWindow] = useState<ScheduleWindow | null>(null);
  const [shortActivitySummary, setShortActivitySummary] = useState<ShortActivitySummary>({ ...DEFAULT_SUMMARY });
  const [blockingDiagnostics, setBlockingDiagnostics] = useState<BlockingDiagnostics>({ ...DEFAULT_DIAGNOSTICS });
  const [permissionHealth, setPermissionHealth] = useState<PermissionHealth>({ ...DEFAULT_PERMISSION_HEALTH });
  const [storageHealth, setStorageHealth] = useState<StorageHealth>({ ...DEFAULT_STORAGE_HEALTH });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    chrome.storage.sync.get(
      [
        'enabled',
        'blockedCount',
        'blockedCountByDay',
        'darkMode',
        'globalCooldownUntil',
        'emergencyMode',
        'scheduleWindow',
        'shortActivitySummary',
        'blockingDiagnostics'
      ],
      (result) => {
        setEnabled(result.enabled !== false);
        setBlockedCount(typeof result.blockedCount === 'number' ? result.blockedCount : 0);
        setBlockedCountByDay(asBlockedCountByDay(result.blockedCountByDay) || {});
        const isDark = result.darkMode === true;
        setDarkMode(isDark);

        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        setGlobalCooldownUntil(
          typeof result.globalCooldownUntil === 'number' && Number.isFinite(result.globalCooldownUntil)
            ? result.globalCooldownUntil
            : null
        );
        setEmergencyMode(result.emergencyMode === true);
        setScheduleWindow(
          isValidScheduleWindow(result.scheduleWindow) ? result.scheduleWindow : null
        );
        setShortActivitySummary(
          isValidSummary(result.shortActivitySummary) ? result.shortActivitySummary : { ...DEFAULT_SUMMARY }
        );
        setBlockingDiagnostics(
          isValidDiagnostics(result.blockingDiagnostics)
            ? result.blockingDiagnostics
            : { ...DEFAULT_DIAGNOSTICS }
        );
      }
    );

    refreshHealth();
  }, []);

  useEffect(() => {
    const nowTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(nowTimer);
  }, []);

  useEffect(() => {
    const handleChange = (changes: StorageChanges, areaName: string) => {
      if (areaName !== 'sync') {
        return;
      }

      if (changes.enabled) {
        setEnabled(changes.enabled.newValue !== false);
      }

      if (changes.blockedCount) {
        setBlockedCount(typeof changes.blockedCount.newValue === 'number' ? changes.blockedCount.newValue : 0);
      }

      if (changes.blockedCountByDay) {
        setBlockedCountByDay(asBlockedCountByDay(changes.blockedCountByDay.newValue) || {});
      }

      if (changes.darkMode) {
        const isDark = changes.darkMode.newValue === true;
        setDarkMode(isDark);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      if (changes.globalCooldownUntil) {
        setGlobalCooldownUntil(
          typeof changes.globalCooldownUntil.newValue === 'number' && Number.isFinite(changes.globalCooldownUntil.newValue)
            ? changes.globalCooldownUntil.newValue
            : null
        );
      }

      if (changes.emergencyMode) {
        setEmergencyMode(changes.emergencyMode.newValue === true);
      }

      if (changes.scheduleWindow) {
        setScheduleWindow(
          isValidScheduleWindow(changes.scheduleWindow.newValue) ? changes.scheduleWindow.newValue : null
        );
      }

      if (changes.shortActivitySummary) {
        setShortActivitySummary(
          isValidSummary(changes.shortActivitySummary.newValue)
            ? (changes.shortActivitySummary.newValue as ShortActivitySummary)
            : { ...DEFAULT_SUMMARY }
        );
      }

      if (changes.blockingDiagnostics) {
        setBlockingDiagnostics(
          isValidDiagnostics(changes.blockingDiagnostics.newValue)
            ? (changes.blockingDiagnostics.newValue as BlockingDiagnostics)
            : { ...DEFAULT_DIAGNOSTICS }
        );
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  const refreshHealth = useCallback(() => {
    const storageResult: StorageHealth = { ...DEFAULT_STORAGE_HEALTH, checked: true };
    const permissionResult: PermissionHealth = { ...DEFAULT_PERMISSION_HEALTH, checked: true };

    try {
      chrome.storage.sync.get(['enabled'], () => {
        if (chrome.runtime.lastError) {
          storageResult.healthy = false;
          storageResult.error = chrome.runtime.lastError.message || 'Storage API error';
        }
        setStorageHealth(storageResult);
      });
    } catch (error) {
      storageResult.healthy = false;
      storageResult.error = String(error);
      setStorageHealth(storageResult);
    }

    if (!chrome.permissions || !chrome.permissions.getAll) {
      permissionResult.permissionsApiAvailable = false;
      permissionResult.checked = true;
      permissionResult.error = 'Permissions API not available';
      setPermissionHealth(permissionResult);
      return;
    }

    chrome.permissions.getAll((permissions) => {
      const available = permissions || {};
      permissionResult.missingPermissions = REQUIRED_PERMISSIONS.filter(
        (permission) => !available.permissions?.includes(permission)
      );
      permissionResult.missingOrigins = ['<all_urls>'].filter((origin) => !(available.origins || []).includes(origin));
      setPermissionHealth(permissionResult);
    });
  }, []);

  const toggleEnabled = useCallback((checked: boolean) => {
    setEnabled(checked);
    chrome.storage.sync.set({ enabled: checked });
  }, []);

  const setCooldown = useCallback((minutes: number) => {
    const parsed = Number.isFinite(minutes) ? minutes : 0;
    const nextValue = parsed > 0 ? Date.now() + parsed * 60_000 : null;
    setGlobalCooldownUntil(nextValue);
    chrome.storage.sync.set({ globalCooldownUntil: nextValue });
  }, []);

  const clearCooldown = useCallback(() => {
    setGlobalCooldownUntil(null);
    chrome.storage.sync.set({ globalCooldownUntil: null });
  }, []);

  const resetBlockedCount = useCallback(() => {
    setBlockedCount(0);
    chrome.storage.sync.set({ blockedCount: 0 });
  }, []);

  const toggleDarkMode = useCallback((enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    chrome.storage.sync.set({ darkMode: enabled });
  }, []);

  const toggleEmergencyMode = useCallback((checked: boolean) => {
    setEmergencyMode(checked);
    chrome.storage.sync.set({ emergencyMode: checked });
  }, []);

  const updateScheduleWindow = useCallback((window: ScheduleWindow | null) => {
    const nextValue = isValidScheduleWindow(window) ? window : null;
    setScheduleWindow(nextValue);
    chrome.storage.sync.set({ scheduleWindow: nextValue });
  }, []);

  const blockingState = getPopupBlockingState({
    enabled,
    emergencyMode,
    globalCooldownUntil,
    scheduleWindow,
    now
  });

  return {
    now,
    enabled,
    blockedCount,
    blockedCountByDay,
    darkMode,
    globalCooldownUntil,
    emergencyMode,
    scheduleWindow,
    shortActivitySummary,
    blockingDiagnostics,
    permissionHealth,
    storageHealth,
    blockingState,
    isInCooldown: isInCooldown(now, globalCooldownUntil),
    toggleEnabled,
    resetBlockedCount,
    toggleDarkMode,
    setCooldown,
    clearCooldown,
    toggleEmergencyMode,
    updateScheduleWindow,
    refreshHealth
  };
}

function isValidScheduleWindow(value: unknown): value is ScheduleWindow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ScheduleWindow>;
  if (typeof candidate.startMinute !== 'number' || typeof candidate.endMinute !== 'number') {
    return false;
  }

  return (
    Number.isInteger(candidate.startMinute) &&
    candidate.startMinute >= 0 &&
    candidate.startMinute < 1440 &&
    Number.isInteger(candidate.endMinute) &&
    candidate.endMinute >= 0 &&
    candidate.endMinute < 1440
  );
}

function asBlockedCountByDay(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const rows = value as Record<string, unknown>;
  const safeRows: Record<string, number> = {};

  Object.entries(rows).forEach(([date, count]) => {
    if (typeof count === 'number' && Number.isFinite(count)) {
      safeRows[date] = count;
    }
  });

  return safeRows;
}

function isValidSummary(value: unknown): value is ShortActivitySummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const summary = value as Partial<ShortActivitySummary>;
  return (
    typeof summary.blockedTotal === 'number' &&
    Number.isInteger(summary.blockedTotal) &&
    summary.blockedTotal >= 0 &&
    (summary.lastBlockedAt === null || (typeof summary.lastBlockedAt === 'number' && Number.isFinite(summary.lastBlockedAt))) &&
    typeof summary.whitelistSkips === 'number' &&
    Number.isInteger(summary.whitelistSkips) &&
    summary.whitelistSkips >= 0 &&
    typeof summary.cooldownSkips === 'number' &&
    Number.isInteger(summary.cooldownSkips) &&
    summary.cooldownSkips >= 0 &&
    typeof summary.scheduleSkips === 'number' &&
    Number.isInteger(summary.scheduleSkips) &&
    summary.scheduleSkips >= 0
  );
}

function isValidDiagnostics(value: unknown): value is BlockingDiagnostics {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const diagnostics = value as Partial<BlockingDiagnostics>;
  return (
    diagnostics.lastCheckedAt === null ||
    (typeof diagnostics.lastCheckedAt === 'number' && Number.isFinite(diagnostics.lastCheckedAt))
  &&
    (diagnostics.lastCheckedUrl === null || typeof diagnostics.lastCheckedUrl === 'string') &&
    (diagnostics.lastDecision === 'allowed' || diagnostics.lastDecision === 'blocked' || diagnostics.lastDecision === 'skipped') &&
    (diagnostics.lastReason === 'disabled' ||
      diagnostics.lastReason === 'cooldown' ||
      diagnostics.lastReason === 'scheduleWindow' ||
      diagnostics.lastReason === 'whitelisted' ||
      diagnostics.lastReason === 'ruleBlock' ||
      diagnostics.lastReason === 'error') &&
    typeof diagnostics.activeRules === 'number' &&
    Number.isFinite(diagnostics.activeRules) &&
    diagnostics.activeRules >= 0
  );
}
