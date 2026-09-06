
import { dispatch } from './dispatch.js';
import { logEvent } from '../_lib/event_log.js';

const DEFAULT_SHEET = '<GOOGLE_SHEET_ID>';
const DEFAULT_TAB = 'OIP';
const MAX_PER_RUN = 25;      // one pass stays well inside a Worker's time budget
const CELL_LIMIT = 45000;    // a Sheets cell holds 50k; leave headroom rather than lose the answer

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function authorized(request, env) {
  const key = request.headers.get('x-terminal-key') || '';
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (env.TERMINAL_KEY && (key === env.TERMINAL_KEY || bearer === env.TERMINAL_KEY)) return true;
  const cookie = request.headers.get('cookie') || '';
  return /(?:^|;\s*)admin=/.test(cookie);
}

// Three accepted forms, because a model will emit all three and refusing two would make the
// surface feel broken rather than strict. Returns null when the cell is not an invocation.
export function parseInvocation(cell) {
  const s = String(cell == null ? '' : cell).trim();
  if (!s) return null;
  const tag = s.match(/^\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\]$/);
  if (tag) return { key: tag[1], body: tag[2] };
  const pipe = s.match(/^([A-Z_][A-Z0-9_]*)\s*\|([\s\S]*)$/);
  if (pipe) return { key: pipe[1], body: pipe[2] };
  if (/^[A-Z_][A-Z0-9_]*$/.test(s)) return { key: s, body: '' };
  return null;
}

// Which rows are eligible. Pure, so the GET preview and the POST run can never disagree about
// what is queued — a preview that lies about the work is worse than no preview.
export function queuedRows(values, startRow = 2) {
  const out = [];
  for (let i = 0; i < (values || []).length; i += 1) {
    const row = values[i] || [];
    const spec = parseInvocation(row[0]);
    const state = String(row[1] == null ? '' : row[1]).trim();
    if (!spec || state) continue;
    out.push({ row: startRow + i, spec });
  }
  return out;
}

async function runner(env, action, args) {
  const out = await dispatch(env, 'APPS_SCRIPT_RUN', action + '|' + JSON.stringify(args), { actor: 'sheet-bridge' });
  const raw = typeof out?.result === 'string' ? out.result : JSON.stringify(out?.result);
  // The runner answers "HTTP 200:{...}"; the JSON after the prefix is the real payload.
  const body = String(raw || '').replace(/^HTTP\s+\d+:\s*/, '');
  try { return JSON.parse(body); } catch { return { ok: false, error: String(body).slice(0, 400) }; }
}

async function readTab(env, sheetId, tab, rows) {
  // The runner names the spreadsheet `sheet_id`, not `id`. Passing the wrong name silently fell
  // back to its default spreadsheet instead of erroring, which is the worst shape a wrong argument
  // can take: it works until the day you point it somewhere else.
  const got = await runner(env, 'sheets_get', { sheet_id: sheetId, tab, range: 'A2:B' + rows });
  if (!got || got.ok === false) return { ok: false, error: got?.error || 'sheets_get failed' };
  return { ok: true, values: Array.isArray(got.values) ? got.values : [] };
}

// One row's answer, written back across B..E so a reader sees the invocation and its result
// together. The range must span exactly as many columns as the array: setValues on a one-cell
// range with four values throws, and the first version of this swallowed that throw and reported
// a clean `ran:2` over a sheet where nothing had been written. A write that fails is returned, not
// discarded.
async function writeBack(env, sheetId, tab, row, cells) {
  const out = await runner(env, 'sheets_set_range', {
    sheet_id: sheetId, tab, range: 'B' + row + ':E' + row, values: [cells],
  });
  return { ok: out && out.ok !== false, error: out && out.error ? String(out.error).slice(0, 300) : '' };
}

function verdict(result, ran) {
  const payload = result == null ? '' : (typeof result === 'string' ? result : JSON.stringify(result));
  const ok = ran === true && !/^\s*ERR[:_]/i.test(payload);
  return { ok, payload: String(payload).slice(0, CELL_LIMIT) };
}

