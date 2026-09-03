import { sendBlooio } from '../blooio.js';
import { send2chat } from '../2chat.js';
import { sendTelegram } from '../telegram.js';
import { logEvent } from '../_lib/event_log.js';
import { extractAgentDiagnosis, formatReflexReplyForBlooio, cacheReflexAnswer } from '../_lib/issue_reflex.js';
import { isBuildAuthed } from '../_lib/admin_session.js';

const CHANNEL_SENDERS = { '2chat': send2chat, telegram: sendTelegram };
const BRIDGE = 'https://agent.cannibal.capital/exec';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = request.headers.get('x-loop-auth') || '';
  // Internal hops use BLOOIO_API_KEY; the GitHub Actions heartbeat uses LOOP_DELIVER_TOKEN.
  const ok = auth === String(env.BLOOIO_API_KEY || ' ') || (env.LOOP_DELIVER_TOKEN && auth === String(env.LOOP_DELIVER_TOKEN)) || await isBuildAuthed(request, env);
  if (!ok) return new Response('forbidden', { status: 403 });
  try { context.waitUntil(run(env)); } catch { await run(env); }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
}

async function readMacLog(env, path) {
  if (!path) return '';
  const headers = { 'content-type': 'application/json' };
  if (env.TERMINAL_KEY) headers['x-terminal-key'] = env.TERMINAL_KEY;
  try {
    const resp = await fetch(BRIDGE, {
      method: 'POST', headers,
      body: JSON.stringify({ cmd: 'bash', args: ['-lc', 'cat ' + JSON.stringify(String(path))], timeout: 20000 }),
    });
    const j = await resp.json().catch(() => ({}));
    return String(j.stdout || '');
  } catch { return ''; }
}

async function pollReflexJobs(env) {
  const rows = (await env.DB.prepare(
    "SELECT id, job_json, attempts, created_at FROM turn_jobs WHERE status='running' AND job_json LIKE '%\"phase\":\"reflex\"%' ORDER BY id"
  ).all()).results || [];
  let pending = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    let job;
    try { job = JSON.parse(row.job_json); } catch { continue; }
    if (job.phase !== 'reflex' || !job.log_file) continue;
    const log = await readMacLog(env, job.log_file);
    if (!log.includes('[spawn] complete')) {
      pending++;
      const age = Date.now() - new Date(row.created_at || 0).getTime();
      if (age > 900000) {
        await env.DB.prepare("UPDATE turn_jobs SET status='failed', updated_at=? WHERE id=?").bind(now, row.id).run();
        const sender = CHANNEL_SENDERS[job.channel] || sendBlooio;
        await sender(env, job.chat, 'Kimi diagnosis timed out after 15m. Check ' + job.log_file, []);
        await logEvent(env, { source: 'blooio', direction: 'OUT', action: 'reflex_timeout', route: '/api/deliver', request: JSON.stringify({ jobId: row.id, log: job.log_file }), response: '' });
      }
      continue;
    }
    const diagnosis = extractAgentDiagnosis(log);
    if (!diagnosis || diagnosis.length < 30) { pending++; continue; }
    if (job.fingerprint) await cacheReflexAnswer(env, job.fingerprint, diagnosis);
    const reply = formatReflexReplyForBlooio({ diagnosis, sync_agent: job.sync_agent || 'kimi', async_team: true });
    const sender = CHANNEL_SENDERS[job.channel] || sendBlooio;
    await sender(env, job.chat, reply.slice(0, 3200), []);
    await env.DB.prepare("UPDATE turn_jobs SET status='done', updated_at=? WHERE id=?").bind(now, row.id).run();
    await logEvent(env, { source: 'blooio', direction: 'OUT', action: 'reflex_deliver', route: '/api/deliver', request: JSON.stringify({ jobId: row.id, trace: job.trace, chat: job.chat }), response: reply.slice(0, 500) });
  }
  return pending;
}

