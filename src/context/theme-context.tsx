import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';

export const THEME_STORAGE_KEY = '@app_theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  isDark: boolean;
  themePreference: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemePreference {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Ignore localStorage access errors
    }
  }
  return 'system';
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [themePreference, setThemePreferenceState] = React.useState<ThemePreference>(getInitialTheme);
  const [isLoading, setIsLoading] = React.useState(true);

  // Initialize theme from storage on mount
  React.useEffect(() => {
    let isMounted = true;

    async function loadStoredTheme() {
      try {
        let stored: string | null = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        } else {
          stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        }

        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          if (isMounted) {
            setThemePreferenceState(stored);
            setColorScheme(stored);
          }
        }
      } catch (err) {
        console.error('Failed to load theme preference from cache:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStoredTheme();

    return () => {
      isMounted = false;
    };
  }, [setColorScheme]);

  const setTheme = React.useCallback(
    async (newTheme: ThemePreference) => {
      try {
        setThemePreferenceState(newTheme);
        setColorScheme(newTheme);

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        }
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (err) {
        console.error('Failed to save theme preference to cache:', err);
      }
    },
    [setColorScheme]
  );

  const toggleTheme = React.useCallback(async () => {
    const nextTheme: ThemePreference = colorScheme === 'dark' ? 'light' : 'dark';
    await setTheme(nextTheme);
  }, [colorScheme, setTheme]);

  const activeScheme: 'light' | 'dark' = (colorScheme === 'dark' ? 'dark' : 'light');

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      colorScheme: activeScheme,
      isDark: activeScheme === 'dark',
      themePreference,
      setTheme,
      toggleTheme,
      isLoading,
    }),
    [activeScheme, themePreference, setTheme, toggleTheme, isLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemePreferenceProvider');
  }
  return context;
}
