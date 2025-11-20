export interface CustomSite {
  id: string;
  host: string;
  path: string;
  label: string;
  mode: 'block' | 'disable_js';
  enabled: boolean;
  expiresAt?: number | null;
}

export interface StorageData {
  enabled: boolean;
  blockedCount: number;
  customSites: CustomSite[];
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
}
