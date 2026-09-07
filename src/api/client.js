/**
 * Axios instance shared by the whole app.
 *
 * - Base URL comes from the runtime config (/config.json).
 * - The stored bearer token is attached to every request.
 * - A 401 response clears the session and bounces to the login page.
 *
 * @module api/client
 */

import axios from 'axios';
import { getConfig } from './config.js';

/** localStorage key holding the JWT. */
export const TOKEN_KEY = 'xl.token';

/**
 * Read the stored token.
 *
 * @returns {string | null}
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store (or clear) the token.
 *
 * @param {string | null} token
 * @returns {void}
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const api = axios.create();

api.interceptors.request.use((config) => {
  config.baseURL = getConfig().apiBaseUrl;
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Routes that do not require a session, so a 401 must not bounce away from them. */
const PUBLIC_PATHS = ['/login', '/register'];

/** Requests that are session probes; a 401 there is expected, not a redirect. */
const SILENT_401 = ['/auth/me.php', '/auth/login.php', '/auth/register.php'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    const url = (error.config && error.config.url) || '';
    if (status === 401) {
      setToken(null);
      const onPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
      const isProbe = SILENT_401.some((p) => url.includes(p));
      if (!onPublicPage && !isProbe) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Pull a human readable message out of an axios error.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function apiError(error, fallback = 'Something went wrong.') {
  if (error && error.response && error.response.data && error.response.data.error) {
    return error.response.data.error;
  }
  if (error && error.message) {
    return error.message;
  }
  return fallback;
}

/**
 * Build an absolute URL for a stored upload (avatar) path.
 *
 * @param {string | null | undefined} relPath
 * @returns {string | null}
 */
export function uploadUrl(relPath) {
  if (!relPath) {
    return null;
  }
  const base = getConfig().apiBaseUrl.replace(/\/$/, '');
  return `${base}/${relPath.replace(/^\//, '')}`;
}

export default api;
