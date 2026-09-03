// LLM / ledger widget renderers: llm_agent, audit_trail, user_entry.
// Consumed by functions/_lib/widgets.js. No business logic lives here.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function wrapStyle(style) {
  if (!style) return '';
  const parts = [];
  const transforms = [];
  if (style.rotate) transforms.push(`rotate(${Number(style.rotate)}deg)`);
  if (style.offset_x || style.offset_y) transforms.push(`translate(${Number(style.offset_x || 0)}px, ${Number(style.offset_y || 0)}px)`);
  if (transforms.length) parts.push(`transform:${transforms.join(' ')}`);
  if (style.pulse) parts.push('animation:widgetPulse 2.6s ease-in-out infinite');
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

const AGENT_LABEL = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  grok: 'Grok',
  kimi: 'Kimi',
  meta: 'Meta',
  perplexity: 'Perplexity',
};

function agentLabel(agent) {
  return AGENT_LABEL[String(agent).toLowerCase()] || (agent ? String(agent) : 'LLM');
}

function tsDisplay(ts) {
  return String(ts ?? '').slice(0, 19).replace('T', ' ');
}

export function llmAgentWidget(w) {
  const agent = String(w.agent || '').toLowerCase();
  const model = esc(w.model || agentLabel(agent));
  const role = esc(w.role || 'assistant');
  const prompt = esc(w.prompt || '');
  const response = esc(w.response || '');
  const hash = esc(w.hash || '');
  const ts = tsDisplay(w.ts || w.date || '');
  const ledgerUrl = esc(w.ledger_url || '');

  const followups = (Array.isArray(w.suggested_followups) ? w.suggested_followups : []).map(q => {
    const query = esc(q || '');
    return `<button class="mcfu" type="button" data-question="${query}" onclick="askWidget(this)">${query}</button>`;
  }).join('');

  return `<div class="widget mc"${wrapStyle(w.style)}><div class="mcard">` +
    `<div class="mc-h"><span class="mc-model">${model}</span><span class="mc-role">${role}</span></div>` +
    `<div class="mc-meta"><span class="mc-act">${esc(agent || 'llm')}</span>${ts ? `<span class="mc-date">${ts}</span>` : ''}</div>` +
    `<div class="mc-out">${response.slice(0, 280)}${response.length > 280 ? '…' : ''}</div>` +
    `<details class="mc-ins"><summary>inspect — prompt &amp; full response</summary>` +
      `<div class="mc-tenant">prompt</div><pre class="mc-pre">${prompt}</pre>` +
      `<div class="mc-tenant">response</div><pre class="mc-pre">${response}</pre>` +
    `</details>` +
    (followups ? `<div class="mc-fu"><span class="mc-fu-tenant">Ask a follow-up</span>${followups}</div>` : '') +
    `<div class="mc-foot">` +
      (hash ? `<span class="mc-hash">${hash.slice(0, 16)}</span>` : '') +
      (ledgerUrl ? `<a class="mc-ledger" href="${ledgerUrl}" target="_blank" rel="noopener">ledger →</a>` : '') +
    `</div>` +
    `</div></div>`;
}

export function auditTrailWidget(w) {
  const entries = Array.isArray(w.entries) ? w.entries : [];
  const head = esc(w.head || '');
  const verifyUrl = esc(w.verify_url || '');

  const rows = entries.map((e, i) => {
    const action = esc(e.action || '');
    const model = esc(e.model || '');
    const ts = tsDisplay(e.ts);
    const hash = esc(e.hash || '');
    const prev = i > 0 ? esc(entries[i - 1].hash || '') : '';
    return `<div class="at-row">` +
      `<div class="at-dot"></div>` +
      `<div class="at-link">${prev ? `<span class="at-prev" title="${prev}">↙</span>` : ''}</div>` +
      `<div class="at-body">` +
        `<div class="at-top"><span class="at-action">${action}</span>${model ? `<span class="at-model">${model}</span>` : ''}</div>` +
        `<div class="at-bottom">${ts}${hash ? ` · <code>${hash.slice(0, 16)}</code>` : ''}</div>` +
      `</div>` +
    `</div>`;
  }).join('');

  return `<div class="widget at"${wrapStyle(w.style)}><div class="at-card">` +
    `<div class="at-head">` +
      `<span class="at-title">Audit trail</span>` +
      (head ? `<span class="at-head-hash">head <code>${head.slice(0, 16)}</code></span>` : '') +
    `</div>` +
    `<div class="at-chain">${rows || '<div class="at-empty">No entries.</div>'}</div>` +
    (verifyUrl ? `<a class="at-verify" href="${verifyUrl}" target="_blank" rel="noopener">verify chain →</a>` : '') +
    `</div></div>`;
}

