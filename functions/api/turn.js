import { processTurn } from '../blooio.js';
import { send2chat } from '../2chat.js';
import { sendTelegram } from '../telegram.js';
import { logEvent } from '../_lib/event_log.js';

const CHANNEL_SENDERS = { '2chat': send2chat, telegram: sendTelegram };

export async function onRequestPost(context) {
  const { request, env } = context;
  if ((request.headers.get('x-loop-auth') || '') !== String(env.BLOOIO_API_KEY || ' ')) {
    return new Response('forbidden', { status: 403 });
  }
  let job; try { job = await request.json(); } catch { job = null; }
  if (!job || !job.from) return new Response('bad job', { status: 400 });
  const source = String(job.channel || 'blooio');
  if (!job.phase && !job.jobId) {
    const now = new Date().toISOString();
    try {
      const ins = await env.DB.prepare('INSERT INTO turn_jobs (job_json, status, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind(JSON.stringify(job), 'running', now, now).run();
      job.jobId = ins.meta.last_row_id || 0;
      if (job.jobId) {
        await env.DB.prepare('UPDATE turn_jobs SET job_json = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(job), now, job.jobId).run();
      }
    } catch {}
  }
  await logEvent(env, {
    source,
    direction: 'IN',
    action: 'turn_in',
    route: '/api/turn',
    trace_id: job.trace || null,
    request: JSON.stringify({ phase: job.phase || 'route', agentKey: job.agentKey || '', jobId: job.jobId || 0, from: job.from, chat: job.chat, channel: source }),
  });
  const send = CHANNEL_SENDERS[job.channel] || null;
  const run = () => processTurn(env, job, send).catch(async (e) => {
    const err = 'ERR:turn:' + (e && e.message || String(e));
    await logEvent(env, { source, direction: 'IN', action: 'turn_error', route: '/api/turn', trace_id: job.trace || null, request: JSON.stringify({ phase: job.phase || 'route', from: job.from, chat: job.chat }), response: err });
  });
  try { context.waitUntil(run()); } catch { await run(); }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
}
