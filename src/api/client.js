import AsyncStorage from '@react-native-async-storage/async-storage';
import {cacheGet, cacheSet} from '../db';

const BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://stage6-backend.onrender.com').replace(/\/$/, '');

export const session = {
  async get() { return { token: await AsyncStorage.getItem('token'), user: JSON.parse(await AsyncStorage.getItem('user') || 'null') }; },
  async set(token, user) { await AsyncStorage.multiSet([['token', token], ['user', JSON.stringify(user)]]); },
  async clear() { await AsyncStorage.multiRemove(['token', 'user']); },
};

// Paths that must never be served from / written to the offline cache.
const NO_CACHE = /^\/(auth|ai)\b|\/video(\?|$)/;
const listeners = new Set();
let lastFromCache = false;
export const onCacheServed = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const servedFromCache = () => lastFromCache;

/**
 * api(path, opts)
 *  - GET  : on success the JSON is cached in SQLite; if the network is down the last cached copy is returned
 *           (so lists, patients, appointments etc. keep working offline).
 *  - other: unchanged. Offline writes are queued by the callers through offline.enqueue().
 * Network failures throw an Error with `.network = true` so callers can tell them from server errors.
 */
export async function api(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const token = await AsyncStorage.getItem('token');
  const headers = { Accept: 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = opts.body;
  if (body && typeof body !== 'string' && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'; body = JSON.stringify(body);
  }
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheable = method === 'GET' && !NO_CACHE.test(path) && !opts.noCache;
  let response;
  try { response = await fetch(url, { ...opts, method, body, headers }); }
  catch {
    if (cacheable) {
      const hit = cacheGet(`GET:${path}`);
      if (hit) { lastFromCache = true; listeners.forEach(f => f(hit.at)); return hit.data; }
    }
    const err = new Error(`Cannot reach API at ${BASE}. Check the server and mobile .env URL.`); err.network = true; throw err;
  }
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = { detail: raw }; }
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail : detail?.message || data?.message || `Request failed (${response.status})`;
    const err = new Error(message); err.status = response.status; err.data = data; throw err;
  }
  lastFromCache = false;
  if (cacheable) cacheSet(`GET:${path}`, data);
  return data;
}
export async function getAccessToken() { return (await AsyncStorage.getItem('token')) || ''; }
export { BASE };
