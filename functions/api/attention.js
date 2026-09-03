import { isBuildAuthed } from '../_lib/admin_session.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

async function dispatch(env, key, body) {
  try {
    const r = await fetch('https://miscsubjects.com/api/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
      body: JSON.stringify({ key, body }),
    });
    const j = await r.json();
    return j && j.result;
  } catch { return null; }
}

async function cached(env, kvKey, ttlSec, fn) {
  try {
    const hit = await env.KV.get(kvKey);
    if (hit) { const j = JSON.parse(hit); if (Date.now() - j.at < ttlSec * 1000) return j.v; }
  } catch {}
  const v = await fn();
  try { await env.KV.put(kvKey, JSON.stringify({ at: Date.now(), v })); } catch {}
  return v;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
  const cursor = (await env.KV.get('attention/last_seen')) || '2026-07-29T00:00:00Z';

  // email outbox: recent tracked sends with engagement
  let outbox = [];
  try {
    const r = await env.DB.prepare(
      "SELECT id, to_email, subject, kind, sent_at, send_status, opens, clicks, last_open_at FROM email_sends ORDER BY sent_at DESC LIMIT 25"
    ).all();
    outbox = r.results || [];
  } catch {}

  // email inbound + owner copies + any inbound comms events since cursor (ledger)
  let inboundEvents = [];
  try {
    const r = await env.LEDGER.prepare(
      "SELECT ts, source, key, substr(coalesce(request_preview, request_json, ''),1,220) AS preview FROM events WHERE (direction IN ('in','inbound') AND source IN ('email','blooio','twochat','webhook')) OR key IN ('WEBHOOK_INTAKE','EMAIL_INBOUND','INBOUND_THREAD') ORDER BY ts DESC LIMIT 40"
    ).all();
    inboundEvents = r.results || [];
  } catch {}
  const unseenInbound = inboundEvents.filter((e) => String(e.ts) > cursor);

  // Blooio chats (iMessage + WhatsApp ride the same provider) — cached live pull
  const chats = await cached(env, 'attention/blooio_chats', 120, async () => {
    const raw = await dispatch(env, 'BLOOIO_LIST_CHATS', '');
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const list = Array.isArray(arr) ? arr : (arr && (arr.chats || arr.data)) || [];
      return list.slice(0, 30).map((c) => ({
        id: c.id || c.chat_id || '', name: c.name || c.display_name || c.identifier || '',
        channel: c.channel || c.channel_type || '', unread: Number(c.unread_count || c.unread || 0),
        last: c.last_message_at || c.updated_at || '', preview: String(c.last_message_preview || c.last_message || '').slice(0, 160),
      }));
    } catch { return []; }
  }) || [];
  const blooioUnread = chats.filter((c) => c.unread > 0);
  const whatsappUnread = blooioUnread.filter((c) => /whatsapp/i.test(c.channel));

  // open tasks
  let tasksOpen = 0, taskRows = [];
  try {
    const r = await env.DB.prepare("SELECT id, created_at, body, source FROM tasks WHERE status='open' ORDER BY id DESC LIMIT 30").all();
    taskRows = (r.results || []).map((t) => { let j = {}; try { j = JSON.parse(t.body); } catch {} return { id: t.id, created_at: t.created_at, source: t.source, title: (j.title || j.item || j.ask || String(t.body || '').slice(0, 100)) }; });
    const c = await env.DB.prepare("SELECT count(*) c FROM tasks WHERE status='open'").first();
    tasksOpen = (c && c.c) || taskRows.length;
  } catch {}

  // open GitHub issues — cached
  const issues = await cached(env, 'attention/github_issues', 600, async () => {
    const raw = await dispatch(env, 'GITHUB_LIST_ISSUES', 'open');
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const list = Array.isArray(arr) ? arr : (arr && (arr.issues || arr.items)) || [];
      return list.slice(0, 30).map((i) => ({ number: i.number, title: i.title, url: i.html_url || i.url, updated: i.updated_at }));
    } catch { return []; }
  }) || [];

  let modelComments = [], modelCommentsOpen = 0;
  try {
    const r = await env.DB.prepare(
      "SELECT id, slug, actor, verdict, substr(body,1,400) AS body, ts FROM article_comments WHERE status='open' AND actor_kind='model' ORDER BY id DESC LIMIT 40"
    ).all();
    modelComments = (r.results || []).map((c) => ({
      ...c,
      article: `https://miscsubjects.com/a/${c.slug}`,
      thread: `https://miscsubjects.com/a/${c.slug}#ledger-${c.id}`,
      reply: `POST /api/comments/reply {"id":${c.id},"body":"…"}`,
    }));
    const c = await env.DB.prepare("SELECT count(*) c FROM article_comments WHERE status='open' AND actor_kind='model'").first();
    modelCommentsOpen = (c && c.c) || modelComments.length;
  } catch { /* table absent on a fresh preview DB */ }

  const commsCount = unseenInbound.length + blooioUnread.reduce((a, c) => a + c.unread, 0) + modelCommentsOpen;
  const workCount = tasksOpen + issues.length;
  return json({
    counts: { comms: commsCount, work: workCount, model_comments: modelCommentsOpen },
    comms: {
      inbound_unseen: unseenInbound, inbound_recent: inboundEvents.slice(0, 15),
      blooio_unread: blooioUnread, whatsapp_unread: whatsappUnread, chats,
      email_outbox: outbox,
      model_comments: modelComments,
      model_comments_open: modelCommentsOpen,
    },
    work: { tasks_open: tasksOpen, tasks: taskRows, github_issues: issues },
    cursor,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
  let b = {}; try { b = await request.json(); } catch {}
  if (b.seen) {
    const now = new Date().toISOString();
    await env.KV.put('attention/last_seen', now);
    return json({ ok: true, cursor: now });
  }
  return json({ error: 'unknown action' }, 400);
}
