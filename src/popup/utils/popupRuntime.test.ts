import { describe, expect, it, vi } from 'vitest';
import { getSettingsPageUrl, redirectPopupPageIfNeeded, shouldRedirectPopupPage } from './popupRuntime';

describe('popup runtime detection', () => {
  it('returns the settings page url from the popup page url', () => {
    expect(getSettingsPageUrl('chrome-extension://abc/popup.html')).toBe(
      'chrome-extension://abc/settings.html'
    );
  });

  it('redirects when popup.html is running outside the popup surface', () => {
    expect(
      shouldRedirectPopupPage({
        pathname: '/popup.html',
        isPopupView: false
      })
    ).toBe(true);
  });

  it('does not redirect when popup.html is running as a real extension popup', () => {
    expect(
      shouldRedirectPopupPage({
        pathname: '/popup.html',
        isPopupView: true
      })
    ).toBe(false);
  });

  it('fails safe toward settings when popup detection errors unexpectedly', () => {
    expect(
      shouldRedirectPopupPage({
        pathname: '/popup.html',
        isPopupView: true,
        detectionError: true
      })
    ).toBe(true);
  });

  it('replaces the location with settings when popup detection throws', () => {
    const replace = vi.fn();

    expect(
      redirectPopupPageIfNeeded(
        {
          location: {
            href: 'chrome-extension://abc/popup.html',
            pathname: '/popup.html',
            replace
          }
        },
        () => {
          throw new Error('boom');
        }
      )
    ).toBe(true);

    expect(replace).toHaveBeenCalledWith('chrome-extension://abc/settings.html');
  });

  it('does not treat a different popup view with the same url as the current popup', () => {
    const replace = vi.fn();
    const popupWindow = {
      location: {
        href: 'chrome-extension://abc/popup.html',
        pathname: '/popup.html',
        replace
      }
    };

    const differentPopupView = {
      location: {
        href: 'chrome-extension://abc/popup.html'
      }
    };

    expect(
      redirectPopupPageIfNeeded({
        ...popupWindow,
        chrome: {
          extension: {
            getViews: () => [differentPopupView]
          }
        }
      })
    ).toBe(true);

    expect(replace).toHaveBeenCalledWith('chrome-extension://abc/settings.html');
  });
});
