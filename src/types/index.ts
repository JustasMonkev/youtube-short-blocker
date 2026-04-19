export interface CustomSite {
  mode: CustomSiteMode;
  scope?: SiteScope;
  isProtected?: boolean;
  id: string;
  host: string;
  path: string;
  label: string;
  enabled: boolean;
  expiresAt?: number | null;
}

export type SiteScope = 'all' | 'home' | 'watch' | 'search';

export type CustomSiteMode = 'block' | 'disable_js' | 'whitelist';

export interface ScheduleWindow {
  startMinute: number;
  endMinute: number;
}

export interface ShortActivitySummary {
  blockedTotal: number;
  lastBlockedAt: number | null;
  whitelistSkips: number;
  cooldownSkips: number;
  scheduleSkips: number;
}

export interface BlockingDiagnostics {
  lastCheckedAt: number | null;
  lastCheckedUrl: string | null;
  lastDecision: 'blocked' | 'allowed' | 'skipped';
  lastReason: 'disabled' | 'cooldown' | 'scheduleWindow' | 'whitelisted' | 'ruleBlock' | 'error';
  activeRules: number;
}

export interface StorageData {
  enabled: boolean;
  blockedCount: number;
  customSites: CustomSite[];
  blockedCountByDay?: Record<string, number>;
  darkMode?: boolean;
  globalCooldownUntil?: number | null;
  emergencyMode?: boolean;
  scheduleWindow?: ScheduleWindow | null;
  shortActivitySummary?: ShortActivitySummary;
  blockingDiagnostics?: BlockingDiagnostics;
}

export interface ParsedHost {
  host: string;
  path: string;
  label: string;
}

export interface StorageChange<T> {
  newValue?: T;
  oldValue?: T;
}

export interface StorageChanges {
  enabled?: StorageChange<boolean>;
  blockedCount?: StorageChange<number>;
  customSites?: StorageChange<CustomSite[]>;
  blockedCountByDay?: StorageChange<Record<string, number>>;
  darkMode?: StorageChange<boolean>;
  globalCooldownUntil?: StorageChange<number | null>;
  emergencyMode?: StorageChange<boolean>;
  scheduleWindow?: StorageChange<ScheduleWindow | null>;
  shortActivitySummary?: StorageChange<ShortActivitySummary>;
  blockingDiagnostics?: StorageChange<BlockingDiagnostics>;
}
