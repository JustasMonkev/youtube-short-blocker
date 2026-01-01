import { useCallback, useEffect, useState } from 'react';

export function useExtensionState() {
  const [enabled, setEnabled] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(['enabled', 'blockedCount', 'darkMode'], (result) => {
      setEnabled(result.enabled !== false);
      setBlockedCount(typeof result.blockedCount === 'number' ? result.blockedCount : 0);
      const isDark = result.darkMode === true;
      setDarkMode(isDark);
      // Apply dark mode to document
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
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

  const toggleDarkMode = useCallback((enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    chrome.storage.sync.set({ darkMode: enabled });
  }, []);

  return { enabled, blockedCount, darkMode, toggleEnabled, resetBlockedCount, toggleDarkMode };
}
