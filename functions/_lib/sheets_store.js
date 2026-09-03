// sheets_store — the stored-grid engine behind /api/sheets (WT-0092).
//
// One user sheet = one row in user_sheets + sparse cells in sheet_cells addressed exactly
// like Google Sheets: A1 notation, 1-based, column A = c=1. This module owns the A1 math,
// the value reads/writes, the dimension operations (insert/delete/move rows and columns),
// and the model-run lane, which builds one invoke spec per grid row and sends the whole
// batch through invokeJSON — the same engine as POST /api/invoke, hard timeout included.
//
// D1 constraints honored here:
// - writes are batches of SINGLE-ROW statements (multi-row VALUES lists hit the bind cap)
// - row/column shifts use a two-step sign flip so a PK (sheet_id,r,c) never collides mid-UPDATE

import { invokeJSON } from './invoke_json.js';
import { buildNowIso } from './build_time.js';

// ── the durable object lane ───────────────────────────────────────────────────────────────
// Every sheet has one object that is its single writer. Writes go there so a value past the
// inline cap spills to R2 instead of bloating the row, and so anyone watching the sheet is
// pushed the change. Reads come back from that object's local SQLite once it holds the sheet —
// no network hop to a table shared with every other sheet in the build.
//
// A sheet moves in the first time it is touched: `adopt` copies its cells out of D1, once.
// The object writes through to D1 on every write, so the exports, the widgets and anything
// else still reading the table keep seeing exactly what they saw before. If the binding is
// absent or the object is unreachable, every path below falls back to D1 unchanged — the
// grid never depends on the object being up.

const adopted = new Set();

