import { renderHook, act, waitFor } from '@testing-library/react';
import { useCustomSites } from './useCustomSites';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('useCustomSites', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initializes with stored sites', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({
            customSites: [{ host: 'example.com' }]
        }));

        const { result } = renderHook(() => useCustomSites());

        await waitFor(() => {
            expect(result.current.customSites).toHaveLength(1);
            expect(result.current.customSites[0].host).toBe('example.com');
        });
    });

    it('listens to storage changes', async () => {
        const listeners: Record<string, Function> = {};
        // @ts-ignore
        chrome.storage.onChanged.addListener.mockImplementation((cb) => {
            listeners['change'] = cb;
        });

        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));

        const { result } = renderHook(() => useCustomSites());

        await waitFor(() => expect(result.current.customSites).toHaveLength(0));

        // Simulate external change
        act(() => {
            listeners['change']({
                customSites: { newValue: [{ host: 'new.com' }] }
            }, 'sync');
        });

        await waitFor(() => {
             expect(result.current.customSites).toHaveLength(1);
             expect(result.current.customSites[0].host).toBe('new.com');
        });
    });

    it('ignores non-sync or unrelated storage changes', async () => {
        const listeners: Record<string, Function> = {};
        // @ts-ignore
        chrome.storage.onChanged.addListener.mockImplementation((cb) => {
            listeners['change'] = cb;
        });
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));

        const { result } = renderHook(() => useCustomSites());
        await waitFor(() => expect(result.current.customSites).toHaveLength(0));

        act(() => {
            listeners['change']({
                customSites: { newValue: [{ host: 'local.com' }] }
            }, 'local'); // Wrong area
        });
        expect(result.current.customSites).toHaveLength(0);

        act(() => {
            listeners['change']({
                otherKey: { newValue: 'foo' }
            }, 'sync'); // Wrong key
        });
        expect(result.current.customSites).toHaveLength(0);
    });

    it('updates now timestamp periodically', () => {
        vi.useFakeTimers();
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));

        const { result } = renderHook(() => useCustomSites());
        const initialNow = result.current.now;

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.now).toBeGreaterThan(initialNow);
        vi.useRealTimers();
    });

    it('updates customUrl', () => {
         // @ts-ignore
         chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
         const { result } = renderHook(() => useCustomSites());

         act(() => {
             result.current.updateCustomUrl('test');
         });
         expect(result.current.customUrl).toBe('test');
    });

    it('adds a valid site', async () => {
         // @ts-ignore
         chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
         const { result } = renderHook(() => useCustomSites());

         act(() => {
             result.current.updateCustomUrl('example.com');
         });

         // Need separate act/render cycle for state to update?
         // renderHook returns a ref that updates. But closures might be stale if called immediately?
         // Actually, `result.current` is fresh after `act`.

         act(() => {
             result.current.addSite();
         });

         expect(result.current.error).toBe('');
         expect(result.current.customSites).toHaveLength(1);
         expect(result.current.customSites[0].host).toBe('example.com');
         expect(chrome.storage.sync.set).toHaveBeenCalled();
         expect(result.current.customUrl).toBe('');
    });

    it('adds a site with duration', async () => {
         // @ts-ignore
         chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
         const { result } = renderHook(() => useCustomSites());

         act(() => {
             result.current.updateCustomUrl('example.com');
             result.current.setDurationMinutes(10);
         });

         act(() => {
             result.current.addSite();
         });

         expect(result.current.customSites[0].expiresAt).toBeGreaterThan(Date.now());
    });

    it('validates empty url', () => {
         // @ts-ignore
         chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
         const { result } = renderHook(() => useCustomSites());

         act(() => {
             result.current.updateCustomUrl('   ');
         });

         act(() => {
             result.current.addSite();
         });

         expect(result.current.error).toBe('Enter a URL to block.');
         expect(result.current.customSites).toHaveLength(0);
    });

    it('validates invalid url', () => {
         // @ts-ignore
         chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
         const { result } = renderHook(() => useCustomSites());

         act(() => {
             result.current.updateCustomUrl('http://'); // Invalid host
         });

         act(() => {
             result.current.addSite();
         });

         expect(result.current.error).toBe('Enter a valid website address.');
    });

    it('sorts sites alphabetically', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
        const { result } = renderHook(() => useCustomSites());

        act(() => {
            result.current.updateCustomUrl('z.com');
        });
        act(() => {
            result.current.addSite();
        });

        act(() => {
            result.current.updateCustomUrl('a.com');
        });
        act(() => {
            result.current.addSite();
        });

        expect(result.current.customSites).toHaveLength(2);
        expect(result.current.customSites[0].host).toBe('a.com');
        expect(result.current.customSites[1].host).toBe('z.com');
    });

    it('prevents duplicates', async () => {
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));
        const { result } = renderHook(() => useCustomSites());

        act(() => {
            result.current.updateCustomUrl('example.com');
        });
        act(() => {
            result.current.addSite();
        });

        act(() => {
            result.current.updateCustomUrl('example.com');
        });
        act(() => {
            result.current.addSite();
        });

        expect(result.current.error).toBe('That site is already on your list.');
        expect(result.current.customSites).toHaveLength(1);
    });

    it('removes a site', async () => {
        const site = { id: '1', host: 'example.com' };
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [site] }));
        const { result } = renderHook(() => useCustomSites());
        await waitFor(() => expect(result.current.customSites).toHaveLength(1));

        act(() => {
            result.current.removeSite('1');
        });

        expect(result.current.customSites).toHaveLength(0);
        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ customSites: [] });
    });

    it('toggles site enabled state', async () => {
        const site = { id: '1', host: 'example.com', enabled: false, expiresAt: 12345 };
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [site] }));
        const { result } = renderHook(() => useCustomSites());
        await waitFor(() => expect(result.current.customSites).toHaveLength(1));

        act(() => {
            result.current.toggleSite('1', true);
        });

        expect(result.current.customSites[0].enabled).toBe(true);
        // Should keep expiry if enabling and future expiry... wait, logic says:
        // checked && site.expiresAt && site.expiresAt > Date.now() ? site.expiresAt : null
        // 12345 is past
        expect(result.current.customSites[0].expiresAt).toBeNull();

        act(() => {
            result.current.toggleSite('1', false);
        });
        expect(result.current.customSites[0].enabled).toBe(false);
    });

    it('toggles site enabled keeps future expiry', async () => {
        const future = Date.now() + 100000;
        const site = { id: '1', host: 'example.com', enabled: false, expiresAt: future };
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [site] }));
        const { result } = renderHook(() => useCustomSites());
        await waitFor(() => expect(result.current.customSites).toHaveLength(1));

        act(() => {
            result.current.toggleSite('1', true);
        });

        expect(result.current.customSites[0].expiresAt).toBe(future);
    });

    it('updates site duration', async () => {
        const site = { id: '1', host: 'example.com', enabled: false };
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [site] }));
        const { result } = renderHook(() => useCustomSites());
        await waitFor(() => expect(result.current.customSites).toHaveLength(1));

        act(() => {
            result.current.updateSiteDuration('1', 10);
        });

        expect(result.current.customSites[0].enabled).toBe(true);
        expect(result.current.customSites[0].expiresAt).toBeGreaterThan(Date.now());

        act(() => {
            result.current.updateSiteDuration('1', 0);
        });
        expect(result.current.customSites[0].expiresAt).toBeNull();
    });

    it('cleans up listeners on unmount', () => {
        const removeListener = vi.fn();
        // @ts-ignore
        chrome.storage.onChanged.addListener.mockImplementation(() => {});
        // @ts-ignore
        chrome.storage.onChanged.removeListener.mockImplementation(removeListener);
        // @ts-ignore
        chrome.storage.sync.get.mockImplementation((keys, cb) => cb({ customSites: [] }));

        const { unmount } = renderHook(() => useCustomSites());
        unmount();

        expect(removeListener).toHaveBeenCalled();
    });
});
