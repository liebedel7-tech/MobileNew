/**
 * Install Detection Service & React Hook for Tagoloan Water District
 * Detects whether the app is currently running as an installed standalone app
 * or has been downloaded/installed on the device.
 */

import { useState, useEffect } from 'react';

const INSTALL_STORAGE_KEY = 'twd_app_installed_v1';
const INSTALL_EVENT_NAME = 'twd:app-install-status-changed';

/**
 * Checks all native browser and environment signals to determine
 * if the application is running as an installed standalone mobile app
 * or has already been downloaded/installed on this device.
 */
export function isAppInstalledOnDevice(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check if running in standalone display mode (Android WebAPK, Chrome PWA, etc.)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // 2. Check if running in fullscreen mode from home screen launcher
    if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }

    // 3. Check iOS Safari standalone home screen flag
    if ((window.navigator as any).standalone === true) {
      return true;
    }

    // 4. Check Android TWA / WebAPK package referrer
    if (document.referrer && document.referrer.startsWith('android-app://')) {
      return true;
    }

    // 5. Check URL parameters injected by native WebAPK or launcher shortcut
    const searchParams = new URLSearchParams(window.location.search);
    if (
      searchParams.get('source') === 'pwa' || 
      searchParams.get('installed') === 'true' || 
      searchParams.get('mode') === 'standalone'
    ) {
      return true;
    }

    // 6. Check persistent local storage record (set upon user installing / downloading)
    const storedStatus = localStorage.getItem(INSTALL_STORAGE_KEY);
    if (storedStatus === 'true') {
      return true;
    }
  } catch (err) {
    console.warn('Could not determine install status:', err);
  }

  return false;
}

/**
 * Explicitly marks the application as installed/downloaded on this device.
 */
export function markAppAsInstalled(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INSTALL_STORAGE_KEY, 'true');
    window.dispatchEvent(new CustomEvent(INSTALL_EVENT_NAME, { detail: { isInstalled: true } }));
  } catch (err) {
    console.warn('Error saving install flag:', err);
  }
}

/**
 * Resets the installation state for testing or if the user removed the app.
 */
export function resetAppInstallStatus(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(INSTALL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(INSTALL_EVENT_NAME, { detail: { isInstalled: false } }));
  } catch (err) {
    console.warn('Error resetting install flag:', err);
  }
}

/**
 * React hook to listen for installation status changes and native browser events.
 */
export function useDeviceInstallStatus(): {
  isInstalled: boolean;
  markAsInstalled: () => void;
  resetInstallStatus: () => void;
} {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isAppInstalledOnDevice());

  useEffect(() => {
    // Initial check
    setIsInstalled(isAppInstalledOnDevice());

    // 1. Listen for browser 'appinstalled' event (standard PWA install completion event)
    const handleAppInstalled = () => {
      markAppAsInstalled();
      setIsInstalled(true);
    };

    // 2. Listen for display-mode media query change (e.g. window transitioning to standalone)
    const mediaQuery = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        markAppAsInstalled();
        setIsInstalled(true);
      }
    };

    // 3. Listen for internal app install events
    const handleCustomInstallEvent = (e: any) => {
      setIsInstalled(e.detail?.isInstalled ?? isAppInstalledOnDevice());
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(INSTALL_EVENT_NAME as any, handleCustomInstallEvent);

    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if (mediaQuery && (mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(INSTALL_EVENT_NAME as any, handleCustomInstallEvent);
      if (mediaQuery && mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery && (mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handleMediaChange);
      }
    };
  }, []);

  return {
    isInstalled,
    markAsInstalled: markAppAsInstalled,
    resetInstallStatus: resetAppInstallStatus,
  };
}
