import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLivePolling } from '../lib/useLivePolling';
import { appThemeService, AppTheme } from '../services/appThemeService';

const STORAGE_KEY = 'acnabin_ui_theme';
const DEV_PREVIEW_KEY = 'acnabin_dev_ui_theme';

interface ThemeContextValue {
  theme: AppTheme;
  previewTheme: (theme: AppTheme) => void;
  saveTheme: (theme: AppTheme) => Promise<void>;
  isDevOverride: boolean;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): AppTheme {
  // 1. Check DEV URL override (?uiTheme=classic|glass)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('uiTheme')?.toLowerCase();
    if (param === 'classic' || param === 'glass') {
      sessionStorage.setItem(DEV_PREVIEW_KEY, param);
      return param;
    }
    const sessionDev = sessionStorage.getItem(DEV_PREVIEW_KEY);
    if (sessionDev === 'classic' || sessionDev === 'glass') {
      return sessionDev;
    }
  }

  // 2. Check localStorage cached value to prevent flash of wrong theme
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === 'classic' || cached === 'glass') {
      return cached;
    }
  }

  return 'classic';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);
  const [isLoading, setIsLoading] = useState(false);

  const isDevOverride = Boolean(
    import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).has('uiTheme') ||
        sessionStorage.getItem(DEV_PREVIEW_KEY))
  );

  // Sync data-ui-theme attribute on <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', theme);
  }, [theme]);

  // Fetch true theme from database
  const refreshTheme = useCallback(async () => {
    // If dev override is in effect, do not overwrite with DB value
    if (isDevOverride) return;

    try {
      setIsLoading(true);
      const dbTheme = await appThemeService.getTheme();
      setThemeState(dbTheme);
      localStorage.setItem(STORAGE_KEY, dbTheme);
    } catch {
      // Keep current theme on network failure
    } finally {
      setIsLoading(false);
    }
  }, [isDevOverride]);

  useEffect(() => {
    void refreshTheme();
  }, [refreshTheme]);

  // Poll database every 60s
  useLivePolling(() => refreshTheme(), 60000, !isDevOverride);

  // Preview theme for current browser session only (dev/admin preview without saving to DB)
  const previewTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    if (import.meta.env.DEV) {
      sessionStorage.setItem(DEV_PREVIEW_KEY, newTheme);
      const url = new URL(window.location.href);
      url.searchParams.set('uiTheme', newTheme);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Admin saves theme to DB for everyone
  const saveTheme = useCallback(async (newTheme: AppTheme) => {
    await appThemeService.setTheme(newTheme);
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    if (import.meta.env.DEV) {
      sessionStorage.removeItem(DEV_PREVIEW_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('uiTheme');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        previewTheme,
        saveTheme,
        isDevOverride,
        isLoading
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
