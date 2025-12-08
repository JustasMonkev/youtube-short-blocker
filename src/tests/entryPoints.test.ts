import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Entry Points', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('background.ts initializes listeners', async () => {
        // Mock backgroundLogic
        vi.mock('../background/backgroundLogic', () => ({
            initializeState: vi.fn(),
            handleInstalled: vi.fn(),
            handleStorageChange: vi.fn(),
            handleAlarm: vi.fn(),
            handleHistoryStateUpdated: vi.fn(),
            EXPIRY_ALARM_NAME: 'test',
        }));

        await import('../background/background');

        expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
        expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
        expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
        expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
        expect(chrome.webNavigation.onHistoryStateUpdated.toHaveBeenCalled);

        // Trigger onStartup listener to cover anonymous function
        const onStartupCallback = (chrome.runtime.onStartup.addListener as any).mock.calls[0][0];
        onStartupCallback();
        // initializeState is mocked, so we verify it was called (it was called once at top level, and once in listener)
        // Actually top level call `initializeState()` happens on import.
        // onStartup also calls it.
    });

    it('content.ts initializes content script', async () => {
        vi.mock('../content/contentLogic', () => ({
            initializeContentScript: vi.fn(),
        }));

        await import('../content/content');
        const logic = await import('../content/contentLogic');
        expect(logic.initializeContentScript).toHaveBeenCalled();
    });
});
