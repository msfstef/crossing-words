import { useSyncExternalStore, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'theme';

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get stored theme from localStorage
 */
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Resolve theme to actual light/dark value
 */
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

// Store for theme subscription
let currentTheme: Theme = getStoredTheme();
let themeListeners: Set<() => void> = new Set();

function subscribeToTheme(callback: () => void) {
  themeListeners.add(callback);
  return () => themeListeners.delete(callback);
}

function getThemeSnapshot(): Theme {
  return currentTheme;
}

function setThemeInternal(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = resolveTheme(theme);
  themeListeners.forEach((listener) => listener());
}

// Store for system preference subscription
let systemPreferenceListeners: Set<() => void> = new Set();
let cachedSystemTheme: ResolvedTheme = getSystemTheme();

function subscribeToSystemPreference(callback: () => void) {
  systemPreferenceListeners.add(callback);

  // Set up media query listener on first subscriber
  if (systemPreferenceListeners.size === 1 && typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      cachedSystemTheme = getSystemTheme();
      systemPreferenceListeners.forEach((listener) => listener());

      // If user is in 'system' mode, update the DOM theme
      if (currentTheme === 'system') {
        document.documentElement.dataset.theme = cachedSystemTheme;
        themeListeners.forEach((listener) => listener());
      }
    };
    mediaQuery.addEventListener('change', handler);
  }

  return () => {
    systemPreferenceListeners.delete(callback);
  };
}

function getSystemPreferenceSnapshot(): ResolvedTheme {
  return cachedSystemTheme;
}

/**
 * Hook for managing theme state
 *
 * Returns:
 * - theme: Current theme setting ('light' | 'dark' | 'system')
 * - resolvedTheme: Actual applied theme ('light' | 'dark')
 * - setTheme: Function to update theme
 *
 * The hook does NOT set theme on initial render - that's handled by
 * the blocking script in index.html to prevent flash of wrong theme.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeSnapshot);

  const systemTheme = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPreferenceSnapshot,
    getSystemPreferenceSnapshot
  );

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeInternal(newTheme);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