export function userEntryWidget(w) {
  const text = esc(w.text || '');
  const author = esc(w.author || 'anonymous');
  const subject = esc(w.subject || '');
  const context = esc(w.context || '');
  const ts = tsDisplay(w.ts || w.date || '');
  const hash = esc(w.hash || '');
  const ledgerUrl = esc(w.ledger_url || '');

  return `<div class="widget uew"${wrapStyle(w.style)}><div class="uew-card">` +
    `<div class="uew-h"><span class="uew-author">${author}</span><span class="uew-badge">reader entry</span></div>` +
    (subject ? `<div class="uew-subject">re: ${subject}</div>` : '') +
    `<div class="uew-text">${text}</div>` +
    (context ? `<div class="uew-ctx">${context}</div>` : '') +
    `<div class="uew-foot">` +
      (ts ? `<span class="uew-ts">${ts}</span>` : '') +
      (hash ? `<code class="uew-hash">${hash.slice(0, 16)}</code>` : '') +
      (ledgerUrl ? `<a class="uew-ledger" href="${ledgerUrl}" target="_blank" rel="noopener">ledger →</a>` : '') +
    `</div>` +
    `</div></div>`;
}

export function llmStyles() {
  return `
/* LLM / ledger widget chrome (llm_agent reuses existing .mcard classes) */
.mc-ledger{font:600 11px ui-sans-serif,system-ui,sans-serif;color:#96301c;text-decoration:none;margin-left:auto}
.mc-ledger:hover{text-decoration:underline}
.mc-fu{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)}
.mc-fu-tenant{display:block;font:700 9px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#5b6470;margin-bottom:8px}
.mcfu{font:600 12px/1.35 ui-sans-serif,system-ui,sans-serif;border:1px solid var(--line);border-radius:99px;padding:6px 12px;background:#fff;color:#3f4750;cursor:pointer;margin:0 6px 6px 0;transition:border-color .15s,color .15s}
.mcfu:hover{border-color:#96301c;color:#111111}

/* audit_trail */
.at{margin:30px 0}
.at-card{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:16px}
.at-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.at-title{font:700 13px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#96301c}
.at-head-hash{font:10px ui-monospace,monospace;color:#5b6470}
.at-chain{display:flex;flex-direction:column;gap:10px}
.at-row{display:flex;align-items:flex-start;gap:10px}
.at-dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--accent);margin-top:5px}
.at-link{flex:none;width:20px;text-align:center;font:10px ui-monospace,monospace;color:#5b6470}
.at-prev{display:inline-block;transform:rotate(-45deg)}
.at-body{flex:1}
.at-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
.at-action{font:600 14px/1.3 ui-sans-serif,system-ui,sans-serif;color:#111111}
.at-model{font:600 10px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#5b6470;border:1px solid var(--line);border-radius:6px;padding:2px 8px}
.at-bottom{font:11px ui-monospace,monospace;color:#5b6470}
.at-empty{font:13px ui-sans-serif,system-ui,sans-serif;color:#5b6470;padding:8px 0}
.at-verify{display:inline-block;margin-top:12px;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#96301c;text-decoration:none}
.at-verify:hover{text-decoration:underline}

/* user_entry */
.uew{margin:30px 0}
.uew-card{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:16px}
.uew-h{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
.uew-author{font:700 14px ui-sans-serif,system-ui,sans-serif;color:#111111}
.uew-badge{font:600 9px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--accent);border-radius:6px;padding:2px 8px}
.uew-subject{font:11px ui-monospace,monospace;color:#5b6470;margin-bottom:8px}
.uew-text{font:15px/1.6 var(--font);color:#3f4750;white-space:pre-wrap;overflow-wrap:anywhere}
.uew-ctx{font:12px/1.5 ui-sans-serif,system-ui,sans-serif;color:#5b6470;margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
.uew-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font:10px ui-monospace,monospace;color:#5b6470}
.uew-hash{font:10px ui-monospace,monospace;color:#5b6470}
.uew-ledger{font:600 11px ui-sans-serif,system-ui,sans-serif;color:#96301c;text-decoration:none}
.uew-ledger:hover{text-decoration:underline}
`;
}
