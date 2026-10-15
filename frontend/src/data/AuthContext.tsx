import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { auth } from './api';
import { TOKEN_KEY, type RunMode } from './client';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  mode: RunMode;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  patchUser: (patch: Partial<User>) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await auth.me();
        if (alive) setUser(me);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await auth.login(username, password);
    setUser(res.user);
  }, []);

  const register = useCallback(async (username: string, password: string, nickname?: string) => {
    const res = await auth.register(username, password, nickname);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null);
    router.push('/login');
  }, [router]);

  const refresh = useCallback(async () => {
    try { setUser(await auth.me()); } catch { /* keep the current user */ }
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user, loading, mode: 'live' as RunMode,
      isAuthenticated: !!user,
      login, register, logout, refresh, patchUser,
    }),
    [user, loading, login, register, logout, refresh, patchUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
