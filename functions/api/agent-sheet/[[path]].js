// /api/agent-sheet — one sheet, one agent.
//
//   GET  /api/agent-sheet          -> contract + the sheet id and its settings
//   POST /api/agent-sheet/say      {text}  -> run one message as if it arrived
//   POST /api/agent-sheet/webhook  -> point a Blooio channel here
//
// Everything configurable is a cell on the sheet: the system prompt, the full REST envelope
// sent to the model, the loop cap, whether it replies. There is no deploy between an edit and
// the next message.

import { isBuildAuthed } from '../../_lib/admin_session.js';
import { ensureSheet, readSettings, runInbound, recordOutbound, checkCandidate, applySettings, settingCell, SETTINGS_SCHEMA, LOG_HEADERS, SETTINGS } from '../../_lib/agent_sheet.js';
import { sendBlooio } from '../../blooio.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function authed(request, env, url) {
  const keys = [env.TERMINAL_KEY, env.INVOKE_TOKEN].filter(Boolean).map(String);
  const m = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  const presented = (m ? m[1].trim() : '')
    || String(request.headers.get('x-terminal-key') || '')
    || String(url.searchParams.get('token') || '');
  if (presented && keys.includes(presented)) return true;
  return isBuildAuthed(request, env);
}

function allowed(list, from) {
  const entries = String(list || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!entries.length) return false;
  const digits = String(from || '').replace(/\D/g, '');
  return entries.some((e) => {
    const d = e.replace(/\D/g, '');
    return d ? (digits && digits.endsWith(d)) : e === from;
  });
}

async function handle(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const base = url.origin;
  const method = request.method.toUpperCase();
  const seg = (Array.isArray(params.path) ? params.path : (params.path ? [params.path] : [])).map(String);
  const head = (seg[0] || '').toLowerCase();

  if (method === 'GET' && !head) {
    const body = {
      _self: { schema: 'miscsubjects/agent-sheet/2', what: 'One sheet is the agent. Columns A..R are the message log, one row per inbound message. Columns T/U are the settings, one per cell.' },
      log_columns: LOG_HEADERS,
      // Every setting with its declared range and the exact cell to POST to. A stable address is
      // the API: changing the running model is a write to one cell, from anything that speaks HTTP.
      settings: SETTINGS_SCHEMA.map((x) => ({
        setting: x.key, type: x.type,
        min: x.min == null ? null : x.min, max: x.max == null ? null : x.max,
        optional: !!x.optional, default: x.def == null ? '' : String(x.def),
        cell: settingCell(x.key), note: x.note || '',
      })),
      set_one: 'PUT ' + base + '/api/sheets/<sheet_id>/values/<cell> {"values":[["<value>"]]} — or POST /api/agent-sheet/settings for range-checking',
      webhook: base + '/api/agent-sheet/webhook',
      say: 'POST ' + base + '/api/agent-sheet/say {"text":"..."}',
      check: 'POST ' + base + '/api/agent-sheet/check {"candidate":{"model_request_json":"..."}} — replay a candidate configuration against real messages without applying it',
      settings_lane: 'POST ' + base + '/api/agent-sheet/settings {"set":{...}} — apply settings, refused if the candidate stops emitting a reply',
    };
    if (await authed(request, env, url)) {
      const sheet = await ensureSheet(env);
      body.sheet = { id: sheet.id, url: base + '/admin/sheets?tab=' + sheet.id };
      body.current = await readSettings(env, sheet);
    }
    return json(body);
  }

  let payload = {};
  try { payload = await request.json(); } catch { payload = {}; }

  if (head === 'check' && method === 'POST') {
    if (!(await authed(request, env, url))) return json({ error: 'unauthorized' }, 401);
    const out = await checkCandidate(env, payload.candidate || {}, Math.max(1, Math.min(8, parseInt(payload.samples, 10) || 3)));
    return json(out, out.pass ? 200 : 409);
  }

  if (head === 'settings' && method === 'POST') {
    if (!(await authed(request, env, url))) return json({ error: 'unauthorized' }, 401);
    const out = await applySettings(env, payload.set || {}, {
      force: !!payload.force,
      samples: Math.max(1, Math.min(8, parseInt(payload.samples, 10) || 3)),
    });
    return json(out, out.applied ? 200 : 409);
  }

  if (head === 'say' && method === 'POST') {
    if (!(await authed(request, env, url))) return json({ error: 'unauthorized' }, 401);
    const out = await runInbound(env, {
      text: payload.text || payload.body || '',
      from: payload.from || 'owner',
      channel: payload.channel || 'direct',
      raw: payload,
    });
    return json({ ...out, row_url: base + '/admin/sheets?tab=' + out.sheet_id + '&cell=A' + out.row });
  }

  if (head === 'webhook' && method === 'POST') {
    const msg = payload.message || payload.data || payload;
    const text = String(msg.text || msg.body || msg.content || '');
    const from = String(msg.from || msg.from_number || msg.sender || (msg.contact && msg.contact.phone) || '');
    const chat = String(msg.chat_id || msg.chat || (msg.conversation && msg.conversation.id) || from);

    const out = await runInbound(env, { text, from, channel: 'blooio', raw: payload });
    const may = out.ok && out.reply && out.reply_enabled && allowed(out.allow_from, from);
    if (!may) return json({ ok: true, row: out.row, sent: false });

    let delivery = '';
    try { delivery = await sendBlooio(env, chat, out.reply, null, { actor: 'agent-sheet' }); }
    catch (e) { delivery = 'ERR:' + String(e && e.message || e); }
    await recordOutbound(env, out.row, {
      outbound: { chat_id: chat, text: out.reply },
      delivery: String(delivery || '').slice(0, 4000),
    });
    return json({ ok: true, row: out.row, sent: true });
  }

  return json({ error: 'not_found' }, 404);
}

export const onRequest = handle;
