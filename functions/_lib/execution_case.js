import { isPlausiblePublicEmail, registrableDomain } from './valid_tld.js';

const DECISIONS = new Set(['included', 'excluded']);

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function redactEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}…${email.slice(at)}`;
}

export function assertDecisionComplete(candidate) {
  const decision = String(candidate?.decision || '').trim().toLowerCase();
  if (!DECISIONS.has(decision)) throw new Error('decision_must_be_included_or_excluded');
  if (!String(candidate?.decision_reason || '').trim()) throw new Error('decision_reason_required');
  return true;
}

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function thirdPartyDirectory(url) {
  return /(?:^|\.)(linkedin\.com|crunchbase\.com|wikipedia\.org|facebook\.com|x\.com|twitter\.com)$/i
    .test(new URL(url).hostname);
}

export async function normalizeDiscoveredCandidates({ taskId, query, returned = [], now = new Date().toISOString() }) {
  if (!/^WT-\d{4}$/.test(String(taskId || ''))) throw new Error('task_id_required');
  if (!String(query || '').trim()) throw new Error('query_required');
  const queryText = String(query).trim();
  const querySha256 = await sha256(queryText);
  const out = [];
  for (let index = 0; index < returned.length; index++) {
    const raw = returned[index] || {};
    const name = String(raw.name || '').trim() || `(unnamed candidate ${index + 1})`;
    const officialUrl = cleanUrl(raw.website);
    const sourceUrl = cleanUrl(raw.source_url);
    const sourceQuote = String(raw.source_quote || '').trim();
    let decision = 'included';
    let decisionReason = String(raw.qualification_reason || '').trim();
    if (!officialUrl) {
      decision = 'excluded';
      decisionReason = 'Excluded because the discovery return did not contain a valid official website URL.';
    } else if (thirdPartyDirectory(officialUrl)) {
      decision = 'excluded';
      decisionReason = 'Excluded because the returned URL is a third-party directory, not the organization’s own public site.';
    } else if (!sourceUrl || thirdPartyDirectory(sourceUrl) || sourceQuote.length < 40) {
      decision = 'excluded';
      decisionReason = 'Excluded because no official source quote of at least 40 characters supports the qualification.';
    } else if (registrableDomain(sourceUrl) !== registrableDomain(officialUrl)) {
      // OWN-SITE INCLUSION RULE (Table Web cold audit, WT-0090): an inclusion must be supported by a
      // quote from the organization's OWN site, held to the same bar as an exclusion. A quote from a
      // third-party listicle (a Forbes line, a "top VCs" blog) is not the firm saying it about itself,
      // so the "why you were chosen" message would be quoting someone else's page about the recipient.
      decision = 'excluded';
      decisionReason = 'Excluded because the qualifying quote is from a third-party page, not the organization’s own official website; inclusions are held to the same own-site bar as exclusions.';
    } else if (!decisionReason) {
      decisionReason = 'Included because the organization’s own official site explicitly matches the query and supplies the qualifying quote.';
    }
    const candidateHash = await sha256([taskId, querySha256, index, name, officialUrl || ''].join('\n'));
    out.push({
      candidate_id: `cand_${candidateHash.slice(0, 20)}`,
      task_id: taskId,
      invocation_id: null,
      query_text: queryText,
      query_sha256: querySha256,
      organization_name: name,
      official_url: officialUrl,
      source_url: sourceUrl,
      source_quote: sourceQuote || null,
      skill_name: 'self-promotion',
      skill_version: 1,
      skill_hash: null,
      decision,
      decision_reason: decisionReason,
      lead_id: null,
      contact_status: decision === 'included' ? 'pending' : 'not_sought',
      contact_email: null,
      contact_email_sha256: null,
      contact_source_url: null,
      created_at: now,
      updated_at: now,
    });
  }
  return out;
}

// Bind candidate rows to the receipted invocation that produced them. Runs at the invocation
// ledger seam (logInvocation), so the GET invoke, POST invoke and automation paths all bind the
// same way and a runner never has to know its own receipt id. Included and excluded rows bind
// alike. Only rows still unbound change: a replay or a duplicate result can never rewrite an
// existing binding.
export async function bindCandidatesToInvocation(env, invocationId, resultText, now = new Date().toISOString()) {
  if (!env?.DB || !invocationId) return 0;
  const text = typeof resultText === 'string' ? resultText : '';
  if (!text.includes('"candidate_ids"') || !text.includes('"task_id"')) return 0;
  let parsed;
  try { parsed = JSON.parse(text); } catch { return 0; }
  const taskId = String(parsed?.task_id || '');
  const ids = Array.isArray(parsed?.candidate_ids)
    ? parsed.candidate_ids.filter((id) => typeof id === 'string' && /^cand_[0-9a-f]{20}$/.test(id))
    : [];
  if (!/^WT-\d{4}$/.test(taskId) || !ids.length) return 0;
  let bound = 0;
  for (let start = 0; start < ids.length; start += 50) {
    const chunk = ids.slice(start, start + 50);
    const result = await env.DB.prepare(
      `UPDATE execution_case_candidates SET invocation_id=?, updated_at=?
        WHERE task_id=? AND invocation_id IS NULL AND candidate_id IN (${chunk.map(() => '?').join(',')})`,
    ).bind(String(invocationId), now, taskId, ...chunk).run();
    bound += Number(result?.meta?.changes || 0);
  }
  return bound;
}

// Recipient disclosure (owner order, 2026-08-28, for the public launch): the party being emailed is
// a public organization, not a private person, and the whole point is that a recipient's own model can
// confirm who was contacted and why. So the contact address is shown in full, alongside its hash and a
// validity flag. Owner identity is never a recipient and is protected by separate laws; this only ever
// exposes third-party business addresses. `email_redacted` is retained for any caller that still wants
// the masked form.
export async function publicCandidate(candidate, { revealContact = true } = {}) {
  assertDecisionComplete(candidate);
  const email = String(candidate.contact_email || '').trim().toLowerCase();
  const contact = {
    status: candidate.contact_status || 'not_sought',
    source_url: candidate.contact_source_url || null,
    email: revealContact && email ? email : null,
    email_redacted: email ? redactEmail(email) : null,
    email_sha256: candidate.contact_email_sha256 || (email ? await sha256(email) : null),
    valid: candidate.contact_valid == null ? null : !!candidate.contact_valid,
  };
  return {
    candidate_id: candidate.candidate_id,
    task_id: candidate.task_id,
    organization_name: candidate.organization_name,
    official_url: candidate.official_url || null,
    query_text: candidate.query_text || null,
    source_url: candidate.source_url || null,
    source_quote: candidate.source_quote || null,
    invocation_id: candidate.invocation_id || null,
    receipt_url: candidate.invocation_id ? `https://miscsubjects.com/receipt/${candidate.invocation_id}` : null,
    canonical: candidate.canonical == null ? true : !!candidate.canonical,
    superseded_reason: candidate.superseded_reason || null,
    method: {
      skill: candidate.skill_name || null,
      version: candidate.skill_version || null,
      hash: candidate.skill_hash || null,
    },
    decision: candidate.decision,
    decision_reason: candidate.decision_reason,
    contact,
  };
}

