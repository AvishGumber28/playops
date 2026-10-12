'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, MeResponse } from './api';

const TOKEN_STORAGE_KEY = 'playops_token';

interface AuthContextValue {
  token: string | null;
  me: MeResponse | null;
  loading: boolean;
  // Returns the freshly-loaded profile (or null if it couldn't be
  // loaded) - callers that need to act on it right away (e.g. the login
  // page's role-tab check) can't just read `me` from context afterward,
  // since a setState scheduled inside here isn't visible in the same
  // closure until the next render.
  login: (email: string, password: string) => Promise<MeResponse | null>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  // Starts true: on first mount we don't yet know if a stored token exists,
  // so route guards must wait for this to resolve before deciding to redirect.
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async (t: string): Promise<MeResponse | null> => {
    try {
      const profile = await api.me(t);
      setMe(profile);
      return profile;
    } catch {
      // Token was rejected (expired/invalid) - clear everything and force re-login.
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setMe(null);
      return null;
    }
  }, []);

  // On first load, restore a token from localStorage if one exists and
  // re-verify it against the backend rather than trusting it blindly.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      // Restoring auth state from localStorage can only happen client-side,
      // after mount - the server has no access to localStorage, so doing
      // this via lazy initial state instead would cause a hydration
      // mismatch. This is the one legitimate case for a direct setState
      // call inside an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(stored);
      loadMe(stored).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: newToken } = await api.login({ email, password });
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      setToken(newToken);
      setLoading(true);
      const profile = await loadMe(newToken);
      setLoading(false);
      return profile;
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setMe(null);
  }, []);

  // Re-fetches /api/me with the current token, without a full page reload -
  // needed after actions that change something /api/me reports (e.g.
  // selecting a hostel for the first time).
  const refreshMe = useCallback(async () => {
    if (token) await loadMe(token);
  }, [token, loadMe]);

  return (
    <AuthContext.Provider value={{ token, me, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
