import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  type ThemeState,
} from './themeConfig';

interface ThemeCtx {
  theme: ThemeState;
  /** Patch one or more theme fields. */
  set: (patch: Partial<ThemeState>) => void;
  reset: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const set = useCallback((patch: Partial<ThemeState>) => {
    setTheme((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setTheme({ ...DEFAULT_THEME }), []);

  const value = useMemo<ThemeCtx>(
    () => ({ theme, set, reset }),
    [theme, set, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
