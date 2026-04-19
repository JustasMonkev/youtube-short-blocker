import { describe, expect, it, vi } from 'vitest';
import { openOrFocusSettingsTab } from './openSettingsTab';

describe('openOrFocusSettingsTab', () => {
  it('focuses an existing settings tab before creating a new one', () => {
    const focusWindow = vi.fn((_windowId: number, _info: { focused: boolean }, callback: () => void) =>
      callback()
    );
    const activateTab = vi.fn((_tabId: number, _info: { active: boolean }, callback: () => void) => callback());
    const createTab = vi.fn();
    const getLastError = vi.fn(() => null);
    const queryTabs = vi.fn((callback) =>
      callback([
        { id: 3, windowId: 5, url: 'chrome-extension://id/settings.html' }
      ])
    );

    openOrFocusSettingsTab({
      settingsUrl: 'chrome-extension://id/settings.html',
      queryTabs,
      focusWindow,
      activateTab,
      createTab,
      getLastError
    });

    expect(queryTabs).toHaveBeenCalledTimes(1);
    expect(focusWindow).toHaveBeenCalledWith(5, { focused: true }, expect.any(Function));
    expect(activateTab).toHaveBeenCalledWith(3, { active: true }, expect.any(Function));
    expect(createTab).not.toHaveBeenCalled();
  });

  it('creates a new settings tab when no existing tab matches', () => {
    const focusWindow = vi.fn();
    const activateTab = vi.fn();
    const createTab = vi.fn();
    const queryTabs = vi.fn((callback) =>
      callback([{ id: 3, windowId: 5, url: 'https://example.com/dashboard.html' }])
    );

    openOrFocusSettingsTab({
      settingsUrl: 'chrome-extension://id/settings.html',
      queryTabs,
      focusWindow,
      activateTab,
      createTab
    });

    expect(createTab).toHaveBeenCalledWith({ url: 'chrome-extension://id/settings.html' });
    expect(focusWindow).not.toHaveBeenCalled();
    expect(activateTab).not.toHaveBeenCalled();
  });

  it('falls back to creating a new tab when focusing existing window fails', () => {
    const focusWindow = vi.fn((_windowId: number, _info: { focused: boolean }, callback: () => void) => callback());
    const activateTab = vi.fn();
    const createTab = vi.fn();
    const getLastError = vi.fn().mockReturnValueOnce(new Error('Cannot focus window'));
    const queryTabs = vi.fn((callback) =>
      callback([{ id: 3, windowId: 5, url: 'chrome-extension://id/settings.html' }])
    );

    openOrFocusSettingsTab({
      settingsUrl: 'chrome-extension://id/settings.html',
      queryTabs,
      focusWindow,
      activateTab,
      createTab,
      getLastError
    });

    expect(createTab).toHaveBeenCalledWith({ url: 'chrome-extension://id/settings.html' });
    expect(activateTab).not.toHaveBeenCalled();
  });

  it('falls back to creating a new tab when activating existing tab fails', () => {
    const focusWindow = vi.fn((_windowId: number, _info: { focused: boolean }, callback: () => void) => callback());
    const activateTab = vi.fn((_tabId: number, _info: { active: boolean }, callback: () => void) => callback());
    const createTab = vi.fn();
    const getLastError = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(new Error('Cannot activate tab'));
    const queryTabs = vi.fn((callback) =>
      callback([{ id: 3, windowId: 5, url: 'chrome-extension://id/settings.html' }])
    );

    openOrFocusSettingsTab({
      settingsUrl: 'chrome-extension://id/settings.html',
      queryTabs,
      focusWindow,
      activateTab,
      createTab,
      getLastError
    });

    expect(focusWindow).toHaveBeenCalledTimes(1);
    expect(activateTab).toHaveBeenCalledTimes(1);
    expect(createTab).toHaveBeenCalledWith({ url: 'chrome-extension://id/settings.html' });
  });
});
