import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('popup entry bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('./App');
    vi.doUnmock('./styles.css');
    vi.doUnmock('./utils/popupRuntime');
    vi.doUnmock('react-dom/client');
  });

  it('redirects popup.html tab visits to settings.html before rendering', async () => {
    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render }));
    const redirectPopupPageIfNeeded = vi.fn(() => true);

    vi.doMock('react-dom/client', () => ({
      default: { createRoot },
      createRoot
    }));
    vi.doMock('./App', () => ({ default: () => null }));
    vi.doMock('./styles.css', () => ({}));
    vi.doMock('./utils/popupRuntime', () => ({ redirectPopupPageIfNeeded }));

    const rootElement = { id: 'root' };
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => rootElement)
    });
    vi.stubGlobal('window', {
      location: {
        href: 'chrome-extension://abc/popup.html',
        pathname: '/popup.html',
        replace: vi.fn()
      }
    });

    await import('./index');

    expect(redirectPopupPageIfNeeded).toHaveBeenCalledWith(globalThis.window);
    expect(createRoot).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('renders the popup app when popup.html is running as a real extension popup', async () => {
    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render }));
    const redirectPopupPageIfNeeded = vi.fn(() => false);

    vi.doMock('react-dom/client', () => ({
      default: { createRoot },
      createRoot
    }));
    vi.doMock('./App', () => ({ default: () => null }));
    vi.doMock('./styles.css', () => ({}));
    vi.doMock('./utils/popupRuntime', () => ({ redirectPopupPageIfNeeded }));

    const rootElement = { id: 'root' };
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => rootElement)
    });
    vi.stubGlobal('window', {
      location: {
        href: 'chrome-extension://abc/popup.html',
        pathname: '/popup.html',
        replace: vi.fn()
      }
    });

    await import('./index');

    expect(redirectPopupPageIfNeeded).toHaveBeenCalledWith(globalThis.window);
    expect(createRoot).toHaveBeenCalledWith(rootElement);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
