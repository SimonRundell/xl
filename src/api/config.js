/**
 * Runtime configuration loader.
 *
 * The app reads /config.json (served from the public folder) once at start up.
 * That file is not bundled, so the API base URL can be changed on a deployed
 * build without rebuilding.
 *
 * @module api/config
 */

/** @type {{ apiBaseUrl: string } | null} */
let cache = null;

/**
 * Load and cache /config.json.
 *
 * @returns {Promise<{ apiBaseUrl: string }>}
 */
export async function loadConfig() {
  if (cache) {
    return cache;
  }
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`config.json returned ${res.status}`);
    }
    cache = await res.json();
  } catch (err) {
    console.error('Could not load /config.json, falling back to same-origin /api', err);
    cache = { apiBaseUrl: '/api' };
  }
  return cache;
}

/**
 * Return the already loaded config.
 *
 * @returns {{ apiBaseUrl: string }}
 */
export function getConfig() {
  if (!cache) {
    throw new Error('Config not loaded yet. Call loadConfig() first.');
  }
  return cache;
}
