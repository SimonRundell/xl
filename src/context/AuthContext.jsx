/**
 * Authentication context.
 *
 * Holds the current user, exposes login / register / logout / refresh, and
 * restores the session from a stored token on first mount.
 *
 * @module context/AuthContext
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setToken } from '../api/client.js';

/**
 * @typedef {Object} XlUser
 * @property {number} id
 * @property {string} email
 * @property {string} screen_name
 * @property {string | null} avatar_path
 * @property {boolean} is_admin
 * @property {boolean} is_active
 * @property {Object} preferences
 */

const AuthContext = createContext(null);

/**
 * Provider component. Wrap the app in this.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export function AuthProvider({ children }) {
  /** @type {[XlUser | null, Function]} */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me.php');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  /**
   * Log in with email and password.
   *
   * @param {string} email
   * @param {string} password
   */
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login.php', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Register a new account and log straight in.
   *
   * @param {{ email: string, screen_name: string, password: string }} form
   */
  const register = useCallback(async (form) => {
    const { data } = await api.post('/auth/register.php', form);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setUser }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Consume the auth context.
 *
 * @returns {{
 *   user: XlUser | null,
 *   loading: boolean,
 *   login: Function,
 *   register: Function,
 *   logout: Function,
 *   refresh: Function,
 *   setUser: Function
 * }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
