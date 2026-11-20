import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, setSessionToken } from './api';
import { applyAppearance, normalizeAppearance, type Appearance } from './theme';
import type { ApiResult } from './types';

export interface User extends Appearance {
  id: string;
  username: string;
  name: string;
  hasPin: boolean;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  signIn(username: string, secret: string, method: 'password' | 'pin'): Promise<string | null>;
  signOut(): Promise<void>;
  saveAccount(body: Record<string, unknown>): Promise<ApiResult>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

function applyUserAppearance(u: User) {
  applyAppearance(normalizeAppearance(u));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void api<{ user: User }>('auth/me', 'GET').then((r) => {
      if (!alive) return;
      if (r.user) applyUserAppearance(r.user);
      setUser(r.user ?? null);
      setReady(true);
    });
    const expired = () => setUser(null);
    window.addEventListener('lifx:signed-out', expired);
    return () => {
      alive = false;
      window.removeEventListener('lifx:signed-out', expired);
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      ready,
      async signIn(username, secret, method) {
        const body = method === 'pin' ? { username, pin: secret } : { username, password: secret };
        const r = await api<{ user: User; token: string }>('auth/login', 'POST', body);
        if (!r.user) return r.error ?? 'Sign in failed.';
        setSessionToken(r.token ?? null);
        applyUserAppearance(r.user);
        setUser(r.user);
        return null;
      },
      async signOut() {
        await api('auth/logout', 'POST');
        setSessionToken(null);
        setUser(null);
      },
      async saveAccount(body) {
        const r = await api<{ user: User }>('account', 'PUT', body);
        if (r.user) {
          applyUserAppearance(r.user);
          setUser(r.user);
        }
        return r;
      },
    }),
    [user, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="p-8 text-mut">Loading&hellip;</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
