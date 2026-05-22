import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User } from '@/types/api';
import * as api from '@/api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: { nickname?: string; bio?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => false,
  signup: async () => false,
  logout: () => {},
  updateProfile: async () => {},
  refreshUser: async () => {},
  isAuthenticated: false,
  loading: true,
});

const TOKEN_KEY = 'palace_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
      api.getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await api.login(username, password);
      localStorage.removeItem('palace_profile_picture');
      localStorage.removeItem('palace_profile_banner');
      localStorage.setItem(TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return true;
    } catch {
      return false;
    }
  }, []);

  const signup = useCallback(async (username: string, password: string, nickname: string): Promise<boolean> => {
    try {
      const res = await api.register(username, password, nickname);
      localStorage.removeItem('palace_profile_picture');
      localStorage.removeItem('palace_profile_banner');
      localStorage.setItem(TOKEN_KEY, res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('palace_profile_picture');
    localStorage.removeItem('palace_profile_banner');
    setToken(null);
    setUser(null);
    window.location.href = '/#/login';
  }, []);

  const updateProfile = useCallback(async (data: { nickname?: string; bio?: string }) => {
    const updated = await api.updateProfile(data.nickname, data.bio);
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const updated = await api.getMe();
      setUser(updated);
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, login, signup, logout, updateProfile, refreshUser,
      isAuthenticated: !!token,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