export function summarizeExecutionCase(taskId, { candidates = [], sends = [], audits = [] } = {}) {
  const taskCandidates = candidates.filter((row) => row.task_id === taskId);
  const canon = taskCandidates.filter((row) => row.canonical == null || row.canonical);
  const taskSends = sends.filter((row) => row.task_id === taskId);
  const taskAudits = audits.filter((row) => row.task_id === taskId);
  return {
    task_id: taskId,
    candidates: canon.length,
    included: canon.filter((row) => row.decision === 'included').length,
    excluded: canon.filter((row) => row.decision === 'excluded').length,
    verified_public_contacts: taskCandidates.filter((row) => row.contact_status === 'verified_public').length,
    raw_discovery_decisions: taskCandidates.length,
    superseded_duplicates: taskCandidates.filter((row) => row.canonical === 0).length,
    provider_accepted_sends: taskSends.filter((row) => row.provider_status === 'accepted' && row.proof_id).length,
    executed_cold_audits: taskAudits.filter((row) => row.verdict_text && row.receipt_id).length,
  };
}

export async function loadExecutionCase(env, taskId, { candidateLimit = 1000, candidateOffset = 0, sendLimit = 100, auditLimit = 20, view = 'resolved' } = {}) {
  const task = await env.DB.prepare('SELECT id,objective,detail,state,created_at,completed_at FROM work_tasks WHERE id=?').bind(taskId).first();
  if (!task) return null;
  // The selection record shows ONE decision per firm — the canonical rows — because a public exhibit
  // that lists the same organization included in one row and excluded in another reads as decoration.
  // The full raw discovery record (every pass, including superseded duplicates) is still served with
  // ?view=raw, so nothing is hidden; the default is the deduped, resolved view.
  const canonicalOnly = view !== 'raw';
  const canonClause = canonicalOnly ? ' AND canonical=1' : '';
  const [candidateResult, sendResult, auditResult, totals] = await Promise.all([
    env.DB.prepare(`SELECT * FROM execution_case_candidates WHERE task_id=?${canonClause} ORDER BY created_at,candidate_id LIMIT ? OFFSET ?`).bind(taskId, candidateLimit, candidateOffset).all(),
    env.DB.prepare('SELECT * FROM execution_case_sends WHERE task_id=? ORDER BY sent_at,send_id LIMIT ?').bind(taskId, sendLimit).all(),
    env.DB.prepare('SELECT * FROM execution_case_audits WHERE task_id=? ORDER BY created_at,audit_id LIMIT ?').bind(taskId, auditLimit).all(),
    // Every count is task-scoped SQL over the whole table, never the fetched page. The headline
    // (resolved) counts are the deduped canonical decisions; raw_* preserves the full discovery total.
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND canonical=1) candidates,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND canonical=1 AND decision='included') included,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND canonical=1 AND decision='excluded') excluded,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND contact_status='verified_public') verified_public_contacts,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND canonical=1 AND invocation_id IS NOT NULL) receipt_bound_candidates,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1) raw_discovery_decisions,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND canonical=0) superseded_duplicates,
         (SELECT COUNT(*) FROM execution_case_candidates WHERE task_id=?1 AND contact_status='contact_invalid') contact_invalid,
         (SELECT COUNT(*) FROM execution_case_sends WHERE task_id=?1 AND provider_status='accepted' AND proof_id IS NOT NULL) provider_accepted_sends,
         (SELECT COUNT(*) FROM execution_case_audits WHERE task_id=?1 AND verdict_text IS NOT NULL AND receipt_id IS NOT NULL) executed_cold_audits`,
    ).bind(taskId).first(),
  ]);
  const candidates = candidateResult.results || [];
  const sends = sendResult.results || [];
  const audits = auditResult.results || [];
  const shownTotal = canonicalOnly ? Number(totals?.candidates || 0) : Number(totals?.raw_discovery_decisions || 0);
  return {
    task,
    summary: { task_id: taskId, ...totals },
    page: {
      view: canonicalOnly ? 'resolved' : 'raw',
      candidates_shown: candidates.length,
      candidates_offset: candidateOffset,
      candidates_total: shownTotal,
      next_offset: candidateOffset + candidates.length < shownTotal ? candidateOffset + candidates.length : null,
    },
    candidates: await Promise.all(candidates.map((c) => publicCandidate(c))),
    sends: sends.map((row) => ({
      send_id: row.send_id,
      candidate_id: row.candidate_id,
      subject: row.subject,
      body: row.body_public,
      body_sha256: row.body_sha256,
      review_status: row.review_status,
      review_receipt: row.review_receipt,
      provider_status: row.provider_status,
      provider_message_id: row.provider_message_id,
      proof_id: row.proof_id,
      verify_url: row.proof_id ? `https://miscsubjects.com/verify/${row.proof_id}` : null,
      invocation_id: row.invocation_id,
      sent_at: row.sent_at,
    })),
    audits: audits.map((row) => ({
      audit_id: row.audit_id,
      model: row.model,
      family: row.model_family,
      receipt_id: row.receipt_id,
      verdict: row.verdict_text,
      verdict_sha256: row.verdict_sha256,
      created_at: row.created_at,
    })),
  };
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function number(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function renderExecutionCaseHtml(data) {
  const taskId = data?.task?.id || data?.task?.task_id || 'unknown';
  const summary = data?.summary || {};
  const candidates = (data?.candidates || []).slice(0, 200);
  const sends = (data?.sends || []).slice(0, 100);
  const audits = data?.audits || [];
  const origin = 'https://miscsubjects.com';
  const candidateRows = candidates.map((row) => `<tr>
    <td><code>${esc(row.candidate_id)}</code>${row.receipt_url ? `<br><a href="${esc(row.receipt_url)}"><small>receipt</small></a>` : '<br><small>receipt lost in transit</small>'}</td>
    <td><a href="${esc(row.official_url)}">${esc(row.organization_name)}</a></td>
    <td><span class="decision ${esc(row.decision)}">${esc(row.decision)}</span><br>${esc(row.decision_reason)}</td>
    <td>${row.source_url ? `<a href="${esc(row.source_url)}">source</a>` : 'none'}${row.source_quote ? `<blockquote>${esc(row.source_quote)}</blockquote>` : ''}</td>
    <td>${esc(row.contact?.status)}${row.contact?.email ? `<br><code>${esc(row.contact.email)}</code>` : ''}${row.contact?.email_sha256 ? `<br><small>sha256 ${esc(row.contact.email_sha256)}</small>` : ''}</td>
  </tr>`).join('');
  const sendRows = sends.map((row) => `<article class="send">
    <p class="eyebrow">${esc(row.send_id)} · ${esc(row.provider_status)}</p>
    <h3>${esc(row.subject)}</h3>
    <p>${esc(row.body)}</p>
    <p><a href="${esc(row.verify_url)}">Open the public send receipt ${esc(row.proof_id)}</a></p>
  </article>`).join('');
  const auditRows = audits.map((row) => `<article class="audit">
    <p class="eyebrow">${esc(row.family)} · ${esc(row.receipt_id)}</p>
    <h3>${esc(row.model)}</h3>
    <p>${esc(row.verdict)}</p>
  </article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(taskId)} — inspect the work</title><meta name="description" content="A public, task-bound execution case: candidates, decisions, raw or redacted evidence, sends, audits and cryptographic verification.">
  <style>
    :root{color-scheme:light;--ink:#090909;--muted:#5d5d5d;--line:#d8d8d8;--paper:#fff;--soft:#f6f6f3;--measure:76rem}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.62 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#000;text-decoration:underline;text-underline-offset:.18em}a:hover{text-decoration-thickness:2px}::selection{background:#e6e6de;color:#000}
    header,main,footer{width:min(calc(100% - 32px),var(--measure));margin:auto}header{padding:28px 0 22px;border-bottom:2px solid #000}.brand{font-weight:800;text-decoration:none}.eyebrow{margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:750;color:var(--muted)}h1{max-width:18ch;margin:.15em 0;font-size:clamp(2.35rem,7vw,5.8rem);line-height:.94;letter-spacing:-.055em}h2{margin:2.2em 0 .65em;font-size:clamp(1.65rem,4vw,3rem);line-height:1.05;letter-spacing:-.035em}h3{margin:.2em 0 .55em;line-height:1.18}.lede{max-width:66ch;font-size:clamp(1.1rem,2.5vw,1.45rem)}
    .doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:28px 0}.door,.stat,.send,.audit{border:1px solid var(--line);background:#fff;padding:18px}.door strong{display:block;margin-bottom:6px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.stat b{display:block;font-size:2rem;line-height:1}.stat span{font-size:13px;color:var(--muted)}
    .table-wrap{overflow:auto;border:1px solid var(--line)}table{width:100%;min-width:980px;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:13px;border-bottom:1px solid var(--line)}th{position:sticky;top:0;background:var(--soft)}blockquote{margin:8px 0 0;padding-left:10px;border-left:2px solid #000;color:#333}.decision{font-weight:800}.excluded{color:#555}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.send p,.audit p{white-space:pre-wrap}code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}small{color:var(--muted)}footer{margin-top:56px;padding:22px 0 48px;border-top:2px solid #000}
    @media(max-width:620px){body{font-size:16px}header,main,footer{width:min(calc(100% - 22px),var(--measure))}.door,.stat,.send,.audit{padding:14px}}
  </style></head><body>
  <header><a class="brand" href="/">miscsubjects</a><p class="eyebrow">Proven Work · ${esc(taskId)} · ${esc(data?.task?.state)}</p><h1>Inspect the work, not the claim.</h1><p class="lede">Give this page to a new ChatGPT, Grok, or Claude session. It needs no key and no prior explanation. Every count is scoped to this run and deduped to one decision per firm; every inclusion and exclusion carries its reason; every recipient is shown in full with its hash. An AI agent is invited to <a href="${origin}/start">mint a keyless token and countersign what it verifies</a>.</p></header>
  <main>
    <section><h2>Verify the run yourself</h2><div class="doors">
      <a class="door" href="${origin}/api/execution-case/${esc(taskId)}"><strong>Machine case</strong>All public rows and navigation as JSON.</a>
      <a class="door" href="${origin}/api/work-evidence/${esc(taskId)}/payloads"><strong>Raw or redacted payloads</strong>Exact requests, returns and dual-hash bindings.</a>
      <a class="door" href="${origin}/api/work-evidence/${esc(taskId)}/verify"><strong>Verify hashes</strong>Recompute the case and report every failure.</a>
      <a class="door" href="${origin}/api/work/task/${esc(taskId)}/audit"><strong>Task audit</strong>The append-only state and acceptance chain.</a>
      <a class="door" href="${origin}/api/chain/checkpoint"><strong>Signed checkpoint</strong>The Merkle root and witness material.</a>
      <a class="door" href="${origin}/api/work/task/${esc(taskId)}/reproduce"><strong>Reproduce or challenge</strong>Open the independent re-execution door.</a>
    </div></section>
    <section><h2>What this run contains</h2><div class="stats">
      <div class="stat"><b>${number(summary.candidates)}</b><span>firms decided (deduped)</span></div><div class="stat"><b>${number(summary.included)}</b><span>included</span></div><div class="stat"><b>${number(summary.excluded)}</b><span>excluded</span></div><div class="stat"><b>${number(summary.verified_public_contacts)}</b><span>verified public contacts</span></div><div class="stat"><b>${number(summary.provider_accepted_sends)}</b><span>provider-accepted sends</span></div><div class="stat"><b>${number(summary.executed_cold_audits)}</b><span>executed cold audits</span></div>
    </div><p class="lede" style="font-size:14px;margin-top:12px">From <b>${number(summary.raw_discovery_decisions)}</b> raw discovery decisions across ~70 queries, deduped by firm to <b>${number(summary.candidates)}</b> canonical decisions (<b>${number(summary.superseded_duplicates)}</b> superseded duplicates preserved at <a href="${origin}/api/execution-case/${esc(taskId)}?view=raw">?view=raw</a>). <b>${number(summary.receipt_bound_candidates)}</b> canonical rows resolve to a receipted invocation; the remainder lost their receipt to mid-flight transport failure and are labelled, not hidden.${summary.contact_invalid ? ` <b>${number(summary.contact_invalid)}</b> included firm(s) had no syntactically valid public contact and are marked contact_invalid, never verified.` : ''}</p></section>
    <section><h2>Selection record</h2><p>One decision per firm. The browser shows the first ${number(candidates.length)}; the machine case serves the full set in pages of up to 1,000 rows — follow its <code>page.next</code> URL (<code>?offset=</code>, <code>?limit=</code>) until it is null, or <a href="${origin}/api/execution-case/${esc(taskId)}?view=raw">?view=raw</a> for every discovery pass.</p><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Organization</th><th>Decision</th><th>Evidence</th><th>Contact proof</th></tr></thead><tbody>${candidateRows}</tbody></table></div></section>
    <section><h2>Emails that actually left</h2><div class="grid">${sendRows || '<p>No provider-accepted sends are bound to this task yet.</p>'}</div></section>
    <section><h2>Cold-model verdicts</h2><div class="grid">${auditRows || '<p>No executed cold audits are bound to this task yet.</p>'}</div></section>
  </main><footer><a href="/a/the-run-that-found-you">Read the article that projects this case</a> · <a href="/start">Start cold</a></footer></body></html>`;
}
