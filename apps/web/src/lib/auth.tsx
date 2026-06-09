'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, apiPost } from './api';

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<User>('/api/users/me');
      if (res.code === 0 && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const res = await apiPost<User>('/api/auth/login', { username, password });
    if (res.code !== 0) throw new Error(res.message);
    setUser(res.data);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await apiPost<User>('/api/auth/register', { username, email, password });
    if (res.code !== 0) throw new Error(res.message);
  };

  const logout = async () => {
    await apiPost<null>('/api/auth/logout', {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
