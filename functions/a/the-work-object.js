// THE WORK OBJECT — human projection.
//
// This page and /api/work are two projections of one record (work_tasks + work_actions + laws).
// Neither is a copy: both call buildWorkProjection(). Editing a Markdown file in the repository
// changes nothing here, which is the point — the repository files are pointers, this is authority.

import { designLawHeader, designLawFooter, designLawStyles } from '../_lib/design_law.js';
import { buildWorkProjection } from '../_lib/work_object.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STATE_COLOR = {
  open: '#5b6570', leased: '#b7791f', in_progress: '#2b6cb0', evidence_submitted: '#6b46c1',
  accepted: '#2f855a', refused: '#c53030', failed: '#c53030', repair_required: '#b7791f', completed: '#276749',
};

export async function onRequestGet(context) {
  const { env, request } = context;
  const base = new URL(request.url).origin;
  const p = await buildWorkProjection(env, { base });

  const counts = Object.entries(p.counts)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `<span class="wo-pill" style="--c:${STATE_COLOR[s] || '#5b6570'}">${esc(s)} <b>${n}</b></span>`)
    .join('');

  const rows = p.tasks.map((t) => `
    <tr>
      <td class="wo-id"><a href="/api/work/task/${esc(t.task_id)}">${esc(t.task_id)}</a></td>
      <td><span class="wo-state" style="--c:${STATE_COLOR[t.state] || '#5b6570'}">${esc(t.state)}</span></td>
      <td class="wo-num">${esc(t.priority)}</td>
      <td>
        <div class="wo-obj">${esc(t.objective)}</div>
        ${t.depends_on.length ? `<div class="wo-meta">waits on ${t.depends_on.map((d) => esc(d)).join(', ')}</div>` : ''}
        ${t.parent_task ? `<div class="wo-meta">failure object attached to ${esc(t.parent_task)}</div>` : ''}
        ${t.failure ? `<div class="wo-meta">class: ${esc(t.failure.failure_class || '')} · layer: ${esc(t.failure.layer || '')}</div>` : ''}
      </td>
      <td class="wo-num">${t.acceptance_tests.length}</td>
      <td class="wo-num">${t.failure_count || 0}</td>
      <td class="wo-meta">${t.lease ? esc(t.lease.holder) + (t.lease.model ? ' · ' + esc(t.lease.model) : '') : '—'}</td>
    </tr>`).join('');

  const laws = p.governing_invariants.map((l) => `
    <article class="wo-law">
      <header><span class="wo-lawkey">${esc(l.key)}</span><span class="wo-lawlevel">${esc(l.level)}</span><span class="wo-lawcat">${esc(l.category)}</span></header>
      <p>${esc(l.rule)}</p>
      ${l.why ? `<p class="wo-why">${esc(l.why)}</p>` : ''}
    </article>`).join('');

  const actions = p.audit.recent.slice(0, 20).map((a) => `
    <tr>
      <td class="wo-meta">${esc(String(a.ts).replace('T', ' ').slice(0, 19))}</td>
      <td class="wo-id">${esc(a.task_id)}</td>
      <td>${esc(a.action)}</td>
      <td class="wo-meta">${esc(a.agent || '')}${a.model ? ' · ' + esc(a.model) : ''}</td>
      <td>${a.result ? `<span class="wo-res wo-res-${esc(a.result)}">${esc(a.result)}</span>` : ''}</td>
      <td class="wo-hash">${esc(String(a.hash || '').slice(0, 12))}</td>
    </tr>`).join('');

  const bypasses = p.unresolved_bypasses.map((b) => `
    <li><b>${esc(b.path)}</b><span>${esc(b.effect)}</span><em>${esc(b.status)}</em></li>`).join('');

  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'The work object — canonical operating record of miscsubjects.com',
    description: p._self.what,
    url: base + '/a/the-work-object',
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: base + '/api/work' }],
  });

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The work object — the canonical operating record</title>
<meta name="description" content="Every task, invariant, acceptance test, piece of evidence and failure that governs this build. Machine projection at /api/work.">
<script type="application/ld+json">${structured}</script>
<style>${designLawStyles()}
.wo-wrap{max-width:1120px;margin:0 auto;padding:0 20px 80px}
.wo-lede{font:400 19px/1.6 var(--font,ui-serif,Georgia,serif);max-width:74ch;margin:0 0 18px}
.wo-pills{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.wo-pill,.wo-state{display:inline-block;font:600 11px/1.5 ui-monospace,monospace;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--c);color:var(--c);border-radius:99px;padding:3px 10px}
.wo-card{border:1px solid var(--ds-line,#e3e6e8);border-radius:14px;padding:18px 20px;margin:22px 0;background:var(--ds-surface,#fff)}
.wo-card h2{font:700 15px/1.3 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;margin:0 0 12px}
table.wo{width:100%;border-collapse:collapse;font:400 14px/1.5 ui-sans-serif,system-ui,sans-serif}
table.wo th{text-align:left;font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-dim,#5b6570);border-bottom:1px solid var(--ds-line,#e3e6e8);padding:6px 8px}
table.wo td{border-bottom:1px solid var(--ds-line,#eef1f2);padding:9px 8px;vertical-align:top}
.wo-id,.wo-hash{font:400 12px/1.5 ui-monospace,monospace}
.wo-num{font:400 13px/1.5 ui-monospace,monospace;text-align:right;width:56px}
.wo-obj{font:400 14px/1.5 ui-sans-serif,system-ui,sans-serif}
.wo-meta{font:400 12px/1.5 ui-monospace,monospace;color:var(--ds-dim,#5b6570)}
.wo-res-accepted{color:#276749}.wo-res-refused{color:#c53030}.wo-res-recorded{color:#5b6570}
.wo-law{border-left:3px solid var(--ds-line,#e3e6e8);padding:2px 0 2px 14px;margin:14px 0}
.wo-law header{display:flex;gap:10px;align-items:center;margin-bottom:4px}
.wo-lawkey{font:600 11px/1.4 ui-monospace,monospace}
.wo-lawlevel,.wo-lawcat{font:600 9px/1.4 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-dim,#5b6570)}
.wo-law p{margin:0 0 4px;font:400 14px/1.55 ui-sans-serif,system-ui,sans-serif}
.wo-why{color:var(--ds-dim,#5b6570);font-size:13px!important}
.wo-next{border:2px solid #276749;border-radius:14px;padding:16px 18px;margin:22px 0}
.wo-next code{font:400 13px/1.6 ui-monospace,monospace;display:block;white-space:pre-wrap;margin-top:8px}
.wo-byp{list-style:none;padding:0;margin:0}
.wo-byp li{border-bottom:1px solid var(--ds-line,#eef1f2);padding:10px 0}
.wo-byp b{display:block;font:600 13px/1.5 ui-monospace,monospace}
.wo-byp span{display:block;font:400 14px/1.55 ui-sans-serif,system-ui,sans-serif}
.wo-byp em{display:block;font:400 12px/1.5 ui-monospace,monospace;color:var(--ds-dim,#5b6570)}
@media(prefers-color-scheme:dark){.wo-card{background:#12161a;border-color:#2a2f35}}
</style></head><body>
${designLawHeader('')}
<main class="wo-wrap">
<h1>The work object</h1>
<p class="wo-lede">${esc(p._self.what)}</p>
<p class="wo-lede"><b>Objective.</b> ${esc(p.objective)}</p>
<div class="wo-pills">${counts}</div>

<div class="wo-next">
  <h2>Next eligible action</h2>
  ${p.next_eligible_action.task_id
    ? `<div><b>${esc(p.next_eligible_action.task_id)}</b> — ${esc(p.next_eligible_action.objective)} (priority ${esc(p.next_eligible_action.priority)})</div>`
    : `<div>${esc(p.next_eligible_action.note)}</div>`}
  <code>curl -sS -X POST ${esc(base)}/api/work/lease -H 'content-type: application/json' \\
  -d '{"agent":"&lt;your name&gt;","model":"&lt;your model&gt;","capability_token":"&lt;scoped token&gt;"}'</code>
  <p class="wo-meta">Machine projection: <a href="/api/work">/api/work</a> · cold start: <a href="/api/work/bootstrap">/api/work/bootstrap</a> · audit: <a href="/api/work/audit">/api/work/audit</a></p>
</div>

<div class="wo-card">
  <h2>Tasks</h2>
  <table class="wo"><thead><tr><th>id</th><th>state</th><th>pri</th><th>objective</th><th>tests</th><th>fails</th><th>lease</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="7" class="wo-meta">no tasks</td></tr>'}</tbody></table>
</div>

<div class="wo-card">
  <h2>State machine — transitions are code, not prose</h2>
  <p class="wo-meta">${esc(p.state_machine.states.join(' · '))}</p>
  <table class="wo"><thead><tr><th>from</th><th>may become</th></tr></thead><tbody>
  ${Object.entries(p.state_machine.transitions).map(([from, to]) => `<tr><td class="wo-id">${esc(from)}</td><td class="wo-meta">${esc(to.join(', '))}</td></tr>`).join('')}
  </tbody></table>
  <p class="wo-meta">An agent cannot reach <b>completed</b> by asserting completion. It submits evidence; the acceptance tests are executed by the infrastructure and the state follows the result. Leases expire after ${esc(p.state_machine.lease_seconds)}s and the task returns to the queue.</p>
</div>

<div class="wo-card">
  <h2>Governing invariants (${p.governing_invariants.length})</h2>
  ${laws || '<p class="wo-meta">none</p>'}
</div>

<div class="wo-card">
  <h2>Audit — append only, hash chained</h2>
  <p class="wo-meta">head ${esc(p.audit.head_hash.slice(0, 24))} · action #${esc(p.audit.head_action)} · full log at <a href="/api/work/audit">/api/work/audit</a></p>
  <table class="wo"><thead><tr><th>when</th><th>task</th><th>action</th><th>agent</th><th>result</th><th>hash</th></tr></thead>
  <tbody>${actions || '<tr><td colspan="6" class="wo-meta">no actions yet</td></tr>'}</tbody></table>
</div>

<div class="wo-card">
  <h2>Unresolved bypasses</h2>
  <p class="wo-meta">Paths that can still change state or content without passing this object. Listed here so the gap is a record, not a claim in a chat message.</p>
  <ul class="wo-byp">${bypasses}</ul>
</div>
</main>
${designLawFooter()}
</body></html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
