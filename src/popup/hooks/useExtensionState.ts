import { useCallback, useEffect, useState } from 'react';

export function useExtensionState() {
  const [enabled, setEnabled] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    chrome.storage.sync.get(['enabled', 'blockedCount'], (result) => {
      setEnabled(result.enabled !== false);
      setBlockedCount(result.blockedCount || 0);
    });
  }, []);

  const toggleEnabled = useCallback((checked: boolean) => {
    setEnabled(checked);
    chrome.storage.sync.set({ enabled: checked });
  }, []);

  const resetBlockedCount = useCallback(() => {
    setBlockedCount(0);
    chrome.storage.sync.set({ blockedCount: 0 });
  }, []);

  return { enabled, blockedCount, toggleEnabled, resetBlockedCount };
}
