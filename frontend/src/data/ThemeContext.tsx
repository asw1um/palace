import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { themeStore } from './themeStore';

interface ThemeCtxVal {
  themeId: string;
  setTheme: (id: string) => void;
  theme: { id: string; label: string; primary: string };
}

const ThemeCtx = createContext<ThemeCtxVal>({
  themeId: themeStore.get(),
  setTheme: () => {},
  theme: { id: 'default', label: 'Default', primary: '#4da6ff' },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState(themeStore.get());

  // Apply theme on mount so CSS vars are set before any component renders
  useEffect(() => {
    themeStore.apply(themeId);
  }, []);

  const setTheme = useCallback((id: string) => {
    themeStore.set(id);
    setThemeId(id);
  }, []);

  const theme = themeStore.list.find(t => t.id === themeId) ?? themeStore.list[0];

  return (
    <ThemeCtx.Provider value={{ themeId, setTheme, theme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
