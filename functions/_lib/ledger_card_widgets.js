import { formatTs, serviceLabel, svcColorForLabel } from './ledger_event_view.js';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toolsHtml(tools) {
  const list = (tools || []).filter(Boolean);
  if (!list.length) {
    return '<div class="tools-row"><span class="tools-empty">—</span></div>';
  }
  return '<div class="tools-row">' + list.map((t) =>
    '<span class="tool-chip">' + esc(t) + '</span>'
  ).join('') + '</div>';
}

// RAW PAYLOADS — the museum inside a card: every event's raw request/response, each with a
// baked copy-paste terminal command that pulls that exact event live.
function stepNarrative(e) {
  const key = e.key || '';
  const action = e.action || '';
  const actor = e.actor || '';
  if (action === 'turn_in' || action === 'message_in') return 'message came in';
  if (action === 'turn_out') return 'reply went back';
  if (action === 'http') return key + ' — HTTP call out and back';
  if (action === 'tools/call') return key + ' — tool call';
  if (action === 'bash') return (actor || 'shell') + ' ran a command';
  if (action === 'edit') return 'edited a file';
  if (action === 'fn') return key + ' — function ran';
  if (key === 'ROUTER') return 'router decided where to send it';
  return key || action || 'step';
}

// WHAT HAPPENED — the per-turn trace as a numbered sequence: each step = service + plain-English
// + status + time, expandable to its raw payload with a copy-paste command that pulls it live.
function whatHappenedHtml(events, opts) {
  const list = events || [];
  if (!list.length) return '';
  const curlGet = opts.curlGet || ((p) => p);
  const catColor = opts.catColor || (() => '#dedede');
  const rows = list.map((e, i) => {
    const svc = serviceLabel({ source: e.source, key: e.key || '' });
    const col = catColor(e.category);
    const t = e.ts ? formatTs(e.ts) : '';
    const ok = e.status != null && e.status >= 200 && e.status < 300;
    const status = e.status != null ? '<span class="wh-status ' + (ok ? 'ok' : 'fail') + '">' + esc(ok ? 'ok ' + e.status : 'FAIL ' + e.status) + '</span>' : '';
    const cmd = e.id ? curlGet('/admin/ledger/' + encodeURIComponent(e.id) + '?data=1') : '';
    const raw = (e.request || e.response)
      ? '<details class="wh-raw"><summary>raw payload</summary>' +
          (e.request ? '<div class="dlabel">request</div><pre>' + esc(e.request) + '</pre>' : '') +
          (e.response ? '<div class="dlabel">response</div><pre>' + esc(e.response) + '</pre>' : '') +
          (cmd ? '<div class="rp-term"><button type="button" class="copy-btn" onclick="copyText(' + esc(JSON.stringify(cmd)) + ', this)">copy</button><code class="term-cmd">' + esc(cmd) + '</code></div>' : '') +
        '</details>'
      : '';
    return '<div class="wh-step">' +
      '<div class="wh-n">' + (i + 1) + '</div>' +
      '<div class="wh-body">' +
        '<div class="wh-line">' +
          '<span class="wh-svc" style="background:' + esc(col) + '22;border-color:' + esc(col) + '66">' + esc(svc) + '</span>' +
          '<span class="wh-key">' + esc(e.key || e.action || 'step') + '</span>' + status +
          (t ? '<span class="wh-time">' + esc(t) + '</span>' : '') +
        '</div>' +
        '<div class="wh-what">' + esc(stepNarrative(e)) + '</div>' +
        raw +
      '</div>' +
    '</div>';
  }).join('');
  return '<details class="what-happened" open><summary>WHAT HAPPENED · ' + list.length + ' steps</summary>' + rows + '</details>';
}

export function heroCardStyles() {
  return `
.card-tools{margin-top:16px;border-radius:10px;border:1px solid #e8e8e8;overflow:hidden;background:#fafbfc}
.card-tools .tbar{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;border-bottom:1px solid #e8e8e8;background:#f4f5f7}
.tools-row{display:flex;flex-wrap:wrap;gap:6px;padding:12px 14px}
.tool-chip{font-size:11px;font-weight:700;padding:5px 11px;border-radius:99px;border:1px solid rgba(0,0,0,.1);background:#fff;font-family:var(--mono);color:#0a0a0a;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.tools-empty{color:#bbb;font-style:italic;font-size:13px}

/* ── OUTCOME strip — the one-glance verdict: did this turn deliver, and was it clean ── */
.outcome-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;margin-bottom:16px;border-radius:10px;border:1px solid var(--oc,#e8e8e8);background:color-mix(in srgb,var(--oc,#e8e8e8) 7%,#fff)}
.oc-verdict{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 12px;border-radius:99px;color:#fff;background:var(--oc,#999)}
.oc-verdict .oc-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.35)}
.oc-fact{font-size:11.5px;font-weight:600;color:#333;font-family:var(--mono);background:#fff;border:1px solid rgba(0,0,0,.08);padding:3px 10px;border-radius:99px;white-space:nowrap}
.oc-fact b{color:#0a0a0a}
.oc-fact.err{color:#c0392b;border-color:#e8b4b0;background:#fdf3f2}
.oc-audit{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:3px 10px;border-radius:99px;border:1px solid}
.oc-audit.pass{color:#0f7a3d;border-color:#bfe6cd;background:#eefaf2}
.oc-audit.fail{color:#c0392b;border-color:#eec4c0;background:#fdf0ef}
.oc-audit.other{color:#8a6d1a;border-color:#ecd9a0;background:#fdf8ea}
.oc-gh{font-size:11px;font-weight:700;color:#0a52d0;text-decoration:none;margin-left:auto;font-family:var(--mono)}
.oc-gh:hover{text-decoration:underline}
`;
}

