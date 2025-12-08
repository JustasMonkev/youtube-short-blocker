import { renderHook, act, waitFor } from '@testing-library/react';
import { useExtensionState } from './useExtensionState';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('useExtensionState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with default values if storage empty', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));

        const { result } = renderHook(() => useExtensionState());

        expect(chrome.storage.sync.get).toHaveBeenCalledWith(['enabled', 'blockedCount'], expect.any(Function));

        await waitFor(() => {
            expect(result.current.enabled).toBe(true);
            expect(result.current.blockedCount).toBe(0);
        });
    });

    it('initializes with stored values', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({
            enabled: false,
            blockedCount: 42
        }));

        const { result } = renderHook(() => useExtensionState());

        await waitFor(() => {
            expect(result.current.enabled).toBe(false);
            expect(result.current.blockedCount).toBe(42);
        });
    });

    it('toggles enabled', async () => {
        const { result } = renderHook(() => useExtensionState());

        act(() => {
            result.current.toggleEnabled(false);
        });

        expect(result.current.enabled).toBe(false);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: false });

        act(() => {
            result.current.toggleEnabled(true);
        });

        expect(result.current.enabled).toBe(true);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabled: true });
    });

    it('resets blocked count', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ blockedCount: 10 }));

        const { result } = renderHook(() => useExtensionState());
        await waitFor(() => expect(result.current.blockedCount).toBe(10));

        act(() => {
            result.current.resetBlockedCount();
        });

        expect(result.current.blockedCount).toBe(0);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ blockedCount: 0 });
    });
});
