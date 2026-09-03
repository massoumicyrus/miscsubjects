/** Thread inbound messages into tasks + optional Meta CAPI lead events. */

import { logEvent } from './event_log.js';
import { dispatch } from '../api/dispatch.js';

export async function threadInboundMessage(env, m, opts = {}) {
  if (!env?.DB || !m) return null;
  const from = String(m.from || m.chat || '').trim();
  const text = String(m.messageBody || '').slice(0, 2000);
  if (!from || (!text && !(m.mediaUrls || []).length)) return null;
  const source = opts.source || 'imessage-inbound';
  const priority = opts.priority || 'P2';
  const role = opts.role || 'router';
  const status = opts.status || (source === 'owner-imessage' ? 'logged' : 'open');
  const title = (opts.title || `Inbound ${from}`).slice(0, 200);
  const body = JSON.stringify({
    ask: title,
    role,
    priority,
    notes: text || '(attachment)',
    from,
    chat: m.chat || from,
    protocol: m.protocol || 'imessage',
    channel: m.channel || 'blooio',
    trace: m.trace || null,
    threaded_at: new Date().toISOString(),
  });
  try {
    const r = await env.DB.prepare(
      'INSERT INTO tasks (created_at, status, body, source, trace_id) VALUES (datetime(\'now\'), ?, ?, ?, ?)'
    ).bind(status, body, source, m.trace || null).run();
    await logEvent(env, {
      source: 'tasks',
      key: 'INBOUND_THREAD',
      action: 'task_create',
      direction: 'in',
      status: 200,
      trace_id: m.trace || null,
      response: { task_id: r.meta?.last_row_id, from, source },
    });
    return r.meta?.last_row_id;
  } catch {
    return null;
  }
}

export async function fireMetaLeadCapi(env, m) {
  const phone = String(m.from || '').replace(/\D/g, '');
  if (!phone) return null;
  const eventId = 'lead_' + (m.trace || Date.now());
  try {
    const out = await dispatch(env, 'META_CAPI_EVENT', `Lead|${eventId}|miscsubjects|||${phone}||`, { actor: 'meta_lead' });
    const res = out?.result ?? out;
    await logEvent(env, {
      source: 'marketing',
      key: 'META_CAPI_EVENT',
      action: 'lead',
      direction: 'out',
      status: 200,
      trace_id: m.trace || null,
      request: { from: m.from, event_id: eventId },
      response: { preview: String(res || '').slice(0, 500) },
    });
    return res;
  } catch (e) {
    await logEvent(env, {
      source: 'marketing',
      key: 'META_CAPI_EVENT',
      action: 'lead',
      direction: 'out',
      status: 500,
      trace_id: m.trace || null,
      response: { error: String(e?.message || e) },
    });
    return null;
  }
}