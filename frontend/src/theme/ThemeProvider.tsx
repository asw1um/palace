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
  PRESETS,
  resolveMode,
  resolveMotion,
  saveTheme,
  type ThemeState,
} from './themeConfig';

interface ThemeCtx {
  theme: ThemeState;
  /** Patch one or more theme fields. */
  set: (patch: Partial<ThemeState>) => void;
  applyPreset: (id: string) => void;
  reset: () => void;
  /** Concrete values after resolving `system`. */
  mode: 'dark' | 'light';
  motion: 'full' | 'reduced';
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>(() => loadTheme());
  const [systemTick, setSystemTick] = useState(0);

  // First paint + every change
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme, systemTick]);

  // Follow the OS when the user picked "system"
  useEffect(() => {
    const colour = window.matchMedia('(prefers-color-scheme: light)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bump = () => setSystemTick((n) => n + 1);
    colour.addEventListener('change', bump);
    motion.addEventListener('change', bump);
    return () => {
      colour.removeEventListener('change', bump);
      motion.removeEventListener('change', bump);
    };
  }, []);

  const set = useCallback((patch: Partial<ThemeState>) => {
    setTheme((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setTheme((prev) => ({
      ...prev,
      preset: p.id,
      accent: p.accent,
      accent2: p.accent2,
      mode: p.mode,
    }));
  }, []);

  const reset = useCallback(() => setTheme({ ...DEFAULT_THEME }), []);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      set,
      applyPreset,
      reset,
      mode: resolveMode(theme.mode),
      motion: resolveMotion(theme.motion),
    }),
    // systemTick forces a recompute when the OS preference flips
    [theme, set, applyPreset, reset, systemTick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