async function runQueue(env, sheetId, tab, limit) {
  const read = await readTab(env, sheetId, tab, 200);
  if (!read.ok) return { ok: false, error: read.error, tab };
  const queued = queuedRows(read.values).slice(0, Math.max(1, Math.min(MAX_PER_RUN, limit || MAX_PER_RUN)));
  if (!queued.length) return { ok: true, tab, ran: 0, note: 'nothing queued' };

  // Claim before running. Two overlapping passes must not fire the same invocation twice, and a
  // claim written first is the only thing that makes this safe to schedule on a short interval.
  // If the claim cannot be written, the queue is not run at all: firing invocations we cannot
  // record is worse than not firing them.
  for (const item of queued) {
    const claim = await writeBack(env, sheetId, tab, item.row, ['running', '', new Date().toISOString(), '']);
    if (!claim.ok) {
      return { ok: false, tab, sheet: sheetId, ran: 0, error: 'cannot write to the tab, so nothing was run: ' + claim.error };
    }
  }

  const results = [];
  for (const item of queued) {
    let out = null;
    let threw = null;
    try { out = await dispatch(env, item.spec.key, item.spec.body, { actor: 'sheet-bridge' }); }
    catch (e) { threw = String(e && e.message || e); }
    const v = threw ? { ok: false, payload: 'ERR:' + threw } : verdict(out?.result, out?.ran !== false);
    const wrote = await writeBack(env, sheetId, tab, item.row, [
      v.ok ? 'ok' : 'error',
      v.payload,
      new Date().toISOString(),
      String(out?.trace || ''),
    ]);
    results.push({
      row: item.row, key: item.spec.key, ok: v.ok, trace: out?.trace || null,
      written: wrote.ok, ...(wrote.ok ? {} : { write_error: wrote.error }),
    });
  }

  await logEvent(env, {
    source: 'sheets', key: 'SHEET_BRIDGE', action: 'run', direction: 'internal', status: 200,
    request: { sheet: sheetId, tab, queued: queued.length },
    response: { ran: results.length, results },
  }).catch(() => {});

  return { ok: true, tab, sheet: sheetId, ran: results.length, results };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sheetId = url.searchParams.get('sheet') || env.SHEET_BRIDGE_ID || DEFAULT_SHEET;
  const tab = url.searchParams.get('tab') || DEFAULT_TAB;
  const contract = {
    what: 'A Google Sheet tab is an invocation inbox: write what you want invoked in column A, read the answer in column C.',
    why: 'A model may not take instructions from a web page, but it may write a row into its own spreadsheet when its user asks. That moves the authority to the person and keeps the whole directory reachable.',
    tab_contract: {
      A: 'what to invoke — [KEY]args[/KEY] or KEY|args or just KEY',
      B: 'state — running, ok, error (written by the bridge)',
      C: 'the answer (written by the bridge)',
      D: 'when (written by the bridge)',
      E: 'ledger trace (written by the bridge)',
    },
    runs_when: 'column A is an invocation and column B is empty; clear B to run it again',
    sheet: sheetId,
    open: 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit',
    run: 'POST https://miscsubjects.com/api/sheet-bridge?tab=' + encodeURIComponent(tab),
    schedule: "POST /api/dispatch {key:'AUTOMATE_ADD', body:'sheet bridge|1|SHEET_BRIDGE_RUN|'}",
    directory: 'https://miscsubjects.com/api/directory',
  };
  if (!authorized(request, env)) return json({ ...contract, queued: 'owner key or admin cookie required to preview the queue' });
  const read = await readTab(env, sheetId, tab, 200);
  if (!read.ok) return json({ ...contract, ok: false, error: read.error }, 200);
  return json({ ...contract, ok: true, queued: queuedRows(read.values).map((q) => ({ row: q.row, key: q.spec.key })) });
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) {
    return json({ error: 'unauthorized', how_to_fix: 'x-terminal-key, Authorization: Bearer <token>, or the admin cookie' }, 401);
  }
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const sheetId = url.searchParams.get('sheet') || body.sheet || env.SHEET_BRIDGE_ID || DEFAULT_SHEET;
  const tab = url.searchParams.get('tab') || body.tab || DEFAULT_TAB;
  const limit = parseInt(url.searchParams.get('limit') || body.limit, 10) || MAX_PER_RUN;
  const out = await runQueue(env, sheetId, tab, limit);
  return json(out, out.ok ? 200 : 502);
}