async function run(env) {
  const base = env.ARCADS_BASE_URL || 'https://external-api.arcads.ai';
  const headers = { 'Authorization': env.ARCADS_BASIC_AUTH, 'Accept': 'application/json' };
  const now = () => new Date().toISOString();

  // Turn watchdog: re-post routed agent turns whose invocation died mid-flight.
  // Stale = still 'running' 180s after last update. One retry (a retry re-runs the
  // whole dispatch — model calls and generations included).
  const staleBefore = new Date(Date.now() - 180000).toISOString();
  const stale = (await env.DB.prepare(
    "SELECT id, job_json, attempts FROM turn_jobs WHERE status='running' AND attempts < 1 AND updated_at < ? AND job_json NOT LIKE '%\"phase\":\"reflex\"%' ORDER BY id"
  ).bind(staleBefore).all()).results || [];
  for (const j of stale) {
    await env.DB.prepare('UPDATE turn_jobs SET attempts=attempts+1, updated_at=? WHERE id=?').bind(now(), j.id).run();
    let job; try { job = JSON.parse(j.job_json); } catch { continue; }
    job.jobId = j.id;
    await fetch('https://miscsubjects.com/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
      body: JSON.stringify(job),
    }).catch(() => {});
    await logEvent(env, { source: job.channel || 'blooio', direction: 'OUT', action: 'turn_retry', route: '/api/deliver', trace_id: job.trace || null, request: JSON.stringify({ jobId: j.id, agentKey: job.agentKey, channel: job.channel || 'blooio' }), response: '' });
  }
  // Give up on jobs whose retry also died (10 min) so the chain doesn't run forever.
  await env.DB.prepare("UPDATE turn_jobs SET status='failed', updated_at=? WHERE status='running' AND attempts >= 1 AND updated_at < ?")
    .bind(now(), new Date(Date.now() - 600000).toISOString()).run();
  const reflexPending = await pollReflexJobs(env);
  const running = (await env.DB.prepare("SELECT count(*) n FROM turn_jobs WHERE status='running'").first())?.n || 0;

  const rows = (await env.DB.prepare(
    "SELECT * FROM pending_deliveries WHERE status='pending' AND attempts < 60 ORDER BY id"
  ).all()).results || [];
  if (!rows.length && !running && !reflexPending) return;
  let stillPending = 0;

  for (const row of rows) {
    let a = null;
    try { a = await (await fetch(base + '/v1/assets/' + row.asset_id, { headers })).json(); } catch {}
    const url = a?.url || a?.imageUrl || a?.outputUrl || (Array.isArray(a?.outputs) && a.outputs[0]?.url) || null;
    const status = a?.status || a?.state || '';
    const credits = a?.data?.creditsCharged || 0;

    if (!url && /fail|error|expired/i.test(status)) {
      await env.DB.prepare("UPDATE pending_deliveries SET status='failed', updated_at=? WHERE id=?").bind(now(), row.id).run();
      const sender = CHANNEL_SENDERS[row.channel] || sendBlooio;
      await sender(env, row.chat, `The ${row.kind} render ${row.asset_id} failed (${status}).`, []);
      await logEvent(env, { source: 'blooio', direction: 'OUT', action: 'deliver_failed', route: '/api/deliver', request: JSON.stringify({ id: row.id, asset_id: row.asset_id }), response: status });
      continue;
    }
    if (!url) {
      await env.DB.prepare('UPDATE pending_deliveries SET attempts=attempts+1, updated_at=? WHERE id=?').bind(now(), row.id).run();
      stillPending++;
      continue;
    }

    // Ready. Validate bytes + store to R2 (NoSuchKey race: retry with a fresh url).
    let stable = url, key = '', curUrl = url;
    for (let i = 0; i < 3; i++) {
      try {
        const ir = await fetch(curUrl);
        const ct = ir.headers.get('content-type') || '';
        if (ir.ok && /^(image|video)\//i.test(ct)) {
          const ext = /^video/i.test(ct) ? 'mp4' : 'png';
          key = `img/gen/arcads-${row.model || 'gen'}-${row.asset_id}.${ext}`;
          await env.R2.put(key, await ir.arrayBuffer(), { httpMetadata: { contentType: ct } });
          stable = 'https://miscsubjects.com/' + key;
          break;
        }
      } catch {}
      await sleep(2500);
      try { const f = await (await fetch(base + '/v1/assets/' + row.asset_id, { headers })).json(); curUrl = f?.url || curUrl; } catch {}
    }
    if (!key) { // bytes never validated — count the attempt, retry next chain
      await env.DB.prepare('UPDATE pending_deliveries SET attempts=attempts+1, updated_at=? WHERE id=?').bind(now(), row.id).run();
      stillPending++;
      continue;
    }

    if (credits) {
      try {
        await env.DB.prepare('INSERT INTO arcads_ledger (ts, kind, model, asset_id, credits) VALUES (?,?,?,?,?)')
          .bind(now(), row.kind, row.model || '', row.asset_id, Number(credits) || 0).run();
      } catch {}
    }
    try {
      await env.DB.prepare(
        'INSERT INTO assets (id, created_at, category, label, r2_key, url, source_url, engine, prompt, sender, chat, protocol, is_group, parent_id, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind('as_' + crypto.randomUUID(), now(), 'generated', 'arcads-deliver:' + (row.model || ''), key, stable, url,
        'arcads:' + (row.model || ''), null, null, row.chat, null, 0, null, null).run();
    } catch {}

    const sender = CHANNEL_SENDERS[row.channel] || sendBlooio;
    const sendRes = await sender(env, row.chat, '', [stable]);
    await env.DB.prepare("UPDATE pending_deliveries SET status='delivered', updated_at=? WHERE id=?").bind(now(), row.id).run();
    await logEvent(env, { source: 'blooio', direction: 'OUT', action: 'deliver', route: '/api/deliver', request: JSON.stringify({ id: row.id, asset_id: row.asset_id, chat: row.chat, url: stable }), response: String(sendRes).slice(0, 500) });
  }

  if (stillPending || running || reflexPending) {
    await fetch('https://loop-safe-sibling.owner-account.workers.dev/wf/deliver/trigger', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'stillPending=' + !!stillPending + ' running=' + !!running }),
    }).catch(() => {});
  }
}
