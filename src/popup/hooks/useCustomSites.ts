import { useCallback, useEffect, useState } from 'react';
import { CustomSite } from '../../types';
import { createCustomSite, parseHost, sanitizeSites } from '../utils/siteHelpers';

export function useCustomSites() {
  const [customSites, setCustomSites] = useState<CustomSite[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    chrome.storage.sync.get(['customSites'], (result) => {
      setCustomSites(sanitizeSites(result.customSites));
    });
  }, []);

  useEffect(() => {
    const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'sync' || !changes.customSites) {
        return;
      }
      setCustomSites(sanitizeSites(changes.customSites.newValue));
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const persistSites = useCallback((sites: CustomSite[]) => {
    setCustomSites(sites);
    chrome.storage.sync.set({ customSites: sites });
  }, []);

  const addSite = useCallback(() => {
    setError('');
    const rawUrl = customUrl.trim();
    if (!rawUrl) {
      setError('Enter a URL to block.');
      return;
    }

    const parsed = parseHost(rawUrl);
    if (!parsed) {
      setError('Enter a valid website address.');
      return;
    }

    const exists = customSites.some(
      (site) => site.host === parsed.host && (site.path || '') === (parsed.path || '')
    );
    if (exists) {
      setError('That site is already on your list.');
      return;
    }

    const newSite = applyDurationToSite(createCustomSite(parsed), durationMinutes);

    const nextSites = [...customSites, newSite].sort((a, b) =>
      (a.label || a.host).localeCompare(b.label || b.host)
    );

    persistSites(nextSites);
    setCustomUrl('');
    setDurationMinutes(0);
  }, [customSites, customUrl, persistSites, durationMinutes]);

  const removeSite = useCallback(
    (id: string) => {
      const nextSites = customSites.filter((site) => site.id !== id);
      persistSites(nextSites);
    },
    [customSites, persistSites]
  );

  const toggleSite = useCallback(
    (id: string, checked: boolean) => {
      const nextSites = customSites.map((site) =>
        site.id === id
          ? {
              ...site,
              enabled: checked,
              expiresAt: checked && site.expiresAt && site.expiresAt > Date.now() ? site.expiresAt : null
            }
          : site
      );
      persistSites(nextSites);
    },
    [customSites, persistSites]
  );

  const updateCustomUrl = useCallback((value: string) => {
    setCustomUrl(value);
  }, []);

  const updateSiteDuration = useCallback(
    (id: string, minutes: number) => {
      const now = Date.now();
      const expiresAt = minutes > 0 ? now + minutes * 60_000 : null;

      const nextSites = customSites.map((site) =>
        site.id === id
          ? {
              ...site,
              enabled: true,
              expiresAt
            }
          : site
      );

      persistSites(nextSites);
    },
    [customSites, persistSites]
  );

  return {
    customSites,
    customUrl,
    error,
    durationMinutes,
    now,
    updateCustomUrl,
    addSite,
    removeSite,
    toggleSite,
    setDurationMinutes,
    updateSiteDuration
  };
}

function applyDurationToSite(site: CustomSite, minutes: number): CustomSite {
  if (!minutes) {
    return site;
  }
  return {
    ...site,
    expiresAt: Date.now() + minutes * 60_000
  };
}
