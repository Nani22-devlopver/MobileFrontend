import * as SQLite from 'expo-sqlite';
// One shared SQLite handle (read cache + outbox). Used by api/client.js and offline.js.
export const db = SQLite.openDatabaseSync('aarogya.db');
let ready = false;
export function initDb() {
  if (ready) return;
  db.execSync(`CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER);
  CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, path TEXT, method TEXT, body TEXT, created_at INTEGER, attempts INTEGER DEFAULT 0, last_error TEXT);`);
  try { db.execSync('ALTER TABLE outbox ADD COLUMN last_error TEXT'); } catch { /* column already exists */ }
  ready = true;
}
initDb();
export function cacheSet(key, value) { try { db.runSync('INSERT OR REPLACE INTO cache(key,value,updated_at) VALUES(?,?,?)', [key, JSON.stringify(value), Date.now()]); } catch { /* cache is best-effort */ } }
export function cacheGet(key) { try { const r = db.getFirstSync('SELECT value, updated_at FROM cache WHERE key=?', [key]); return r ? { data: JSON.parse(r.value), at: r.updated_at } : null; } catch { return null; } }
export function cacheClear() { try { db.runSync('DELETE FROM cache'); } catch { /* ignore */ } }
