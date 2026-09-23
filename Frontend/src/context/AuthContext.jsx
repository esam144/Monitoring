import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMeRequest, loginRequest, logoutRequest } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [bootstrapping, setBootstrapping] = useState(Boolean(localStorage.getItem('token')));

  const persistSession = (nextToken, nextUser) => {
    localStorage.setItem('token', nextToken);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!token) {
        setBootstrapping(false);
        return;
      }
      try {
        const { data } = await getMeRequest();
        if (!cancelled) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [token, clearSession]);

  const login = async (email, password) => {
    const { data } = await loginRequest(email, password);
    persistSession(data.token, data.user);
    return data;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === 'admin',
      bootstrapping,
      login,
      logout,
    }),
    [user, token, bootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
