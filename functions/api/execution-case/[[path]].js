import { loadExecutionCase } from '../../_lib/execution_case.js';
import { upsertDraft, listSends, applyReview, executeSend, recordAudit } from '../../_lib/execution_case_review.js';
import { resolveCanonical } from '../../_lib/execution_case_resolve.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';
import { logEvent } from '../../_lib/event_log.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30' },
  });
}

function privateJson(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function pathOf(context) {
  const raw = context.params?.path;
  const parts = Array.isArray(raw) ? raw.map(String) : String(raw || '').split('/');
  return parts.filter(Boolean);
}

export async function onRequestGet(context) {
  const parts = pathOf(context);
  const taskId = String(parts[0] || '').toUpperCase();
  const sub = String(parts[1] || '').toLowerCase();
  if (!/^WT-\d{4}$/.test(taskId)) {
    return json({ error: 'task_id_required', example: '/api/execution-case/WT-0090' }, 400);
  }
  // Owner lane: the exact draft list, verified addresses included — never public.
  if (sub === 'drafts') {
    if (!(await isBuildAuthed(context.request, context.env))) return json({ error: 'not_found' }, 404);
    const rows = await listSends(context.env, taskId, new URL(context.request.url).searchParams.get('status') || null);
    return privateJson({ task_id: taskId, count: rows.length, sends: rows });
  }
  try {
    const url = new URL(context.request.url);
    const candidateLimit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000', 10) || 1000));
    const candidateOffset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const view = url.searchParams.get('view') === 'raw' ? 'raw' : 'resolved';
    const data = await loadExecutionCase(context.env, taskId, { candidateLimit, candidateOffset, view });
    if (!data) return json({ error: 'task_not_found', task_id: taskId }, 404);
    const nextPage = data.page?.next_offset != null
      ? `https://miscsubjects.com/api/execution-case/${taskId}?offset=${data.page.next_offset}&limit=${candidateLimit}${view === 'raw' ? '&view=raw' : ''}`
      : null;
    if (data.page) data.page.next = nextPage;
    return json({
      _ai_door: {
        see: `https://miscsubjects.com/execution-case/${taskId}`,
        note: 'Give the browser URL to a cold model. No credential or prior endpoint knowledge is required.',
      },
      _self: {
        schema: 'miscsubjects/execution-case-public/1',
        what: 'One task-scoped run turned inside out, deduped to one decision per firm. Counts exclude ambient rows and superseded duplicates.',
        privacy: 'Recipients are public organizational addresses shown in full with their SHA-256 commitments (owner disclosure for the public launch); the operator’s own identity is never present.',
        resolve_receipts: 'Any invocation_id resolves keylessly at https://miscsubjects.com/receipt/<id> (browser) or /api/dispatch?confirm=<id> (JSON). Any proof_id resolves at https://miscsubjects.com/verify/<id>.',
      },
      ...data,
      doors: {
        article: 'https://miscsubjects.com/a/the-run-that-found-you',
        browser: `https://miscsubjects.com/execution-case/${taskId}`,
        payloads: `https://miscsubjects.com/api/work-evidence/${taskId}/payloads`,
        verify: `https://miscsubjects.com/api/work-evidence/${taskId}/verify`,
        audit: `https://miscsubjects.com/api/work/task/${taskId}/audit`,
        checkpoint: 'https://miscsubjects.com/api/chain/checkpoint',
        comment: `https://miscsubjects.com/api/case/${taskId}/comments`,
        reproduce: `POST https://miscsubjects.com/api/work/task/${taskId}/reproduce`,
      },
    });
  } catch (error) {
    if (/no such table/i.test(String(error?.message || error))) {
      return json({ error: 'execution_case_not_deployed', task_id: taskId, note: 'The task exists, but its task-bound case tables are not live yet.' }, 503);
    }
    return json({ error: 'execution_case_read_failed', detail: String(error?.message || error) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const parts = pathOf(context);
  const taskId = String(parts[0] || '').toUpperCase();
  const sub = String(parts[1] || '').toLowerCase();
  if (!/^WT-\d{4}$/.test(taskId)) return json({ error: 'task_id_required' }, 400);
  if (!(await isBuildAuthed(request, env))) return json({ error: 'not_found' }, 404);
  let body = {};
  try { body = JSON.parse(await request.text() || '{}'); } catch { return json({ error: 'body_must_be_json' }, 400); }
  const viaTerminalKey = !!request.headers.get('x-terminal-key');
  const actor = viaTerminalKey ? 'owner:terminal-key' : 'owner:admin-session';

  if (sub === 'resolve') {
    // Recompute one canonical decision per firm from the raw discovery rows. Idempotent; the
    // durable mechanism behind the deduped public exhibit.
    const result = await resolveCanonical(env, taskId);
    await logEvent(env, {
      source: 'execution-case', key: 'CASE_RESOLVE', action: 'resolve', direction: 'in', actor,
      status: result.error ? 422 : 200,
      request: { task_id: taskId },
      response: result?.summary || result,
    });
    return privateJson(result, result.error ? 422 : 200);
  }

  if (sub === 'drafts') {
    const result = await upsertDraft(env, { taskId, candidateId: body.candidate_id, subject: body.subject, body: body.body, companion: body.companion });
    await logEvent(env, {
      source: 'execution-case', key: 'CASE_DRAFT', action: 'upsert', direction: 'in', actor,
      status: result.error ? 422 : 200,
      request: { task_id: taskId, candidate_id: body.candidate_id, subject: String(body.subject || '').slice(0, 120) },
      response: result,
    });
    return privateJson(result, result.error ? 422 : 200);
  }

  if (sub === 'review') {
    // The review event is written FIRST and its id becomes the receipt every approved row
    // carries. The actor line records which credential the reviewer presented.
    const ids = Array.isArray(body.send_ids) ? body.send_ids.map(String) : [];
    const eventId = await logEvent(env, {
      source: 'execution-case', key: 'OWNER_EXACT_REVIEW', action: String(body.action || ''), direction: 'in', actor,
      status: 200,
      request: { task_id: taskId, action: body.action, send_ids: ids.slice(0, 200), auth_vehicle: viaTerminalKey ? 'terminal-key' : 'admin-session-cookie' },
      response: { note: 'review receipt row — the send rows this id appears on were the exact bodies reviewed' },
    });
    if (!eventId) return privateJson({ error: 'receipt_write_failed', note: 'the review must land on the ledger before rows can point at it' }, 503);
    const result = await applyReview(env, { taskId, action: body.action, sendIds: ids, receipt: eventId });
    return privateJson({ ...result, review_receipt_url: `https://miscsubjects.com/api/events/${eventId}` }, result.error ? 422 : 200);
  }

  if (sub === 'send') {
    if (String(body.confirm || '').toUpperCase() !== 'CONFIRM') {
      return privateJson({ blocked: true, error: 'explicit_confirmation_required', note: 'POST {send_id, confirm:"CONFIRM"} — sends one approved row.' }, 422);
    }
    const result = await executeSend(env, { taskId, sendId: body.send_id });
    await logEvent(env, {
      source: 'execution-case', key: 'CASE_SEND', action: 'send', direction: 'out', actor,
      status: result.error ? 422 : 200,
      request: { task_id: taskId, send_id: body.send_id },
      response: result,
    });
    return privateJson(result, result.error ? 422 : 200);
  }

  if (sub === 'audits') {
    const result = await recordAudit(env, {
      taskId, model: body.model, family: body.family, receiptId: body.receipt_id, verdictText: body.verdict_text,
    });
    await logEvent(env, {
      source: 'execution-case', key: 'CASE_AUDIT', action: 'record', direction: 'in', actor,
      status: result.error ? 422 : 200,
      request: { task_id: taskId, model: body.model, family: body.family, receipt_id: body.receipt_id },
      response: result,
    });
    return privateJson(result, result.error ? 422 : 200);
  }

  return json({ error: 'unknown_action', allowed: ['drafts', 'review', 'send', 'audits', 'resolve'] }, 404);
}
