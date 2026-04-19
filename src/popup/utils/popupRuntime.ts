type PopupLocationLike = {
  href: string;
  pathname: string;
  replace: (url: string) => void;
};

type PopupWindowLike = {
  chrome?: {
    extension?: {
      getViews?: (fetchProperties: { type: 'popup' }) => unknown[];
    };
  };
  location: PopupLocationLike;
};

type PopupRedirectInput = {
  pathname: string;
  isPopupView: boolean;
  detectionError?: boolean;
};

export function getSettingsPageUrl(popupUrl: string): string {
  try {
    const settingsUrl = new URL(popupUrl);
    settingsUrl.pathname = settingsUrl.pathname.replace(/popup\.html$/, 'settings.html');
    settingsUrl.search = '';
    settingsUrl.hash = '';
    return settingsUrl.toString();
  } catch {
    return popupUrl.replace(/popup\.html(?:[?#].*)?$/, 'settings.html');
  }
}

export function shouldRedirectPopupPage({
  pathname,
  isPopupView,
  detectionError = false
}: PopupRedirectInput): boolean {
  if (!pathname.endsWith('/popup.html')) {
    return false;
  }

  if (detectionError) {
    return true;
  }

  return !isPopupView;
}

function isRealExtensionPopup(targetWindow: PopupWindowLike): boolean {
  const popupViews = targetWindow.chrome?.extension?.getViews?.({ type: 'popup' }) ?? [];

  return popupViews.some((popupView) => popupView === targetWindow);
}

export function redirectPopupPageIfNeeded(
  targetWindow: PopupWindowLike = window,
  detectPopupView: (targetWindow: PopupWindowLike) => boolean = isRealExtensionPopup
): boolean {
  const { href, pathname } = targetWindow.location;

  let shouldRedirect: boolean;

  try {
    shouldRedirect = shouldRedirectPopupPage({
      pathname,
      isPopupView: detectPopupView(targetWindow)
    });
  } catch {
    shouldRedirect = shouldRedirectPopupPage({
      pathname,
      isPopupView: false,
      detectionError: true
    });
  }

  if (!shouldRedirect) {
    return false;
  }

  targetWindow.location.replace(getSettingsPageUrl(href));
  return true;
}