async function doFetch(env, sheetId, op, body) {
  if (!env.SHEET_DO || !sheetId) return null;
  try {
    const stub = env.SHEET_DO.get(env.SHEET_DO.idFromName(sheetId));
    const res = await stub.fetch('https://sheet-do/do/' + sheetId + '?op=' + op, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sheet_id: sheetId, ...(body || {}) }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Returns true once this object holds the sheet. Adoption is attempted at most once per
// isolate per sheet; a failure simply means this request uses D1.
async function ensureAdopted(env, sheetId) {
  if (!env.SHEET_DO || !sheetId) return false;
  if (adopted.has(sheetId)) return true;
  const ping = await doFetch(env, sheetId, 'ping', {});
  if (!ping || !ping.ok) return false;
  if (Number(ping.cells || 0) > 0) { adopted.add(sheetId); return true; }
  const got = await doFetch(env, sheetId, 'adopt', {});
  if (got && got.ok) { adopted.add(sheetId); return true; }
  return false;
}

import { isFormula, evaluate, referencesOf, MAX_FANOUT } from './sheet_formula.js';

export const MAX_ROWS = 100000;
export const MAX_COLS = 104; // A..CZ — twice Google Sheets' default 26, before Insert grows it
export const MAX_RUN_ROWS_PER_CALL = 20;

// ── A1 math ───────────────────────────────────────────────────────────────────────────────

export function colToLetter(n) {
  let s = '';
  let x = Number(n);
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || 'A';
}

export function letterToCol(s) {
  const t = String(s || '').trim().toUpperCase();
  if (!/^[A-Z]+$/.test(t)) return null;
  let n = 0;
  for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// 'B3' -> {r:3, c:2}. Bare column ('B') and bare row ('3') return partial refs.
export function parseCellRef(ref) {
  const m = String(ref || '').trim().toUpperCase().match(/^([A-Z]*)(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  const c = m[1] ? letterToCol(m[1]) : null;
  const r = m[2] ? parseInt(m[2], 10) : null;
  if (m[1] && c == null) return null;
  if (m[2] && (!Number.isFinite(r) || r < 1)) return null;
  return { r, c };
}

// 'A1', 'A1:C10', 'B:D' (whole columns), '2:5' (whole rows) -> {r1,c1,r2,c2}
// with nulls where the range is open (resolved against the used range by callers).
export function parseRange(range) {
  const parts = String(range || '').trim().split(':');
  if (!parts[0]) return null;
  const a = parseCellRef(parts[0]);
  if (!a) return null;
  const b = parts.length > 1 ? parseCellRef(parts[1]) : a;
  if (!b) return null;
  const out = {
    r1: a.r != null && b.r != null ? Math.min(a.r, b.r) : (a.r ?? b.r ?? null),
    r2: a.r != null && b.r != null ? Math.max(a.r, b.r) : (a.r != null && b.r != null ? null : (parts.length > 1 ? null : a.r)),
    c1: a.c != null && b.c != null ? Math.min(a.c, b.c) : (a.c ?? b.c ?? null),
    c2: a.c != null && b.c != null ? Math.max(a.c, b.c) : (a.c != null && b.c != null ? null : (parts.length > 1 ? null : a.c)),
  };
  // single ref 'A1' -> both ends that cell; 'B:D' -> rows open; '2:5' -> cols open
  if (parts.length === 1) { out.r2 = out.r1; out.c2 = out.c1; }
  if (out.r1 == null && out.c1 == null) return null;
  return out;
}

export function rangeToA1(r1, c1, r2, c2) {
  const a = colToLetter(c1) + r1;
  const b = colToLetter(c2) + r2;
  return a === b ? a : a + ':' + b;
}

// ── sheet CRUD ────────────────────────────────────────────────────────────────────────────

function newId() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'sh_' + s;
}

export async function listSheets(env) {
  const r = await env.DB.prepare(
    'SELECT s.id, s.title, s.rows, s.cols, s.created_at, s.updated_at, ' +
    '(SELECT COUNT(*) FROM sheet_cells sc WHERE sc.sheet_id = s.id) AS cell_count ' +
    // sort_order first: the tab list is an operating surface, and the sheet the owner works from
    // has to sit at the front regardless of when it was created (migration 0371).
    'FROM user_sheets s ORDER BY s.sort_order ASC, s.created_at ASC',
  ).all();
  return r.results || [];
}

export async function getSheet(env, id) {
  const row = await env.DB.prepare('SELECT * FROM user_sheets WHERE id = ?').bind(id).first();
  if (!row) return null;
  const used = await env.DB.prepare(
    'SELECT MAX(r) AS max_r, MAX(c) AS max_c, COUNT(*) AS n FROM sheet_cells WHERE sheet_id = ?',
  ).bind(id).first();
  return {
    ...row,
    col_meta: safeJson(row.col_meta, {}),
    used_rows: Number(used?.max_r || 0),
    used_cols: Number(used?.max_c || 0),
    cell_count: Number(used?.n || 0),
  };
}

export async function createSheet(env, { title, rows, cols } = {}, actor) {
  const id = newId();
  const ts = buildNowIso();
  await env.DB.prepare(
    'INSERT INTO user_sheets (id, title, rows, cols, col_meta, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
  ).bind(
    id, String(title || 'Untitled sheet').slice(0, 120),
    clampInt(rows, 1, MAX_ROWS, 1000), clampInt(cols, 1, MAX_COLS, 26),
    JSON.stringify({ created_by: actor || 'admin' }), ts, ts,
  ).run();
  return getSheet(env, id);
}

export async function patchSheet(env, id, b = {}) {
  const cur = await getSheet(env, id);
  if (!cur) return null;
  const ts = buildNowIso();
  const title = b.title != null ? String(b.title).slice(0, 120) : cur.title;
  const rows = b.rows != null ? clampInt(b.rows, Math.max(1, cur.used_rows), MAX_ROWS, cur.rows) : cur.rows;
  const cols = b.cols != null ? clampInt(b.cols, Math.max(1, cur.used_cols), MAX_COLS, cur.cols) : cur.cols;
  const colMeta = b.col_meta != null ? JSON.stringify(b.col_meta).slice(0, 40000) : JSON.stringify(cur.col_meta);
  const sortOrder = b.sort_order != null
    ? clampInt(b.sort_order, 0, 9999, cur.sort_order == null ? 100 : cur.sort_order)
    : (cur.sort_order == null ? 100 : cur.sort_order);
  await env.DB.prepare(
    'UPDATE user_sheets SET title=?, rows=?, cols=?, col_meta=?, sort_order=?, updated_at=? WHERE id=?',
  ).bind(title, rows, cols, colMeta, sortOrder, ts, id).run();
  return getSheet(env, id);
}

export async function deleteSheet(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sheet_cells WHERE sheet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM sheet_run_configs WHERE sheet_id = ?').bind(id),
    env.DB.prepare('DELETE FROM user_sheets WHERE id = ?').bind(id),
  ]);
  return { ok: true, id };
}

// ── values ────────────────────────────────────────────────────────────────────────────────

// Resolve an open range ('B:D', '2:5') against the sheet's used extent.
function boundRange(range, sheet) {
  const r1 = range.r1 ?? 1;
  const c1 = range.c1 ?? 1;
  const r2 = range.r2 ?? Math.max(sheet.used_rows, r1);
  const c2 = range.c2 ?? Math.max(sheet.used_cols, c1);
  return {
    r1: Math.max(1, r1), c1: Math.max(1, c1),
    r2: Math.min(Math.max(r1, r2), MAX_ROWS), c2: Math.min(Math.max(c1, c2), MAX_COLS),
  };
}

export async function getValues(env, sheet, rangeStr) {
  const parsed = parseRange(rangeStr);
  if (!parsed) return { error: 'bad_range', range: rangeStr };
  const R = boundRange(parsed, sheet);
  const values = [];
  for (let r = R.r1; r <= R.r2; r++) values.push(new Array(R.c2 - R.c1 + 1).fill(''));

  if (await ensureAdopted(env, sheet.id)) {
    const got = await doFetch(env, sheet.id, 'read', { r1: R.r1, c1: R.c1, r2: R.r2, c2: R.c2 });
    if (got && got.ok) {
      for (const cell of (got.cells || [])) {
        values[cell.r - R.r1][cell.c - R.c1] = cell.value == null ? '' : String(cell.value);
      }
      return { range: rangeToA1(R.r1, R.c1, R.r2, R.c2), values };
    }
  }

  const q = await env.DB.prepare(
    'SELECT r, c, value FROM sheet_cells WHERE sheet_id=? AND r>=? AND r<=? AND c>=? AND c<=? ORDER BY r, c',
  ).bind(sheet.id, R.r1, R.r2, R.c1, R.c2).all();
  for (const row of (q.results || [])) {
    values[row.r - R.r1][row.c - R.c1] = row.value == null ? '' : String(row.value);
  }
  return { range: rangeToA1(R.r1, R.c1, R.r2, R.c2), values };
}

// Write a 2D array anchored at the range's top-left. Empty string clears the cell (Sheets
// semantics). Returns the count written/cleared. Single-row statements, batched.
// ── the evaluation context ───────────────────────────────────────────────────────────────────
// Everything a formula can reach, in one place. dispatch is imported only when a formula calls
// it, so the module graph stays acyclic and a sheet with no formulas pays nothing.
function evalContext(env, sheet, actor) {
  return {
    async readCell(r, c) {
      const row = await env.DB.prepare(
        'SELECT value FROM sheet_cells WHERE sheet_id=? AND r=? AND c=?',
      ).bind(sheet.id, r, c).first();
      return row ? String(row.value == null ? '' : row.value) : '';
    },
    async dispatch(key, body) {
      const { dispatch } = await import('../api/dispatch.js');
      const out = await dispatch(env, key, body, { actor: actor || 'formula', noLog: false });
      const res = out && typeof out.result === 'string' ? out.result : JSON.stringify(out && out.result);
      return String(res == null ? '' : res).slice(0, 4000);
    },
    async query(sql) {
      if (!/^\s*(select|with)\b/i.test(String(sql || ''))) return [];
      const q = await env.DB.prepare(String(sql)).all();
      return q.results || [];
    },
    async search(q, limit) {
      const { searchCorpus } = await import('./sheet_search.js');
      return searchCorpus(env, q, limit);
    },
    // A cell that calls a model with the envelope written beside it. The envelope is the whole
    // REST request — method, url, headers, body — so what the sheet shows is what goes down the
    // wire, with only the credential swapped in at the last moment (KEY_BY_HOST in agent_sheet).
    //
    // The answer is cached on a hash of what was actually sent. Status and payload are two
    // cells asking the same question, and a model call costs money: without this, every recalc
    // of either one would buy the same answer again.
    async llm(requestJson, message, want) {
      let envelope;
      try { envelope = JSON.parse(String(requestJson || '')); } catch { return '#BAD_REQUEST_JSON'; }
      if (!envelope || typeof envelope !== 'object' || !envelope.url) return '#NO_URL';
      const msg = String(message == null ? '' : message);
      const key = 'sheet_llm:' + (await sha256Hex(JSON.stringify(envelope) + '\u0000' + msg));
      let out = null;
      if (env.KV) {
        try { const hit = await env.KV.get(key, 'json'); if (hit) out = hit; } catch {}
      }
      if (!out) {
        const { callModel } = await import('./agent_sheet.js');
        // {{INPUT}} is the documented hole for the message. An envelope without one still works:
        // the message replaces the last user turn, which is what a person means by "ask it this".
        const hasHole = JSON.stringify(envelope).includes('{{INPUT}}');
        if (!hasHole && envelope.body && Array.isArray(envelope.body.messages)) {
          const msgs = envelope.body.messages;
          let i = -1;
          for (let k = msgs.length - 1; k >= 0; k -= 1) if (msgs[k] && msgs[k].role === 'user') { i = k; break; }
          if (i >= 0) msgs[i] = { ...msgs[i], content: '{{INPUT}}' };
          else msgs.push({ role: 'user', content: '{{INPUT}}' });
        }
        const r = await callModel(env, envelope, { INPUT: msg, SYSTEM: '' });
        out = {
          status: r.status || 0,
          ms: r.ms || 0,
          ok: !!r.ok,
          error: r.error || '',
          text: String(r.text || ''),
          payload: r.payload == null ? null : r.payload,
        };
        if (env.KV) { try { await env.KV.put(key, JSON.stringify(out), { expirationTtl: 900 }); } catch {} }
      }
      const w = String(want || '').trim().toLowerCase();
      if (w === 'status') return out.error ? String(out.status || 0) + ' ' + out.error : String(out.status || 0);
      if (w === 'text' || w === 'reply') return out.text;
      if (w === 'ms') return String(out.ms || 0);
      return JSON.stringify(out.payload == null ? { error: out.error || 'no payload' } : out.payload, null, 2);
    },
  };
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Append-only lineage. The value a cell holds now is the newest version; nothing is overwritten,
// which is what lets a value be walked back to the turn that set it — and what lets two agents
// disagree about one address with both positions surviving.
async function appendVersion(env, sheet, r, c, value, formula, actor, trace) {
  try {
    const prev = await env.DB.prepare(
      'SELECT version, hash FROM sheet_cell_versions WHERE sheet_id=? AND r=? AND c=? ORDER BY version DESC LIMIT 1',
    ).bind(sheet.id, r, c).first();
    const version = (prev && Number(prev.version) || 0) + 1;
    const prevHash = (prev && prev.hash) || 'genesis';
    const ts = buildNowIso();
    const payload = [prevHash, sheet.id, r, c, version, String(value == null ? '' : value), String(formula || ''), actor || '', ts].join('\u241f');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare(
      'INSERT INTO sheet_cell_versions (sheet_id, r, c, version, value, formula, actor, ts, cause_trace, prev_hash, hash) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).bind(sheet.id, r, c, version, String(value == null ? '' : value).slice(0, 100000),
           formula ? String(formula).slice(0, 4000) : null, actor || 'admin', ts,
           trace || null, prevHash, hash).run();
    return version;
  } catch { return 0; }
}

// The version stack behind one address, newest first, with the turn that caused each value.
export async function cellHistory(env, sheetId, r, c, limit = 50) {
  const q = await env.DB.prepare(
    'SELECT version, value, formula, actor, ts, cause_trace, prev_hash, hash ' +
    'FROM sheet_cell_versions WHERE sheet_id=? AND r=? AND c=? ORDER BY version DESC LIMIT ?',
  ).bind(sheetId, r, c, Math.max(1, Math.min(500, limit))).all();
  return q.results || [];
}

// Everything that reads a written address, re-evaluated. The dependency edge is read out of the
// formula text, so nothing has to be declared and a fill-down needs no wiring.
async function recalcDependents(env, sheet, changed, actor, trace, depth = 0) {
  if (depth > 3 || !changed.length) return 0;
  // Read the expressions from the version store, not from the mirrored column. The append-only
  // history is written on every path and is therefore the only place guaranteed to hold them:
  // the object mirrors values and has no notion of a formula, which left sheet_cells.formula
  // empty and every dependent silently stale (measured 2026-09-02).
  const q = await env.DB.prepare(
    'SELECT v.r AS r, v.c AS c, v.formula AS formula FROM sheet_cell_versions v ' +
    'JOIN (SELECT r, c, MAX(version) AS mv FROM sheet_cell_versions WHERE sheet_id=? GROUP BY r, c) m ' +
    '  ON v.r = m.r AND v.c = m.c AND v.version = m.mv ' +
    'WHERE v.sheet_id = ? AND v.formula IS NOT NULL LIMIT ?',
  ).bind(sheet.id, sheet.id, MAX_FANOUT).all();
  const rows = q.results || [];
  if (!rows.length) return 0;
  const touched = new Set(changed.map(([r, c]) => r + ':' + c));
  const ctx = evalContext(env, sheet, actor);
  const next = [];
  const recomputed = [];
  let n = 0;
  for (const row of rows) {
    const key = row.r + ':' + row.c;
    if (touched.has(key)) continue;                       // never recompute what was just set
    const reads = referencesOf(row.formula);
    if (!reads.some((x) => touched.has(x.r + ':' + x.c))) continue;
    const value = await evaluate(row.formula, ctx);
    await env.DB.prepare(
      'INSERT INTO sheet_cells (sheet_id, r, c, value, formula, updated_at, updated_by) VALUES (?,?,?,?,?,?,?) ' +
      'ON CONFLICT(sheet_id, r, c) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by',
    ).bind(sheet.id, row.r, row.c, String(value).slice(0, 100000), row.formula, buildNowIso(), 'recalc').run();
    recomputed.push([row.r, row.c, String(value)]);
    await appendVersion(env, sheet, row.r, row.c, value, row.formula, 'recalc', trace);
    next.push([row.r, row.c]);
    n++;
  }
  // Through the object as well as D1. The object is the authoritative reader for a sheet it
  // holds, so a recalculated value written only to the mirror is invisible: BM6 kept reporting
  // 75 while D1 already said 21 (measured 2026-09-02). Every write path has to go through the
  // single writer or the grid disagrees with itself.
  if (recomputed.length && await ensureAdopted(env, sheet.id)) {
    await doFetch(env, sheet.id, 'write', { cells: recomputed, actor: 'recalc' });
  }
  if (next.length) n += await recalcDependents(env, sheet, next, actor, trace, depth + 1);
  return n;
}

export async function setValues(env, sheet, rangeStr, values, actor) {
  const parsed = parseRange(rangeStr);
  if (!parsed) return { error: 'bad_range', range: rangeStr };
  if (!Array.isArray(values) || !values.length) return { error: 'values_must_be_2d_array' };
  const r1 = parsed.r1 ?? 1;
  const c1 = parsed.c1 ?? 1;
  const ts = buildNowIso();
  const stmts = [];
  const doCells = [];    // value writes, sent to the object when it holds this sheet
  const clearStmts = []; // deletes stay on D1 either way: the object stores presence, not absence
  let written = 0;
  let cleared = 0;
  let maxR = 0;
  let maxC = 0;
  const versioned = [];   // every address this write touched, for lineage and recalculation
  for (let i = 0; i < values.length; i++) {
    const rowArr = Array.isArray(values[i]) ? values[i] : [values[i]];
    for (let j = 0; j < rowArr.length; j++) {
      const r = r1 + i;
      const c = c1 + j;
      if (r > MAX_ROWS || c > MAX_COLS) continue;
      const v = rowArr[j];
      if (v == null || v === '') {
        const del = env.DB.prepare('DELETE FROM sheet_cells WHERE sheet_id=? AND r=? AND c=?').bind(sheet.id, r, c);
        stmts.push(del);
        clearStmts.push(del);
        doCells.push([r, c, '']);
        cleared++;
      } else {
        // A leading = makes the text an expression. The computed answer goes in `value` so every
        // reader that already exists keeps seeing a plain value; the expression is kept beside it
        // so the cell can be recomputed when what it reads changes.
        const raw = String(v);
        const formula = isFormula(raw) ? raw : null;
        const stored = formula ? await evaluate(formula, evalContext(env, sheet, actor)) : raw;
        stmts.push(env.DB.prepare(
          'INSERT INTO sheet_cells (sheet_id, r, c, value, formula, updated_at, updated_by) VALUES (?,?,?,?,?,?,?) ' +
          'ON CONFLICT(sheet_id, r, c) DO UPDATE SET value=excluded.value, formula=excluded.formula, updated_at=excluded.updated_at, updated_by=excluded.updated_by',
        ).bind(sheet.id, r, c, String(stored).slice(0, 100000), formula, ts, actor || 'admin'));
        doCells.push([r, c, String(stored)]);
        versioned.push([r, c, String(stored), formula]);
        written++;
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
      if (stmts.length >= 400) break;
    }
    if (stmts.length >= 400) break;
  }
  if (!stmts.length) return { error: 'empty_write' };
  const totalCells = values.reduce((a, row) => a + (Array.isArray(row) ? row.length : 1), 0);
  const truncated = totalCells > stmts.length ? totalCells - stmts.length : 0;

  // Through the object when it holds this sheet: it is the single writer, it spills anything
  // oversized to R2, it mirrors to D1, and it pushes the change to whoever is watching.
  let viaDo = false;
  if (doCells.length && await ensureAdopted(env, sheet.id)) {
    const res = await doFetch(env, sheet.id, 'write', { cells: doCells, actor: actor || 'admin' });
    viaDo = !!(res && res.ok);
  }
  if (!viaDo) await runChunkedBatch(env, stmts);
  else if (clearStmts.length) await runChunkedBatch(env, clearStmts);
  // The object is the single writer for values and mirrors them to D1, but it has no notion of a
  // formula — so on that path the expression never reached the column that recalculation reads,
  // and a dependent cell silently never updated (measured 2026-09-02: BM6 stayed at 30 after its
  // input changed to 25). The expression is written directly for exactly the cells that carry one.
  if (viaDo) {
    const withFormula = versioned.filter(([, , , f]) => f);
    for (const [r, c, value, formula] of withFormula) {
      try {
        await env.DB.prepare(
          'INSERT INTO sheet_cells (sheet_id, r, c, value, formula, updated_at, updated_by) VALUES (?,?,?,?,?,?,?) ' +
          'ON CONFLICT(sheet_id, r, c) DO UPDATE SET formula=excluded.formula, updated_at=excluded.updated_at',
        ).bind(sheet.id, r, c, String(value).slice(0, 100000), String(formula).slice(0, 4000), ts, actor || 'admin').run();
      } catch { /* the value is already stored; a missing expression only costs reactivity */ }
    }
  }
  // Grow the declared grid if a write landed beyond it.
  if (maxR > sheet.rows || maxC > sheet.cols) {
    await env.DB.prepare('UPDATE user_sheets SET rows=MAX(rows,?), cols=MAX(cols,?), updated_at=? WHERE id=?')
      .bind(Math.min(maxR, MAX_ROWS), Math.min(maxC, MAX_COLS), ts, sheet.id).run();
  } else {
    await env.DB.prepare('UPDATE user_sheets SET updated_at=? WHERE id=?').bind(ts, sheet.id).run();
  }
  // A formula written in the same call as the cell it reads was evaluated before that cell
  // existed, because the batch executes after the loop. One second pass over the formulas from
  // this write fixes the intra-write order: BP3 =SEARCHCOUNT(BP2) returned 0 while BP2 already
  // said "durable objects" (measured 2026-09-02).
  const formulaCells = versioned.filter(([, , , f]) => f);
  if (formulaCells.length > 1) {
    const ctx2 = evalContext(env, sheet, actor);
    const redone = [];
    for (const entry of formulaCells) {
      const [r, c, prevValue, formula] = entry;
      const fresh = await evaluate(formula, ctx2);
      if (String(fresh) === String(prevValue)) continue;
      await env.DB.prepare(
        'INSERT INTO sheet_cells (sheet_id, r, c, value, formula, updated_at, updated_by) VALUES (?,?,?,?,?,?,?) ' +
        'ON CONFLICT(sheet_id, r, c) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at',
      ).bind(sheet.id, r, c, String(fresh).slice(0, 100000), formula, ts, actor || 'admin').run();
      entry[2] = String(fresh);
      redone.push([r, c, String(fresh)]);
    }
    if (redone.length && await ensureAdopted(env, sheet.id)) {
      await doFetch(env, sheet.id, 'write', { cells: redone, actor: actor || 'admin' });
    }
  }

  // Lineage, then reaction. Both happen after the value has landed so a failure in either can
  // never lose the write itself.
  let versions = 0;
  for (const [r, c, value, formula] of versioned) {
    if (await appendVersion(env, sheet, r, c, value, formula, actor, null)) versions++;
  }
  let recalculated = 0;
  if (versioned.length) {
    try { recalculated = await recalcDependents(env, sheet, versioned.map(([r, c]) => [r, c]), actor, null); }
    catch { recalculated = 0; }
  }

  return {
    ok: true, written, cleared, anchored_at: colToLetter(c1) + r1,
    ...(versions ? { versions } : {}),
    ...(recalculated ? { recalculated } : {}),
    ...(truncated ? { truncated, how_to_fix: 'a single write caps at 400 cells — send the rest in another PUT' } : {}),
  };
}

export async function appendValues(env, sheet, values, actor) {
  const startRow = (sheet.used_rows || 0) + 1;
  return setValues(env, sheet, 'A' + startRow, values, actor);
}

export async function clearRange(env, sheet, rangeStr) {
  const parsed = parseRange(rangeStr);
  if (!parsed) return { error: 'bad_range', range: rangeStr };
  const R = boundRange(parsed, sheet);
  const res = await env.DB.prepare(
    'DELETE FROM sheet_cells WHERE sheet_id=? AND r>=? AND r<=? AND c>=? AND c<=?',
  ).bind(sheet.id, R.r1, R.r2, R.c1, R.c2).run();
  if (env.SHEET_DO) {
    adopted.delete(sheet.id);
    await doFetch(env, sheet.id, 'reset', {});
    adopted.add(sheet.id);
  }
  return { ok: true, range: rangeToA1(R.r1, R.c1, R.r2, R.c2), cleared: res.meta?.changes ?? null };
}

// ── dimension operations (batchUpdate) ───────────────────────────────────────────────────
// requests: [{op:'insert_rows', at, n}, {op:'delete_rows', at, n}, {op:'insert_cols', at, n},
//            {op:'delete_cols', at, n}, {op:'move_col', from, to}, {op:'move_row', from, to}]
// Shifts use the two-step sign flip: SET x = -(x+d) for the moving band, then SET x = -x —
// a straight UPDATE x = x+1 can collide with an existing PK mid-statement.

async function shiftDim(env, id, dim, at, delta) {
  const col = dim === 'r' ? 'r' : 'c';
  await env.DB.prepare(
    `UPDATE sheet_cells SET ${col} = -(${col} + ?) WHERE sheet_id=? AND ${col} >= ?`,
  ).bind(delta, id, at).run();
  await env.DB.prepare(
    `UPDATE sheet_cells SET ${col} = -${col} WHERE sheet_id=? AND ${col} < 0`,
  ).bind(id).run();
}

export async function batchOps(env, sheet, requests) {
  if (!Array.isArray(requests) || !requests.length) return { error: 'requests_required' };
  const done = [];
  for (const q of requests.slice(0, 20)) {
    const op = String(q.op || '');
    const at = clampInt(q.at, 1, MAX_ROWS, 1);
    const n = clampInt(q.n, 1, 1000, 1);
    if (op === 'insert_rows') {
      await shiftDim(env, sheet.id, 'r', at, n);
      await env.DB.prepare('UPDATE user_sheets SET rows=MIN(rows+?, ?), updated_at=? WHERE id=?')
        .bind(n, MAX_ROWS, buildNowIso(), sheet.id).run();
    } else if (op === 'delete_rows') {
      await env.DB.prepare('DELETE FROM sheet_cells WHERE sheet_id=? AND r>=? AND r<?').bind(sheet.id, at, at + n).run();
      await shiftDim(env, sheet.id, 'r', at + n, -n);
      await env.DB.prepare('UPDATE user_sheets SET rows=MAX(1, rows-?), updated_at=? WHERE id=?')
        .bind(n, buildNowIso(), sheet.id).run();
    } else if (op === 'insert_cols') {
      await shiftDim(env, sheet.id, 'c', at, n);
      await env.DB.prepare('UPDATE user_sheets SET cols=MIN(cols+?, ?), updated_at=? WHERE id=?')
        .bind(n, MAX_COLS, buildNowIso(), sheet.id).run();
    } else if (op === 'delete_cols') {
      await env.DB.prepare('DELETE FROM sheet_cells WHERE sheet_id=? AND c>=? AND c<?').bind(sheet.id, at, at + n).run();
      await shiftDim(env, sheet.id, 'c', at + n, -n);
      await env.DB.prepare('UPDATE user_sheets SET cols=MAX(1, cols-?), updated_at=? WHERE id=?')
        .bind(n, buildNowIso(), sheet.id).run();
    } else if (op === 'move_col' || op === 'move_row') {
      const dim = op === 'move_col' ? 'c' : 'r';
      const from = clampInt(q.from, 1, MAX_ROWS, 1);
      const to = clampInt(q.to, 1, MAX_ROWS, 1);
      if (from !== to) {
        const col = dim;
        // park the moving line at 0 (never a valid index), close the gap, open the slot, land it
        await env.DB.prepare(`UPDATE sheet_cells SET ${col} = 0 WHERE sheet_id=? AND ${col} = ?`).bind(sheet.id, from).run();
        await shiftDim(env, sheet.id, dim, from + 1, -1);
        await shiftDim(env, sheet.id, dim, to, 1);
        await env.DB.prepare(`UPDATE sheet_cells SET ${col} = ? WHERE sheet_id=? AND ${col} = 0`).bind(to, sheet.id).run();
      }
    } else {
      return { error: 'unknown_op', op, done };
    }
    done.push(op);
  }
  // Addresses moved in D1; the object's copy is now wrong at those coordinates. Drop it and
  // reload rather than trying to replay the shift.
  if (env.SHEET_DO) {
    adopted.delete(sheet.id);
    await doFetch(env, sheet.id, 'reset', {});
    adopted.add(sheet.id);
  }
  return { ok: true, applied: done };
}

// ── run configs ───────────────────────────────────────────────────────────────────────────

export async function listRunConfigs(env, sheetId) {
  const r = await env.DB.prepare(
    'SELECT id, sheet_id, name, config, created_at, updated_at FROM sheet_run_configs WHERE sheet_id=? ORDER BY created_at ASC',
  ).bind(sheetId).all();
  return (r.results || []).map((row) => ({ ...row, config: safeJson(row.config, {}) }));
}

export async function saveRunConfig(env, sheetId, { id, name, config } = {}) {
  const ts = buildNowIso();
  if (id) {
    await env.DB.prepare('UPDATE sheet_run_configs SET name=?, config=?, updated_at=? WHERE id=? AND sheet_id=?')
      .bind(String(name || 'config'), JSON.stringify(config || {}), ts, id, sheetId).run();
    return { ok: true, id };
  }
  const rid = 'rc_' + Math.random().toString(36).slice(2, 10);
  await env.DB.prepare(
    'INSERT INTO sheet_run_configs (id, sheet_id, name, config, created_at, updated_at) VALUES (?,?,?,?,?,?)',
  ).bind(rid, sheetId, String(name || 'config'), JSON.stringify(config || {}), ts, ts).run();
  return { ok: true, id: rid };
}

export async function deleteRunConfig(env, sheetId, id) {
  await env.DB.prepare('DELETE FROM sheet_run_configs WHERE id=? AND sheet_id=?').bind(id, sheetId).run();
  return { ok: true, id };
}

// ── the model-run lane ────────────────────────────────────────────────────────────────────
// One call runs up to MAX_RUN_ROWS_PER_CALL grid rows. Per row it builds one invoke spec:
//   template mode: prompt template with {{A}}..{{ZZ}} and {{input}} substituted from that row
//   raw mode: the input column's cell IS the spec — a full /api/invoke call object as JSON
// The batch goes through invokeJSON in ONE round trip (model-call law 2.2), then per row:
//   request_col <- the exact spec sent, response_col <- the raw per-call result envelope,
//   text_col <- the reply text (or ERROR: <named error>).
// shape:true builds and writes the specs without sending anything.

const SPEC_FIELDS = [
  'key', 'model', 'system', 'memory', 'includes', 'input', 'messages', 'vars',
  'temperature', 'max_tokens', 'top_p', 'top_k', 'seed', 'stop', 'n', 'json', 'timeout_ms',
  'presence_penalty', 'frequency_penalty', 'repetition_penalty',
];

function pickSpecFields(obj) {
  const out = {};
  for (const f of SPEC_FIELDS) if (obj[f] !== undefined && obj[f] !== null && obj[f] !== '') out[f] = obj[f];
  return out;
}

function substituteTokens(template, rowVals) {
  return String(template || '').replace(/\{\{\s*([A-Za-z]{1,2}|input)\s*\}\}/g, (_, tok) => {
    if (tok === 'input') return rowVals.__input ?? '';
    const c = letterToCol(tok.toUpperCase());
    return c != null && rowVals[c] != null ? rowVals[c] : '';
  });
}

export async function runRows(env, sheet, config, rowNums, { shape = false, actor } = {}) {
  const cfg = config || {};
  const rows = (Array.isArray(rowNums) ? rowNums : []).map((n) => clampInt(n, 1, MAX_ROWS, 0))
    .filter(Boolean).slice(0, MAX_RUN_ROWS_PER_CALL);
  if (!rows.length) return { error: 'rows_required', max_per_call: MAX_RUN_ROWS_PER_CALL };
  const inputCol = letterToCol(cfg.input_col || 'A');
  if (!inputCol) return { error: 'bad_input_col' };
  const requestCol = cfg.request_col ? letterToCol(cfg.request_col) : null;
  const responseCol = cfg.response_col ? letterToCol(cfg.response_col) : null;
  const textCol = cfg.text_col ? letterToCol(cfg.text_col) : null;
  if (!shape && !textCol && !responseCol) return { error: 'output_col_required', how_to_fix: 'set text_col and/or response_col' };

  // one query pulls every referenced row's cells
  const placeholders = rows.map(() => '?').join(',');
  const q = await env.DB.prepare(
    `SELECT r, c, value FROM sheet_cells WHERE sheet_id=? AND r IN (${placeholders})`,
  ).bind(sheet.id, ...rows).all();
  const byRow = {};
  for (const cell of (q.results || [])) {
    (byRow[cell.r] = byRow[cell.r] || {})[cell.c] = cell.value == null ? '' : String(cell.value);
  }

  const perRow = [];
  for (const r of rows) {
    const vals = byRow[r] || {};
    vals.__input = vals[inputCol] ?? '';
    let spec = null;
    let buildError = null;
    if (String(cfg.mode || 'template') === 'raw') {
      if (!vals.__input.trim()) buildError = 'empty_input_cell';
      else {
        try {
          const parsed = JSON.parse(vals.__input);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) buildError = 'raw_cell_not_an_object';
          else spec = pickSpecFields(parsed);
        } catch (e) { buildError = 'raw_cell_not_json: ' + String(e.message || e).slice(0, 120); }
      }
    } else {
      if (!vals.__input.trim() && !cfg.prompt) buildError = 'empty_input_cell';
      else {
        spec = pickSpecFields(cfg);
        delete spec.input;
        spec.input = cfg.prompt ? substituteTokens(cfg.prompt, vals) : vals.__input;
        if (cfg.system) spec.system = substituteTokens(cfg.system, vals);
      }
    }
    if (spec && !spec.timeout_ms) spec.timeout_ms = 25000; // a model call always carries a hard timeout
    if (spec) spec.label = 'r' + r;
    perRow.push({ r, spec, buildError });
  }

  const sendable = perRow.filter((p) => p.spec && !p.buildError);
  let out = null;
  if (!shape && sendable.length) {
    out = await invokeJSON(env, { calls: sendable.map((p) => p.spec) });
  }

  // write outputs back — one batch of single-cell writes
  const writes = [];
  const results = [];
  for (const p of perRow) {
    const rowResult = { row: p.r };
    if (p.buildError) {
      rowResult.ok = false;
      rowResult.error = p.buildError;
      if (textCol) writes.push([p.r, textCol, 'ERROR: ' + p.buildError]);
    } else {
      if (requestCol) writes.push([p.r, requestCol, JSON.stringify(p.spec)]);
      if (!shape) {
        const res = out?.results?.[sendable.indexOf(p)] || { ok: false, error: 'no_result' };
        rowResult.ok = !!res.ok;
        rowResult.model = res.model || null;
        rowResult.ms = res.ms || 0;
        if (responseCol) writes.push([p.r, responseCol, JSON.stringify(res)]);
        if (textCol) writes.push([p.r, textCol, res.ok ? String(res.text ?? '') : 'ERROR: ' + String(res.error || 'unknown')]);
      } else {
        rowResult.ok = true;
        rowResult.shaped = true;
      }
    }
    results.push(rowResult);
  }
  if (writes.length) {
    const ts = buildNowIso();
    const stmts = writes.map(([r, c, v]) => env.DB.prepare(
      'INSERT INTO sheet_cells (sheet_id, r, c, value, updated_at, updated_by) VALUES (?,?,?,?,?,?) ' +
      'ON CONFLICT(sheet_id, r, c) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by',
    ).bind(sheet.id, r, c, String(v).slice(0, 100000), ts, actor || 'sheet-run'));
    await runChunkedBatch(env, stmts);
    const maxC = Math.max(...writes.map((w) => w[1]));
    if (maxC > sheet.cols) {
      await env.DB.prepare('UPDATE user_sheets SET cols=MIN(?, ?), updated_at=? WHERE id=?')
        .bind(maxC, MAX_COLS, ts, sheet.id).run();
    }
  }
  return {
    ok: results.every((x) => x.ok),
    shape: !!shape,
    rows: results,
    cells_written: writes.length,
    ...(out ? { ms: out.ms, ok_count: out.ok_count, count: out.count } : {}),
  };
}

// ── CSV export ────────────────────────────────────────────────────────────────────────────

export async function exportCsv(env, sheet) {
  const q = await env.DB.prepare(
    'SELECT r, c, value FROM sheet_cells WHERE sheet_id=? ORDER BY r, c',
  ).bind(sheet.id).all();
  const maxR = sheet.used_rows || 0;
  const maxC = sheet.used_cols || 0;
  const grid = [];
  for (let r = 0; r < maxR; r++) grid.push(new Array(maxC).fill(''));
  for (const cell of (q.results || [])) grid[cell.r - 1][cell.c - 1] = cell.value == null ? '' : String(cell.value);
  const csv = grid.map((row) => row.map((v) => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\r\n');
  return csv;
}

// ── helpers ───────────────────────────────────────────────────────────────────────────────

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function safeJson(s, dflt) {
  try { return s ? JSON.parse(s) : dflt; } catch { return dflt; }
}

async function runChunkedBatch(env, stmts) {
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
  }
}
