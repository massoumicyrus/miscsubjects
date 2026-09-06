import { buildNowIso } from './build_time.js';
import { redactPublicSecrets, scrubOwnerIdentity } from './public_secret_guard.js';

const R2_CUTOFF = 10240;
const BUILD = 'miscsubjects';

function asString(v) {
  if (v == null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function previewOf(str) {
  if (str == null) return null;
  return str.length > 500 ? str.slice(0, 500) : str;
}

function uuid() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'e_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export async function logEvent(env, opts) {
  try {
    if (!env || !env.LEDGER) return null;
    const o = opts || {};
    const id = o.id || uuid();
    // BUILD LAW — TIME: server clock only. Caller-supplied o.ts is ignored.
    const ts = buildNowIso();
    const reqStr = asString(redactPublicSecrets(o.request, env));
    const resStr = asString(redactPublicSecrets(o.response, env));
    const reqSize = reqStr ? reqStr.length : 0;
    const resSize = resStr ? resStr.length : 0;

    let reqJson = reqStr;
    let resJson = resStr;
    let r2Req = null;
    let r2Res = null;

    if (env.R2 && reqStr && reqSize > R2_CUTOFF) {
      r2Req = `events/${id}.req.json`;
      try { await env.R2.put(r2Req, reqStr); reqJson = null; } catch { r2Req = null; }
    }
    if (env.R2 && resStr && resSize > R2_CUTOFF) {
      r2Res = `events/${id}.res.txt`;
      try { await env.R2.put(r2Res, resStr); resJson = null; } catch { r2Res = null; }
    }

    const insertStmt = env.LEDGER.prepare(
      `INSERT INTO events
       (id, ts, build, source, key, route, actor, action, direction, status,
        trace_id, step, parent, request_preview, response_preview, request_size,
        response_size, request_json, response_json, r2_request_key, r2_response_key,
        legacy_table, legacy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, ts, BUILD, String(o.source || ''), o.key || null, o.route ? scrubOwnerIdentity(o.route) : null,
      o.actor ? scrubOwnerIdentity(o.actor) : null, o.action || null, o.direction || null,
      typeof o.status === 'number' ? o.status : null,
      o.trace_id || null,
      typeof o.step === 'number' ? o.step : null,
      o.parent || null,
      previewOf(reqStr), previewOf(resStr), reqSize, resSize,
      reqJson, resJson, r2Req, r2Res,
      o.legacy_table || null, o.legacy_id || null
    );
    const isErr = typeof o.status === 'number' && o.status >= 400 ? 1 : 0;
    const statsStmt = env.LEDGER.prepare(
      `INSERT INTO events_stats (source, key, n, errors, last_ts) VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(source, key) DO UPDATE SET n = n + 1, errors = errors + ?, last_ts = excluded.last_ts`
    ).bind(String(o.source || ''), o.key || '', isErr, ts, isErr);
    const landed = await insertWithRetry(env, insertStmt, statsStmt);
    if (!landed) {
      await stashRow(env, id, {
        id, ts, build: BUILD, source: String(o.source || ''), key: o.key || null,
        route: o.route ? scrubOwnerIdentity(o.route) : null, actor: o.actor ? scrubOwnerIdentity(o.actor) : null,
        action: o.action || null, direction: o.direction || null,
        status: typeof o.status === 'number' ? o.status : null, trace_id: o.trace_id || null,
        step: typeof o.step === 'number' ? o.step : null, parent: o.parent || null,
        request_preview: previewOf(reqStr), response_preview: previewOf(resStr),
        request_size: reqSize, response_size: resSize, request_json: reqJson, response_json: resJson,
        r2_request_key: r2Req, r2_response_key: r2Res, legacy_table: o.legacy_table || null, legacy_id: o.legacy_id || null,
        _errors: isErr,
      });
      return id;
    }
    maybeFlush(env);
    return id;
  } catch {
    return null;
  }
}

// ── never-drop machinery ──────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [150, 500, 1200];
const PENDING_PREFIX = 'ledger:pending:';
const PENDING_FLAG = 'ledger:pending:any';
const FLUSH_GAP_MS = 20000;
let lastFlushCheck = 0;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// The events row and its stats counter, together, with three more tries when the database
// refuses. A missing events_stats table (pre-migration local db) still lets the event land.
async function insertWithRetry(env, insertStmt, statsStmt) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await env.LEDGER.batch([insertStmt, statsStmt]);
      return true;
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/no such table: events_stats/i.test(msg)) {
        try { await insertStmt.run(); return true; } catch {}
      }
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      else { try { console.error('ledger write refused after retries: ' + msg.slice(0, 200)); } catch {} }
    }
  }
  return false;
}

// A row the database refused, kept whole (its original timestamp included) until it can land.
async function stashRow(env, id, row) {
  if (!env.KV) return false;
  try {
    await env.KV.put(PENDING_PREFIX + id, JSON.stringify(row), { expirationTtl: 7 * 86400 });
    await env.KV.put(PENDING_FLAG, '1', { expirationTtl: 7 * 86400 });
    return true;
  } catch { return false; }
}

// Cheap, throttled: after a successful write, look once every FLUSH_GAP_MS for stashed rows.
function maybeFlush(env) {
  const now = Date.now();
  if (now - lastFlushCheck < FLUSH_GAP_MS) return;
  lastFlushCheck = now;
  flushPendingEvents(env, 25).catch(() => {});
}

// Re-insert stashed rows, oldest first, keeping their original timestamps. Idempotent: a row
// that already landed (INSERT OR IGNORE on the primary key) is simply cleared from the stash.
export async function flushPendingEvents(env, max = 50) {
  if (!env || !env.LEDGER || !env.KV) return { flushed: 0, remaining: 0 };
  let flag = null;
  try { flag = await env.KV.get(PENDING_FLAG); } catch { return { flushed: 0, remaining: 0 }; }
  if (!flag) return { flushed: 0, remaining: 0 };
  let list;
  try { list = await env.KV.list({ prefix: PENDING_PREFIX, limit: Math.max(1, Math.min(200, max)) + 1 }); }
  catch { return { flushed: 0, remaining: 0 }; }
  const keys = (list.keys || []).map((k) => k.name).filter((n) => n !== PENDING_FLAG);
  let flushed = 0;
  for (const name of keys.slice(0, max)) {
    let row;
    try { row = await env.KV.get(name, 'json'); } catch { continue; }
    if (!row || !row.id) { try { await env.KV.delete(name); } catch {} continue; }
    try {
      const ins = env.LEDGER.prepare(
        `INSERT OR IGNORE INTO events
         (id, ts, build, source, key, route, actor, action, direction, status,
          trace_id, step, parent, request_preview, response_preview, request_size,
          response_size, request_json, response_json, r2_request_key, r2_response_key,
          legacy_table, legacy_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        row.id, row.ts, row.build || BUILD, row.source || '', row.key, row.route, row.actor, row.action, row.direction,
        row.status, row.trace_id, row.step, row.parent, row.request_preview, row.response_preview,
        row.request_size || 0, row.response_size || 0, row.request_json, row.response_json,
        row.r2_request_key, row.r2_response_key, row.legacy_table, row.legacy_id,
      );
      const stats = env.LEDGER.prepare(
        `INSERT INTO events_stats (source, key, n, errors, last_ts) VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(source, key) DO UPDATE SET n = n + 1, errors = errors + ?, last_ts = MAX(last_ts, excluded.last_ts)`
      ).bind(row.source || '', row.key || '', row._errors ? 1 : 0, row.ts, row._errors ? 1 : 0);
      try { await env.LEDGER.batch([ins, stats]); } catch (e) {
        if (/no such table: events_stats/i.test(String(e && e.message || e))) await ins.run(); else throw e;
      }
      await env.KV.delete(name);
      flushed++;
    } catch {
      break; // the database is still refusing — leave the rest for the next flush
    }
  }
  const remaining = Math.max(0, keys.length - flushed);
  if (!remaining && flushed === keys.length) { try { await env.KV.delete(PENDING_FLAG); } catch {} }
  return { flushed, remaining };
}

// Archival: full payloads older than ARCHIVE_DAYS move from D1 to R2 (raw preserved,
// same events/{id}.req|res keys readEventFull already resolves). Previews, sizes and
// metadata stay in D1 forever, so D1 stays bounded while nothing becomes unreadable.
const ARCHIVE_DAYS = 45;
const ARCHIVE_BATCH = 40;
const ARCHIVE_MIN_GAP_S = 300;

export async function archiveEventPayloads(env, opts) {
  const o = opts || {};
  const days = typeof o.days === 'number' ? o.days : ARCHIVE_DAYS;
  const batch = typeof o.batch === 'number' ? o.batch : ARCHIVE_BATCH;
  if (!env || !env.LEDGER || !env.R2) return { ok: false, reason: 'missing LEDGER or R2 binding' };
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await env.LEDGER.prepare(
    `SELECT id, request_json, response_json, r2_request_key, r2_response_key
     FROM events
     WHERE (request_json IS NOT NULL OR response_json IS NOT NULL) AND ts < ?
     ORDER BY ts LIMIT ?`
  ).bind(cutoff, batch).all();
  const list = (rows && rows.results) || [];
  let archived = 0;
  for (const r of list) {
    let r2Req = r.r2_request_key;
    let r2Res = r.r2_response_key;
    try {
      if (r.request_json != null) {
        r2Req = r2Req || `events/${r.id}.req.json`;
        await env.R2.put(r2Req, r.request_json);
      }
      if (r.response_json != null) {
        r2Res = r2Res || `events/${r.id}.res.txt`;
        await env.R2.put(r2Res, r.response_json);
      }
      await env.LEDGER.prepare(
        `UPDATE events SET request_json = NULL, response_json = NULL,
         r2_request_key = ?, r2_response_key = ? WHERE id = ?`
      ).bind(r2Req, r2Res, r.id).run();
      archived++;
    } catch {
      // R2 put failed for this row — leave the payload in D1, try again next tick.
    }
  }
  return { ok: true, cutoff, scanned: list.length, archived, drained: list.length < batch };
}

// KV-throttled tick: safe to call from any hot handler via waitUntil. Runs the
// batch at most once per ARCHIVE_MIN_GAP_S regardless of how often it is invoked.
export async function archiveTick(env) {
  try {
    if (!env || !env.KV) return null;
    const now = Math.floor(Date.now() / 1000);
    const last = parseInt(await env.KV.get('ledger_archive_last_run') || '0', 10);
    if (now - last < ARCHIVE_MIN_GAP_S) return null;
    await env.KV.put('ledger_archive_last_run', String(now));
    return await archiveEventPayloads(env, {});
  } catch {
    return null;
  }
}

export async function readEventFull(env, id) {
  if (!env || !env.LEDGER) return null;
  const row = await env.LEDGER.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!row) return null;
  let request_json = row.request_json;
  let response_json = row.response_json;
  if (!request_json && row.r2_request_key && env.R2) {
    try { const obj = await env.R2.get(row.r2_request_key); if (obj) request_json = await obj.text(); } catch {}
  }
  if (!response_json && row.r2_response_key && env.R2) {
    try { const obj = await env.R2.get(row.r2_response_key); if (obj) response_json = await obj.text(); } catch {}
  }
  return { ...row, request_json, response_json };
}
