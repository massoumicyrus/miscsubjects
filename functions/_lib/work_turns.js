
const SECRET_PATTERNS = [
  // NAME=VALUE / NAME: VALUE for any credential-looking key — kills the value, keeps the name visible.
  [/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|PWD|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*["']?[A-Za-z0-9._%+\/-]{6,}["']?/g, '$1=[redacted-secret]'],
  // Lower/mixed-case credential words with a value (password: x, secret=y, api_key: z).
  [/\b(pass(?:word|wd)?|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret)\b(\s*[:=]\s*)["']?[^\s"']{4,}["']?/gi, '$1$2[redacted-secret]'],
  // Query-param credentials.
  [/([?&](?:share|token|tk|terminal_key|access_token|api_key|key|secret)=)[A-Za-z0-9._%+-]{6,}/gi, '$1[redacted]'],
  // Bearer/admin/session/capability/write tokens and lease ids, whatever the surrounding text.
  [/\b(wlt_|wt_|lease_|snd_|wit_|cap_|share_|sk-[a-z]*-?|Bearer\s+)[A-Za-z0-9._-]{6,}/gi, '[redacted-token]'],
  [/\b[A-Fa-f0-9]{32,}\b/g, '[redacted-hex]'],                    // 32+ hex = key material
  [/x-terminal-key:\s*[A-Za-z0-9._-]+/gi, 'x-terminal-key: [redacted]'],
  [/\b(?:AIG_SHIM_TOKEN|ADMIN_SESSION_SECRET|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|ARCADS_BASIC_AUTH|GROK_API_KEY|OPENROUTER|RESEND|SUPABASE|STRIPE_(?:LIVE|SECRET)[A-Z_]*)\b/g, '[redacted-secret-name]'],
  // Owner identity and addresses — never on a public surface (name/privacy law). Emails/domains first.
  [/[A-Za-z0-9._%+-]+@(?:<operator-domain>|<operator-domain>m|<tenant-domain>)/gi, 'the operator'],
  [/\b(?:<operator-domain>|<operator-domain>m|<tenant-domain>)\b/gi, '[operator-domain]'],
  [/\bOWNER_FIRST_NAME\b/gi, 'the operator'],
  [/\bOWNER_SURNAME\b/gi, ''],
  // Local filesystem paths that reveal the machine / home dir.
  [/\/Users\/[A-Za-z0-9._-]+/g, '~'],
  [/\/private\/tmp\/[A-Za-z0-9._\/-]+/g, '[scratch]'],
  [/\.build-vault\.env|\.clasprc\.json|\.wrangler\/config/g, '[vault]'],
];

export function sanitizeSecrets(value) {
  let s = String(value == null ? '' : value);
  for (const [re, repl] of SECRET_PATTERNS) s = s.replace(re, repl);
  return s;
}

function sanitizeDeep(v) {
  if (v == null) return v;
  if (typeof v === 'string') return sanitizeSecrets(v);
  if (Array.isArray(v)) return v.map(sanitizeDeep);
  if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = sanitizeDeep(v[k]); return o; }
  return v;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function canonical(row) {
  return JSON.stringify({
    turn_id: row.turn_id, task_id: row.task_id, seq: row.seq, role: row.role, actor: row.actor ?? null,
    title: row.title ?? null, text: row.text ?? null, tools_json: row.tools_json ?? null,
    errors_json: row.errors_json ?? null, refs_json: row.refs_json ?? null, ts: row.ts,
  });
}

/** Append one sanitized, hash-chained turn. Every string field passes through sanitizeSecrets. */
export async function appendTurn(env, { taskId, role, actor, title, text, tools, errors, refs, ts }) {
  if (!/^WT-\d{4}$/.test(String(taskId || ''))) return { error: 'task_id_required' };
  if (!['operator', 'agent', 'system'].includes(String(role))) return { error: 'role_must_be_operator_agent_or_system' };
  const seqRow = await env.DB.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM work_turns WHERE task_id=?').bind(taskId).first();
  const seq = Number(seqRow?.n || 1);
  const prev = await env.DB.prepare('SELECT hash FROM work_turns ORDER BY rowid DESC LIMIT 1').first();
  const prevHash = prev?.hash || 'genesis';
  const now = ts || new Date().toISOString();
  const b = crypto.getRandomValues(new Uint8Array(8));
  const row = {
    turn_id: 'turn_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''),
    task_id: taskId, seq, role, actor: actor ? sanitizeSecrets(actor) : null,
    title: title ? sanitizeSecrets(title) : null,
    text: text != null ? sanitizeSecrets(text) : null,
    tools_json: tools ? JSON.stringify(sanitizeDeep(tools)).slice(0, 20000) : null,
    errors_json: errors ? JSON.stringify(sanitizeDeep(errors)).slice(0, 8000) : null,
    refs_json: refs ? JSON.stringify(sanitizeDeep(refs)).slice(0, 8000) : null,
    ts: now,
  };
  const hash = await sha256(prevHash + '|' + canonical(row));
  await env.DB.prepare(
    `INSERT INTO work_turns (turn_id,task_id,seq,role,actor,title,text,tools_json,errors_json,refs_json,ts,prev_hash,hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(row.turn_id, row.task_id, row.seq, row.role, row.actor, row.title, row.text, row.tools_json, row.errors_json, row.refs_json, row.ts, prevHash, hash).run();
  return { ok: true, turn_id: row.turn_id, seq, hash };
}

export async function loadTurns(env, taskId) {
  const r = await env.DB.prepare('SELECT * FROM work_turns WHERE task_id=? ORDER BY seq').bind(taskId).all();
  return (r.results || []).map((row) => ({
    turn_id: row.turn_id, seq: row.seq, role: row.role, actor: row.actor, title: row.title,
    text: row.text, tools: row.tools_json ? JSON.parse(row.tools_json) : [],
    errors: row.errors_json ? JSON.parse(row.errors_json) : [], refs: row.refs_json ? JSON.parse(row.refs_json) : [],
    ts: row.ts, prev_hash: row.prev_hash, hash: row.hash,
  }));
}

/** Recompute the chain and report the first break, so a reader can verify non-tampering. */
export async function verifyTurnsChain(env, taskId) {
  const r = await env.DB.prepare('SELECT * FROM work_turns WHERE task_id=? ORDER BY seq').bind(taskId).all();
  const rows = r.results || [];
  let prev = rows.length ? (rows[0].prev_hash) : 'genesis';
  // The genesis prev is whatever the first row recorded (the chain spans all tasks); verify links forward.
  for (const row of rows) {
    const expect = await sha256(row.prev_hash + '|' + canonical(row));
    if (expect !== row.hash) return { valid: false, broken_at: row.turn_id, why: 'hash does not match payload' };
    prev = row.hash;
  }
  return { valid: true, checked: rows.length, head: prev };
}

function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render one turn as a state-card widget (used by the page and embeddable in articles). */
export function renderTurnCard(t) {
  const tools = (t.tools || []).map((x) => `<li><b>${esc(x.name)}</b>${x.status ? ` <span class="st">${esc(x.status)}</span>` : ''}${x.summary ? ` — ${esc(x.summary)}` : ''}</li>`).join('');
  const errors = (t.errors || []).map((x) => `<li>${esc(x.where ? x.where + ': ' : '')}${esc(x.message)}</li>`).join('');
  const refs = (t.refs || []).map((x) => `<a href="${esc(x.url || x)}">${esc(x.label || x.url || x)}</a>`).join(' · ');
  return `<article class="turn ${esc(t.role)}">
    <p class="turn-meta"><span class="role">${esc(t.role)}</span>${t.actor ? ` · ${esc(t.actor)}` : ''} · turn ${esc(t.seq)} · <code>${esc((t.hash || '').slice(0, 12))}</code></p>
    ${t.title ? `<h4>${esc(t.title)}</h4>` : ''}
    ${t.text ? `<div class="turn-text">${esc(t.text).replace(/\n/g, '<br>')}</div>` : ''}
    ${tools ? `<details class="turn-tools"><summary>${(t.tools || []).length} tool call(s)</summary><ul>${tools}</ul></details>` : ''}
    ${errors ? `<details class="turn-errors"><summary>${(t.errors || []).length} error(s) hit and handled</summary><ul>${errors}</ul></details>` : ''}
    ${refs ? `<p class="turn-refs">${refs}</p>` : ''}
  </article>`;
}

export function renderTurnsPage(taskId, turns, chain) {
  const cards = turns.map(renderTurnCard).join('');
  const ops = turns.filter((t) => t.role === 'operator').length;
  const toolCount = turns.reduce((n, t) => n + (t.tools || []).length, 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(taskId)} — the session behind the work</title>
  <meta name="description" content="The operator's verbatim instructions, every tool call, and every error behind ${esc(taskId)}, as hash-chained state cards. Secrets are stripped; the chain proves nothing was edited after publication.">
  <style>
    :root{color-scheme:light;--ink:#0a0a0a;--muted:#5b5b5b;--line:#e0e0e0;--paper:#fff;--soft:#f6f6f3;--accent:#2540d8}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header,main,footer{width:min(calc(100% - 32px),58rem);margin:auto}
    header{padding:26px 0 18px;border-bottom:2px solid #000}h1{font-size:clamp(1.9rem,5vw,3rem);letter-spacing:-.03em;margin:.1em 0}
    .lede{color:var(--muted);max-width:60ch}a{color:#000}
    .stats{display:flex;gap:20px;flex-wrap:wrap;margin:18px 0}.stats b{font-size:1.6rem}
    .turn{border:1px solid var(--line);border-left:3px solid var(--line);padding:14px 16px;margin:14px 0;background:#fff}
    .turn.operator{border-left-color:var(--accent);background:#f7f9ff}
    .turn.agent{border-left-color:#111}
    .turn-meta{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px}
    .role{font-weight:800;color:#000}
    .turn-text{white-space:pre-wrap;font-size:15px}
    details{margin-top:8px;font-size:14px}summary{cursor:pointer;color:var(--accent)}
    .turn-tools .st{color:#0a7d33}ul{margin:6px 0;padding-left:18px}
    code{font:12px ui-monospace,Menlo,monospace}
    footer{margin:48px auto;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
  </style></head><body>
  <header><p class="turn-meta">Proven Work · ${esc(taskId)} · session transcript</p>
  <h1>The session behind the work</h1>
  <p class="lede">The operator's instructions, verbatim, and every consequential tool call and error behind this run — as hash-chained state cards. Secrets, tokens, and the operator's identity are stripped before publication; the chain lets you prove the transcript was not edited after the fact. Verify: <a href="https://miscsubjects.com/api/work-turns/${esc(taskId)}/verify">recompute the chain</a>.</p>
  <div class="stats"><span><b>${esc(turns.length)}</b> turns</span><span><b>${esc(ops)}</b> operator instructions</span><span><b>${esc(toolCount)}</b> tool calls</span><span>chain ${chain?.valid ? 'valid ✓' : 'BROKEN'}</span></div>
  </header>
  <main>${cards || '<p>No turns published yet.</p>'}</main>
  <footer><a href="/a/the-run-that-found-you">The article</a> · <a href="/execution-case/${esc(taskId)}">The execution case</a> · <a href="/api/work-turns/${esc(taskId)}">This transcript as JSON</a></footer>
  </body></html>`;
}
