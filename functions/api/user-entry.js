// POST /api/user-entry — reader-submitted experience or question about a subject.
// Writes a hash-chained row to user_entries. No auth required for submissions.

import { buildNowIso, stripClientTime } from '../_lib/build_time.js';

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function nowIso() { return buildNowIso(); }

export async function onRequestPost(context) {
  const { env, request } = context;
  let body = {};
  try { body = await request.json(); } catch {}
  stripClientTime(body); // BUILD LAW — TIME: no caller-supplied timestamp is honored.

  const text = String(body.text || '').trim();
  if (!text) return json({ error: 'text is required' }, 400);

  const ts = nowIso();
  const subject = String(body.subject || '').trim().toLowerCase();
  const contextVal = String(body.context || '').trim();
  const author = String(body.author || 'anonymous').trim();
  const source_url = String(body.source_url || '').trim();

  const hash = await sha256([ts, subject, contextVal, text, author].join('|'));

  try {
    const r = await env.DB.prepare(
      'INSERT INTO user_entries (ts, subject, context, text, author, source_url, hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(ts, subject, contextVal, text, author, source_url, hash, 'pending').run();

    const entryId = r.meta.last_row_id;

    // A question asked through the article message widgets → queue it for the
    // agent answer forum. Cron drains tasks.source='article-question' one per tick;
    // the answer lands back in user_entries (the widget thread) + the ledger.
    let forum_queued = null;
    if (/^question\b/i.test(contextVal)) {
      try {
        const job = {
          role: 'article-question',
          post_to: '/api/protocol/question-answer',
          slug: subject,
          question: text.slice(0, 2000),
          author,
          entry_id: entryId,
          channel: contextVal.replace(/^question[:\s]*/i, '') || 'widget',
        };
        const t = await env.DB.prepare(
          "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'article-question')"
        ).bind(JSON.stringify(job)).run();
        forum_queued = t.meta.last_row_id;
      } catch {}
    }
    let promoted = null;
    if (subject && env.TERMINAL_KEY) {
      const article = await env.DB.prepare('SELECT slug FROM articles WHERE slug=?').bind(subject).first();
      if (article) {
        const srcType = /whatsapp/i.test(contextVal) ? 'whatsapp'
          : /imessage|sms|text/i.test(contextVal) ? 'imessage'
          : 'anecdotal';
        try {
          const pr = await fetch('https://miscsubjects.com/api/protocol/sources', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-terminal-key': env.TERMINAL_KEY,
            },
            body: JSON.stringify({
              slug: subject,
              model: 'user-entry',
              sources: [{
                type: srcType,
                title: 'Reader report #' + entryId,
                quote: text.slice(0, 2000),
                summary: (contextVal ? contextVal + ' — ' : '') + text.slice(0, 400),
                author,
                url: source_url || '',
                extra: { user_entry_id: entryId, user_entry_hash: hash },
              }],
              rationale: 'Promoted user_entries row ' + entryId + ' to anecdotal source ledger',
            }),
          });
          const pj = await pr.json();
          if (pj.ok) {
            promoted = { source_ids: (pj.added_detail || []).map((s) => s.id), total_sources: pj.total_sources };
            await env.DB.prepare('UPDATE user_entries SET status=? WHERE id=?').bind('promoted', entryId).run();
          }
        } catch {}
      }
    }

    return json({ ok: true, id: entryId, hash: hash.slice(0, 16), ts, subject, promoted, forum_queued });
  } catch (e) {
    return json({ error: 'database error: ' + (e?.message || String(e)) }, 500);
  }
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const subject = String(url.searchParams.get('subject') || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));

  try {
    let rows;
    if (subject) {
      rows = await env.DB.prepare('SELECT id, ts, subject, context, text, author, hash, status FROM user_entries WHERE subject=? ORDER BY ts DESC LIMIT ?')
        .bind(subject, limit).all();
    } else {
      rows = await env.DB.prepare('SELECT id, ts, subject, context, text, author, hash, status FROM user_entries ORDER BY ts DESC LIMIT ?')
        .bind(limit).all();
    }
    return json({ entries: rows.results || [] });
  } catch (e) {
    return json({ error: 'database error: ' + (e?.message || String(e)) }, 500);
  }
}
