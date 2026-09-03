function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}

const PRIORITY_TERM = { 1: 50, 2: 34, 3: 22, 4: 14, 5: 8, 6: 5, 7: 3 };

function rankTask(t) {
  const why = [];
  let rank = 0;
  const p = PRIORITY_TERM[t.priority] ?? 4;
  rank += p; why.push(`priority ${t.priority} → ${p}`);
  if (t.failure_count > 0) { rank += 12; why.push('failed before — known mechanism, most tractable +12'); }
  const ageDays = t.created_at ? Math.floor((Date.now() - Date.parse(t.created_at)) / 86400000) : 0;
  const age = Math.min(20, ageDays); if (age) { rank += age; why.push(`open ${ageDays}d +${age}`); }
  const owner = /owner/i.test(String(t.detail || '')) ? 15 : 0;
  if (owner) { rank += owner; why.push('named it +15'); }
  return { rank, rank_why: why.join(' + ') };
}

function rankComment(c) {
  const why = [];
  let rank = 0;
  const v = String(c.verdict || '').toUpperCase();
  const vTerm = /CONTRADICT|DISPROV/.test(v) ? 30 : /OBJECTION|MISSING/.test(v) ? 20 : 8;
  rank += vTerm; why.push(`verdict ${v || 'NOTE'} → ${vTerm}`);
  const ageDays = c.ts ? Math.floor((Date.now() - Date.parse(c.ts)) / 86400000) : 0;
  const age = Math.min(25, ageDays * 2); if (age) { rank += age; why.push(`unanswered ${ageDays}d +${age}`); }
  return { rank, rank_why: why.join(' + ') };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') || '';
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
  const objects = [];

  // Sources that fail must say so. This route once selected a column that does not exist
  // (work_tasks.task_id — the PK is `id`), and a bare catch swallowed the error for weeks: the
  // "one queue" silently served only comments and loop acts while claiming to be the whole queue.
  // A projection that cannot read a source now reports the source as broken instead of empty.
  const source_errors = [];

  // 1. governed work tasks
  try {
    const r = await env.DB.prepare(
      "SELECT id, objective, detail, state, priority, created_at, failure_count FROM work_tasks WHERE state IN ('open','leased','in_progress','evidence_submitted','repair_required') ORDER BY priority, id"
    ).all();
    for (const t of r.results || []) {
      const { rank, rank_why } = rankTask(t);
      objects.push({
        id: t.id, kind: 'task', subject: t.objective, source: 'work_object', actor: null,
        state: t.state, refs: { url: 'https://miscsubjects.com/api/work' }, evidence: 'acceptance tests on the task object',
        rank, rank_why, chain: true, owner_move: t.state === 'open' ? 'MODEL' : 'MODEL (leased)',
      });
    }
  } catch (e) { source_errors.push({ source: 'work_tasks', error: String(e?.message || e) }); }

  // 2. open model comments (the answer debt)
  try {
    const r = await env.DB.prepare(
      "SELECT id, slug, actor, verdict, body, ts FROM article_comments WHERE status='open' AND actor_kind='model' ORDER BY id DESC LIMIT 100"
    ).all();
    for (const c of r.results || []) {
      const { rank, rank_why } = rankComment(c);
      objects.push({
        id: 'comment-' + c.id, kind: 'comment', subject: String(c.body || '').slice(0, 140), source: 'model-comment', actor: c.actor,
        state: 'open', refs: { article: 'https://miscsubjects.com/a/' + c.slug + '#ledger-' + c.id }, evidence: 'an answer on the thread',
        rank, rank_why, chain: false, owner_move: 'MODEL',
      });
    }
  } catch (e) { source_errors.push({ source: 'article_comments', error: String(e?.message || e) }); }

  // 3. loop acts — what the content graph wants next
  try {
    const na = await (await fetch('https://miscsubjects.com/api/articles/next-acts?limit=10')).json();
    const acts = na.acts || na.queue || na.results || [];
    acts.slice(0, 10).forEach((a, i) => {
      const rank = 26 - i * 2;
      objects.push({
        id: 'loop-' + (a.id || i), kind: 'loop_act', subject: a.title || a.subject || a.act || JSON.stringify(a).slice(0, 100),
        source: 'next-acts', actor: null, state: 'open', refs: { queue: 'https://miscsubjects.com/api/articles/next-acts' },
        evidence: 'the published page and its receipts', rank, rank_why: `graph rank #${i + 1} → ${rank}`, chain: false, owner_move: 'MODEL',
      });
    });
  } catch (e) { source_errors.push({ source: 'next-acts', error: String(e?.message || e) }); }

  let out = objects;
  if (kind) out = out.filter((o) => o.kind === kind);
  out.sort((a, b) => b.rank - a.rank);
  return json({
    schema: 'miscsubjects/one-queue/1',
    spec: 'https://miscsubjects.com/a/one-queue-tasks-issues-comments',
    human_view: 'https://miscsubjects.com/a/the-queue',
    note: 'Computed rank, arithmetic printed per row (rank_why). Sources: work_tasks, article_comments (open, model), next-acts. GitHub issues enter via the flat intake (WT-0038) and join here when promoted.',
    counts: { total: out.length, by_kind: out.reduce((m, o) => ((m[o.kind] = (m[o.kind] || 0) + 1), m), {}) },
    source_errors,
    next: out[0] || null,
    objects: out.slice(0, limit),
  });
}
