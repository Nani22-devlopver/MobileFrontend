import NetInfo from '@react-native-community/netinfo';
import {api} from './api/client';
import {db, initDb, cacheClear} from './db';

// ---- outbox: writes made offline are stored in SQLite and replayed automatically when internet returns ----
const MAX_ATTEMPTS = 8;
const subs = new Set();
const notify = () => { const n = queueCount(); subs.forEach(f => f(n)); };
export const subscribeQueue = fn => { subs.add(fn); fn(queueCount()); return () => subs.delete(fn); };

export async function initOffline() { initDb(); }
export function enqueue(path, method, body) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  db.runSync('INSERT INTO outbox(id,path,method,body,created_at) VALUES(?,?,?,?,?)', [id, path, method, JSON.stringify(body ?? null), Date.now()]);
  notify();
  return id;
}
export function queueCount() { return db.getFirstSync('SELECT COUNT(*) n FROM outbox')?.n || 0; }
export function pendingItems() { return db.getAllSync('SELECT id,path,method,created_at,attempts,last_error FROM outbox ORDER BY created_at'); }
export function clearOfflineData() { db.runSync('DELETE FROM outbox'); cacheClear(); notify(); }   // used on logout so data never leaks between accounts
export function clearCacheOnly() { cacheClear(); }

let running = false;
export async function syncOutbox() {
  if (running) return {synced: 0, remaining: queueCount(), busy: true};
  const state = await NetInfo.fetch();
  if (!state.isConnected || state.isInternetReachable === false) return {synced: 0, remaining: queueCount(), offline: true};
  running = true;
  let synced = 0;
  try {
    const rows = db.getAllSync('SELECT * FROM outbox ORDER BY created_at');
    for (const row of rows) {
      try {
        await api(row.path, {method: row.method, body: JSON.parse(row.body), headers: {'Idempotency-Key': row.id}});
        db.runSync('DELETE FROM outbox WHERE id=?', [row.id]); synced++;
      } catch (e) {
        if (e.network) break;                                   // still offline: keep everything, try again later
        if (e.status === 401) break;                            // signed out: keep items until the user signs in again
        const dead = e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
        db.runSync('UPDATE outbox SET attempts=attempts+1, last_error=? WHERE id=?', [String(e.message).slice(0, 200), row.id]);
        if (dead && row.attempts + 1 >= MAX_ATTEMPTS) continue; // permanently rejected: stays listed so the worker can see it
      }
    }
  } finally { running = false; notify(); }
  return {synced, remaining: queueCount()};
}

// Auto-sync: when connectivity returns, when the app comes to the foreground and every 60 s while online.
let started = false;
export function startAutoSync(onSynced) {
  if (started) return () => {};
  started = true;
  const run = async () => { const r = await syncOutbox().catch(() => null); if (r?.synced && onSynced) onSynced(r); };
  const unsub = NetInfo.addEventListener(st => { if (st.isConnected && st.isInternetReachable !== false) run(); });
  const timer = setInterval(() => { if (queueCount()) run(); }, 60000);
  run();
  return () => { started = false; unsub(); clearInterval(timer); };
}