// One-glance verdict for a turn: computed from what actually happened — the presence of a
// reply and the HTTP statuses of every step. Never inferred beyond the recorded events.
export function cardVerdict(c) {
  const events = c.events || [];
  const errs = events.filter((e) => typeof e.status === 'number' && e.status >= 400).length;
  const delivered = !!String(c.output || '').trim();
  if (delivered && errs === 0) return { label: 'DELIVERED', cls: 'ok', color: '#19a463', errs };
  if (delivered && errs > 0) return { label: 'DELIVERED · ' + errs + ' ERR', cls: 'warn', color: '#b8860b', errs };
  if (!delivered && errs > 0) return { label: 'FAILED', cls: 'fail', color: '#d93025', errs };
  return { label: 'NO REPLY CAPTURED', cls: 'silent', color: '#8a94a3', errs };
}

function durationOf(events) {
  const ts = (events || []).map((e) => Date.parse(e.ts)).filter((n) => !Number.isNaN(n));
  if (ts.length < 2) return '';
  const ms = Math.max(...ts) - Math.min(...ts);
  if (ms < 1000) return ms + 'ms';
  if (ms < 120000) return (ms / 1000).toFixed(1) + 's';
  return Math.round(ms / 60000) + 'm';
}

function outcomeStripHtml(c) {
  const v = cardVerdict(c);
  const events = c.events || [];
  const dur = durationOf(events);
  const audit = c.meta && c.meta.audit_verdict ? String(c.meta.audit_verdict) : '';
  const auditCls = /pass|ok|true/i.test(audit) ? 'pass' : (/fail|false|reject/i.test(audit) ? 'fail' : 'other');
  const gh = String(c.trace_id || '').match(/^gh-(\d+)$/);
  return '<div class="outcome-strip" style="--oc:' + esc(v.color) + '">' +
    '<span class="oc-verdict"><span class="oc-dot"></span>' + esc(v.label) + '</span>' +
    (events.length ? '<span class="oc-fact"><b>' + events.length + '</b> steps</span>' : '') +
    (v.errs ? '<span class="oc-fact err"><b>' + v.errs + '</b> failed</span>' : '') +
    (dur ? '<span class="oc-fact">' + esc(dur) + '</span>' : '') +
    ((c.tools_used || []).length ? '<span class="oc-fact"><b>' + c.tools_used.length + '</b> tools</span>' : '') +
    (audit ? '<span class="oc-audit ' + auditCls + '">audit: ' + esc(audit) + '</span>' : '') +
    (gh ? '<a class="oc-gh" href="https://github.com/[OWNER_HANDLE]/miscsubjects-pages/issues/' + gh[1] + '" target="_blank" rel="noopener">GitHub issue #' + gh[1] + ' ↗</a>' : '') +
  '</div>';
}

// BRAIN panel — the live system prompt of the agent that answered, editable in place.
// Saving PATCHes /api/directory/<key> via the page's savePrompt(); live on the next turn.
function brainPanelHtml(c) {
  const prompt = String(c.system_prompt || '');
  if (!prompt) return '';
  const agentKey = String(c.routed || '').trim();
  const editable = !!agentKey;
  const inner = editable
    ? '<textarea class="sp-edit" data-agent="' + esc(agentKey) + '" spellcheck="false">' + esc(prompt) + '</textarea>' +
      '<div class="sp-actions"><button type="button" class="sp-save" onclick="savePrompt(this)">Save prompt</button>' +
      '<span class="sp-status">edits ' + esc(agentKey) + ' · live on next turn</span></div>'
    : '<pre>' + esc(prompt) + '</pre><div class="sp-note">read-only — this turn\'s recorded prompt (no directory agent row to edit)</div>';
  return '<details class="brain-panel"><summary>🧠 SYSTEM PROMPT' +
    (agentKey ? ' · ' + esc(agentKey) : '') +
    '<span class="brain-note">' + (editable ? 'editable' : 'recorded') + '</span></summary>' + inner + '</details>';
}

