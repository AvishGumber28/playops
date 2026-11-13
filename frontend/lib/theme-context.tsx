'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'playops-theme';

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

// Dark (green pitch) is the default/fallback theme everywhere - light is
// opt-in and remembered per browser. The inline script in app/layout.tsx
// applies a stored "light" choice before paint, so this effect only ever
// needs to keep state/attribute/storage in sync after that.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
