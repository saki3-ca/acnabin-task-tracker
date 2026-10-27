import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLivePolling } from '../lib/useLivePolling';
import { appThemeService, AppTheme } from '../services/appThemeService';

const STORAGE_KEY = 'acnabin_ui_theme';
const DEV_PREVIEW_KEY = 'acnabin_dev_ui_theme';
const PERSONAL_KEY_PREFIX = 'acnabin_user_theme_';

interface ThemeContextValue {
  /** The theme actually shown: browser preview, else the person's own choice, else the firm default. */
  theme: AppTheme;
  /** The firm-wide default the Admin saved. */
  defaultTheme: AppTheme;
  /** This person's own choice, or null to follow the firm default. */
  personalTheme: AppTheme | null;
  setPersonalTheme: (theme: AppTheme | null) => void;
  previewTheme: (theme: AppTheme) => void;
  saveTheme: (theme: AppTheme) => Promise<void>;
  isDevOverride: boolean;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getDevPreview(): AppTheme | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('uiTheme')?.toLowerCase();
  if (param === 'classic' || param === 'glass') {
    sessionStorage.setItem(DEV_PREVIEW_KEY, param);
    return param;
  }
  const sessionDev = sessionStorage.getItem(DEV_PREVIEW_KEY);
  return sessionDev === 'classic' || sessionDev === 'glass' ? sessionDev : null;
}

function getCachedDefault(): AppTheme {
  // Cached value avoids a flash of the wrong theme while the database answers
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === 'classic' || cached === 'glass') return cached;
  }
  return 'classic';
}

function readPersonal(empId?: string): AppTheme | null {
  if (!empId) return null;
  try {
    const v = localStorage.getItem(PERSONAL_KEY_PREFIX + empId);
    return v === 'classic' || v === 'glass' ? v : null;
  } catch {
    return null;
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const empId = currentUser?.empId;
  const [defaultTheme, setDefaultTheme] = useState<AppTheme>(getCachedDefault);
  const [preview, setPreview] = useState<AppTheme | null>(getDevPreview);
  const [personalTheme, setPersonalState] = useState<AppTheme | null>(() => readPersonal(empId));
  const [isLoading, setIsLoading] = useState(false);

  const isDevOverride = Boolean(import.meta.env.DEV && preview);
  const theme: AppTheme = preview ?? personalTheme ?? defaultTheme;

  // Each person keeps their own choice; reload it when someone else signs in
  useEffect(() => {
    setPersonalState(readPersonal(empId));
  }, [empId]);

  // Sync data-ui-theme attribute on <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', theme);
  }, [theme]);

  // Fetch the firm default from the database
  const refreshTheme = useCallback(async () => {
    try {
      setIsLoading(true);
      const dbTheme = await appThemeService.getTheme();
      setDefaultTheme(dbTheme);
      localStorage.setItem(STORAGE_KEY, dbTheme);
    } catch {
      // Keep current theme on network failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTheme();
  }, [refreshTheme, empId]);

  // Poll database every 60s
  useLivePolling(() => refreshTheme(), 60000, true);

  // Preview for this browser tab only (nothing is saved)
  const previewTheme = useCallback((newTheme: AppTheme) => {
    setPreview(newTheme);
    if (import.meta.env.DEV) {
      sessionStorage.setItem(DEV_PREVIEW_KEY, newTheme);
      const url = new URL(window.location.href);
      url.searchParams.set('uiTheme', newTheme);
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Admin saves the firm default to the database
  const saveTheme = useCallback(async (newTheme: AppTheme) => {
    await appThemeService.setTheme(newTheme);
    setDefaultTheme(newTheme);
    setPreview(null);
    localStorage.setItem(STORAGE_KEY, newTheme);
    if (import.meta.env.DEV) {
      sessionStorage.removeItem(DEV_PREVIEW_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('uiTheme');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Anyone saves their own look; null goes back to the firm default
  const setPersonalTheme = useCallback((newTheme: AppTheme | null) => {
    setPersonalState(newTheme);
    setPreview(null);
    if (!empId) return;
    try {
      if (newTheme) localStorage.setItem(PERSONAL_KEY_PREFIX + empId, newTheme);
      else localStorage.removeItem(PERSONAL_KEY_PREFIX + empId);
    } catch {
      // storage blocked: the choice lasts until the page is closed
    }
    if (import.meta.env.DEV) {
      sessionStorage.removeItem(DEV_PREVIEW_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete('uiTheme');
      window.history.replaceState(null, '', url.toString());
    }
  }, [empId]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        defaultTheme,
        personalTheme,
        setPersonalTheme,
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

export const useTheme = useAppTheme;