// Label the inbound box by CHANNEL (how the message arrived) and the outbound box by AGENT
// (who answered) — not "mine/yours".
function channelLabel(c) {
  const src = String(c.source || '').toLowerCase();
  const actor = String(c.actor || '').toLowerCase();
  if (src === 'blooio') return 'via Blooio';
  if (src === '2chat') return 'via 2chat';
  if (src === 'grok-cli' || src === 'claude-code' || src.startsWith('cli-') || src === 'hook') return 'via my machine';
  if (['grok', 'claude', 'kimi'].includes(actor)) return 'via my machine';
  if (src === 'stripe' || src === 'github' || src === 'meta') return 'via ' + src;
  return 'via build';
}
function agentLabel(c) {
  const src = String(c.source || '').toLowerCase();
  const actor = String(c.actor || '').toLowerCase();
  const routed = String(c.routed || '');
  if (actor === 'grok' || src === 'grok-cli') return 'Grok CLI';
  if (actor === 'claude' || src === 'claude-code') return 'Claude CLI';
  if (actor === 'kimi') return 'Kimi CLI';
  if (src === 'grok') return 'Grok API';
  if (actor === 'router' || routed === 'ROUTER') return 'Router';
  if (routed && routed.toUpperCase() !== actor.toUpperCase()) return routed + ' (Router)';
  return actor || routed || 'build';
}

export function renderHeroLedgerCard(c, opts = {}) {
  const curlGet = opts.curlGet || ((p) => p);
  const catColor = opts.catColor || (() => '#dedede');
  const col = catColor(c.category);
  const svc = serviceLabel({ source: c.source, key: c.routed || c.key || '' });
  const svcCol = svcColorForLabel(svc);
  const you = String(c.input || '').trim();
  const agent = String(c.output || '').trim();
  const ts = c.time_short || formatTs(c.ts) || '';
  const tools = c.tools_used || [];
  const events = c.events || [];
  const cardCmd = curlGet('/admin/ledger?cards=1&card_id=' + encodeURIComponent(c.card_id || ''));
  const traceHref = c.trace_id ? '/admin/ledger?trace_id=' + encodeURIComponent(c.trace_id) + '&view=turns' : '';

  return '<div class="card" style="--card-accent:' + esc(svcCol) + '">' +
    '<div class="head">' +
      '<span class="src-badge" style="background:' + esc(svcCol) + ';color:#0a0a0a">' + esc(svc) + '</span>' +
      (c.actor ? '<span class="cat-badge" style="background:' + esc(col) + '22;border-color:' + esc(col) + '66">' + esc(c.actor) + '</span>' : '') +
      '<span class="cid">' + esc(c.card_id || '') + '</span>' +
      (c.routed ? '<span class="routed-arrow">→ ' + esc(c.routed) + '</span>' : '') +
      '<span class="when">' + esc(ts) + '</span>' +
      (traceHref ? '<a class="trace-link" href="' + esc(traceHref) + '" style="margin-left:auto">trace</a>' : '') +
    '</div>' +
    '<div class="body">' +
      outcomeStripHtml(c) +
      '<div class="hero-io">' +
        '<div class="hero-box in">' +
          '<div class="hbar"><span class="hicon">👤</span> ' + esc(channelLabel(c).toUpperCase()) + '</div>' +
          '<div class="hmsg">' + (you ? esc(you) : '<span style="color:#aaa">—</span>') + '</div>' +
        '</div>' +
        '<div class="hero-box out">' +
          '<div class="hbar"><span class="hicon">🤖</span> ' + esc(agentLabel(c).toUpperCase()) + '</div>' +
          '<div class="hmsg">' + (agent ? esc(agent) : '<span style="color:#aaa">—</span>') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-tools">' +
        '<div class="tbar">🔧 TOOLS USED</div>' +
        toolsHtml(tools) +
      '</div>' +
      brainPanelHtml(c) +
      '<div class="curl-block" style="margin-top:12px">' +
        '<div class="curl-bar"><span>terminal</span><button type="button" class="copy-btn" onclick="copyText(' + esc(JSON.stringify(cardCmd)) + ', this)">copy</button></div>' +
        '<pre>' + esc(cardCmd) + '</pre>' +
      '</div>' +
      whatHappenedHtml(events, { curlGet, catColor }) +
      '<details class="json-viewer" style="margin-top:16px"><summary class="jv-bar"><span>📦 full card JSON</span><span class="jv-type">' + esc(c.card_id || '') + '</span></summary><pre>' + esc(JSON.stringify(c, null, 2)) + '</pre></details>' +
    '</div>' +
  '</div>';
}

export function renderHeroLedgerCards(cards, opts = {}) {
  const inner = (cards || []).map((c) => renderHeroLedgerCard(c, opts)).join('');
  return inner || '<p class="empty">No turns in this filter.</p>';
}

// Legacy aliases — stop importing vault rail
export function ledgerCardStyles() { return heroCardStyles(); }
export function renderLedgerCardsRail(cards, opts = {}) { return renderHeroLedgerCards(cards, opts); }
