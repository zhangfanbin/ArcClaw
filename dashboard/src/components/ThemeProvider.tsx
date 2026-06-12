import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';
type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void };

const Ctx = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children, defaultTheme = 'dark', storageKey = 'vite-ui-theme' }: {
  children: React.ReactNode; defaultTheme?: Theme; storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      root.classList.add(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, setTheme: (t) => { localStorage.setItem(storageKey, t); setTheme(t); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
