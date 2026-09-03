// Execution-case drafts, owner review, and provider sends — the lane between a verified
// contact and a provider-accepted send row that WT-class tasks count.
//
// The order is law, not convention: a draft row is born review_status='pending' and
// provider_status='not_sent'; only an owner review flips it to 'approved' (the review action is
// itself a ledger event and its id is written onto every row it approved); only an approved row
// can be sent; and provider_status becomes 'accepted' only from the send route's own response —
// a proof id minted on the public send ledger. Nothing here can mark work sent by saying so.

const SEND_ORDER = ['pending', 'approved', 'change', 'deleted'];

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalized(value) {
  return String(value || '').toLowerCase()
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\b\d[\d,.]*\b/g, '<n>')
    .replace(/[^a-z<>\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function duplicateGroups(rows, valueFor) {
  const groups = new Map();
  for (const row of rows) {
    const value = normalized(valueFor(row));
    if (!value) continue;
    const ids = groups.get(value) || [];
    ids.push(row.send_id);
    groups.set(value, ids);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1);
}

/** Corpus-wide pre-review gate. Per-letter validators cannot see template collapse, so approval
 *  uses this aggregate result rather than treating 103 individually lawful drafts as a lawful
 *  campaign. The companion placeholder is expanded to the public send receipt at send time. */
export function auditDraftCorpus(rows = []) {
  const active = rows.filter((row) => row.provider_status !== 'accepted' && row.review_status !== 'deleted');
  const audited = active.map((row) => {
    const subject = String(row.subject || '').trim();
    const body = String(row.body_public || '').trim();
    const companion = String(row.companion_post || '').trim();
    const lower = body.toLowerCase();
    const issues = [];
    if (subject.length > 50) issues.push('subject_over_50_chars');
    if (wordCount(body) < 70) issues.push('body_too_short');
    if (wordCount(body) > 145) issues.push('body_over_145_words');
    if (/redacted|hash-committed contact data|contact data is .*committed/i.test(body)) issues.push('stale_redaction_claim');
    if (!(lower.includes('what ') && lower.includes('where ') && lower.includes('who ') && body.includes('?'))) issues.push('recipient_questions_missing');
    if (!/https:\/\/miscsubjects\.com\/execution-case\/WT-\d{4}\b/.test(body)) issues.push('case_link_missing');
    if (!/Yours in civilization,\s*\n+\s*build@miscsubjects\.com\s*\n+\s*—\s*[^\n]+,\s*via\s+[^\n]+\s+authority\s*$/.test(body)) issues.push('send_law_closing_missing');
    if (!/@[A-Za-z0-9_]{1,15}\b/.test(companion)) issues.push('companion_handle_missing');
    if (!/#[A-Za-z][A-Za-z0-9_]*\b/.test(companion)) issues.push('companion_hashtag_missing');
    if (!/https:\/\/miscsubjects\.com\/a\/the-run-that-found-you\b/.test(companion)) issues.push('companion_article_link_missing');
    if (!companion.includes('{{VERIFY_URL}}')) issues.push('companion_verify_placeholder_missing');
    if (!/—\s*[^\n]+\([^\n]+\)\s*$/.test(companion)) issues.push('companion_signature_missing');
    if (companion.replace('{{VERIFY_URL}}', 'https://miscsubjects.com/verify/snd_1234567890abcdef').length > 280) issues.push('companion_over_280_chars');
    return { send_id: row.send_id, issues, subject_chars: subject.length, body_words: wordCount(body) };
  });

  const corpusIssues = [];
  for (const [value, ids] of duplicateGroups(active, (row) => row.subject)) {
    corpusIssues.push({ code: 'duplicate_subject', count: ids.length, send_ids: ids, value });
  }
  for (const [value, ids] of duplicateGroups(active, (row) => String(row.body_public || '').split(/\n\n/)[0])) {
    corpusIssues.push({ code: 'duplicate_opener', count: ids.length, send_ids: ids, value });
  }
  const shapes = new Map();
  for (const row of active) {
    const parts = String(row.body_public || '').split(/\n\n/);
    const tail = parts.slice(1).join('\n\n').replace(/Yours in civilization,[\s\S]*$/i, '');
    const shape = normalized(tail);
    const ids = shapes.get(shape) || [];
    ids.push(row.send_id);
    shapes.set(shape, ids);
  }
  for (const [value, ids] of [...shapes.entries()].filter(([, ids]) => ids.length >= 10)) {
    corpusIssues.push({ code: 'template_collapse', count: ids.length, send_ids: ids, value });
  }
  const issueCount = audited.reduce((sum, row) => sum + row.issues.length, 0) + corpusIssues.length;
  return { ok: issueCount === 0, rows: audited, corpus_issues: corpusIssues, issue_count: issueCount };
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function upsertDraft(env, { taskId, candidateId, subject, body, companion, now = new Date().toISOString() }) {
  if (!/^WT-\d{4}$/.test(String(taskId || ''))) return { error: 'task_id_required' };
  const cand = await env.DB.prepare(
    'SELECT candidate_id, task_id, decision, contact_status, organization_name, canonical FROM execution_case_candidates WHERE candidate_id=? AND task_id=?',
  ).bind(String(candidateId || ''), taskId).first();
  if (!cand) return { error: 'candidate_not_found', candidate_id: candidateId };
  if (cand.canonical === 0) return { error: 'candidate_superseded', candidate_id: candidateId, note: 'this is a deduped duplicate; draft against the firm’s canonical row' };
  if (cand.decision !== 'included') return { error: 'candidate_not_included', candidate_id: candidateId };
  if (cand.contact_status !== 'verified_public') return { error: 'contact_not_verified_public', candidate_id: candidateId, contact_status: cand.contact_status };
  const subj = String(subject || '').trim();
  const text = String(body || '').replace(/\r\n/g, '\n').trim();
  if (!subj || !text) return { error: 'subject_and_body_required' };
  const sendId = 'send_' + (await sha256Hex([taskId, cand.candidate_id].join('\n'))).slice(0, 16);
  const bodySha = await sha256Hex(text);
  await env.DB.prepare(
    `INSERT INTO execution_case_sends
       (send_id,task_id,candidate_id,subject,body_public,body_sha256,companion_post,review_status,provider_status,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,'pending','not_sent',?,?)
     ON CONFLICT(send_id) DO UPDATE SET
       subject=excluded.subject, body_public=excluded.body_public, body_sha256=excluded.body_sha256,
       companion_post=excluded.companion_post,
       review_status=CASE WHEN execution_case_sends.provider_status='accepted' THEN execution_case_sends.review_status ELSE 'pending' END,
       updated_at=excluded.updated_at`,
  ).bind(sendId, taskId, cand.candidate_id, subj, text, bodySha, companion ? String(companion).slice(0, 400) : null, now, now).run();
  const row = await env.DB.prepare('SELECT provider_status FROM execution_case_sends WHERE send_id=?').bind(sendId).first();
  if (row?.provider_status === 'accepted') return { error: 'already_sent_immutable', send_id: sendId };
  return { ok: true, send_id: sendId, candidate_id: cand.candidate_id, organization: cand.organization_name, body_sha256: bodySha };
}

export async function listSends(env, taskId, status) {
  const rows = (await env.DB.prepare(
    `SELECT s.send_id, s.candidate_id, s.subject, s.body_public, s.body_sha256, s.companion_post, s.review_status, s.review_receipt,
            s.provider_status, s.provider_message_id, s.proof_id, s.sent_at, s.created_at,
            c.organization_name, c.official_url, c.source_url, c.source_quote, c.query_text, c.contact_email
       FROM execution_case_sends s JOIN execution_case_candidates c ON c.candidate_id = s.candidate_id
      WHERE s.task_id=? ${status ? 'AND s.review_status=?' : ''}
      ORDER BY s.created_at, s.send_id`,
  ).bind(...(status ? [taskId, status] : [taskId])).all()).results || [];
  return rows;
}

export async function applyReview(env, { taskId, action, sendIds, receipt, now = new Date().toISOString() }) {
  const act = String(action || '').trim();
  if (!['approve', 'approve_all_pending', 'change', 'deleted'].includes(act)) return { error: 'unknown_action', allowed: ['approve', 'approve_all_pending', 'change', 'deleted'] };
  if (!receipt) return { error: 'receipt_required', note: 'the review action must be a ledger event before rows can point at it' };
  const status = act === 'approve' || act === 'approve_all_pending' ? 'approved' : act;
  if (status === 'approved') {
    const rows = await listSends(env, taskId);
    const quality = auditDraftCorpus(rows);
    if (!quality.ok) {
      return {
        error: 'draft_quality_gate_failed',
        note: 'approval is blocked until every selected letter and the aggregate corpus clear the outbound quality gate',
        quality,
      };
    }
  }
  if (act === 'approve_all_pending') {
    const r = await env.DB.prepare(
      "UPDATE execution_case_sends SET review_status='approved', review_receipt=?, updated_at=? WHERE task_id=? AND review_status='pending'",
    ).bind(String(receipt), now, taskId).run();
    return { ok: true, action: act, updated: r?.meta?.changes ?? 0, review_receipt: String(receipt) };
  }
  const ids = (Array.isArray(sendIds) ? sendIds : []).map(String).filter((x) => /^send_[0-9a-f]{16}$/.test(x));
  if (!ids.length) return { error: 'send_ids_required' };
  let updated = 0;
  for (const id of ids) {
    const r = await env.DB.prepare(
      "UPDATE execution_case_sends SET review_status=?, review_receipt=?, updated_at=? WHERE task_id=? AND send_id=? AND provider_status!='accepted'",
    ).bind(status, String(receipt), now, taskId, id).run();
    updated += r?.meta?.changes ?? 0;
  }
  return { ok: true, action: act, updated, review_receipt: String(receipt) };
}

export async function executeSend(env, { taskId, sendId, origin = 'https://miscsubjects.com', now = new Date().toISOString() }) {
  const row = await env.DB.prepare(
    `SELECT s.*, c.contact_email, c.organization_name, c.query_text, c.source_url
       FROM execution_case_sends s JOIN execution_case_candidates c ON c.candidate_id=s.candidate_id
      WHERE s.task_id=? AND s.send_id=?`,
  ).bind(taskId, String(sendId || '')).first();
  if (!row) return { error: 'send_not_found', send_id: sendId };
  if (row.review_status !== 'approved') return { error: 'not_approved', send_id: sendId, review_status: row.review_status };
  if (row.provider_status === 'accepted') return { ok: true, already: true, send_id: sendId, proof_id: row.proof_id };
  if (!row.contact_email) return { error: 'no_verified_contact', send_id: sendId };
  const selection = `Included for query "${String(row.query_text || '').slice(0, 200)}" — qualification source: ${row.source_url || 'recorded on the candidate row'} — case: ${origin}/execution-case/${taskId}`;
  let res;
  let text = '';
  try {
    res = await fetch(origin + '/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
      body: JSON.stringify({
        to: row.contact_email,
        subject: row.subject,
        text: row.body_public,
        from: 'build@miscsubjects.com',
        from_name: 'miscsubjects build',
        reply_to: 'build@miscsubjects.com',
        selection,
      }),
    });
    text = await res.text();
  } catch (e) {
    return { error: 'send_fetch_failed', detail: String(e?.message || e), send_id: sendId };
  }
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { /* recorded below as refusal */ }
  const proofId = parsed?.proof?.proof_id || null;
  const accepted = res.ok && !parsed?.error && !parsed?.refused && !!proofId;
  if (!accepted) {
    await env.DB.prepare(
      "UPDATE execution_case_sends SET provider_status='refused', updated_at=? WHERE send_id=?",
    ).bind(now, row.send_id).run();
    return { error: 'provider_refused', status: res.status, send_id: sendId, detail: String(text).slice(0, 400) };
  }
  await env.DB.prepare(
    `UPDATE execution_case_sends SET provider_status='accepted', provider_message_id=?, proof_id=?, sent_at=?, updated_at=? WHERE send_id=?`,
  ).bind(String(parsed.messageId || parsed.message_id || parsed.id || '') || null, proofId, now, now, row.send_id).run();
  // OUTBOUND_X_COMPANION law: every accepted send gets its paired X post, tagging the recipient and
  // linking the same verify receipt. Best-effort — a credit/transport failure records status, never
  // blocks or reverses the send (the email already left and is receipted).
  let companion = { status: 'none' };
  if (row.companion_post) {
    const verifyUrl = parsed?.proof?.verify_url || `${origin}/verify/${proofId}`;
    const postText = String(row.companion_post).replace('{{VERIFY_URL}}', verifyUrl);
    if (postText.length > 280) {
      companion = { status: 'failed', detail: `companion_over_280_chars:${postText.length}` };
      await env.DB.prepare('UPDATE execution_case_sends SET companion_status=?, companion_url=? WHERE send_id=?')
        .bind(companion.status, null, row.send_id).run();
      return { ok: true, send_id: row.send_id, to_domain: String(row.contact_email).split('@')[1] || null, proof_id: proofId, verify_url: verifyUrl, companion };
    }
    try {
      const xr = await fetch(origin + '/api/dispatch', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
        body: JSON.stringify({ key: 'X_POST', body: postText }),
      });
      const xt = await xr.text();
      let xj = {}; try { xj = JSON.parse(xt); } catch {}
      const url = xj?.url || xj?.result?.url || null;
      companion = { status: xr.ok && !xj?.error ? 'posted' : 'failed', url, detail: String(xt).slice(0, 160) };
    } catch (e) { companion = { status: 'failed', detail: String(e?.message || e).slice(0, 160) }; }
    await env.DB.prepare('UPDATE execution_case_sends SET companion_status=?, companion_url=? WHERE send_id=?')
      .bind(companion.status, companion.url || null, row.send_id).run();
  }
  return { ok: true, send_id: row.send_id, to_domain: String(row.contact_email).split('@')[1] || null, proof_id: proofId, verify_url: parsed?.proof?.verify_url || `${origin}/verify/${proofId}`, companion };
}

/** Persist one executed cold audit. Refuses a verdict with no resolvable receipt id. */
export async function recordAudit(env, { taskId, model, family, receiptId, verdictText, now = new Date().toISOString() }) {
  if (!/^WT-\d{4}$/.test(String(taskId || ''))) return { error: 'task_id_required' };
  const m = String(model || '').trim();
  const fam = String(family || '').trim().toLowerCase();
  const rid = String(receiptId || '').trim();
  const verdict = String(verdictText || '').trim();
  if (!m || !fam) return { error: 'model_and_family_required' };
  if (!rid) return { error: 'receipt_id_required', note: 'an audit with no invocation receipt did not execute' };
  if (verdict.length < 80) return { error: 'verdict_too_short', note: 'a real cold audit says what it checked and what it found — at least 80 characters' };
  const auditId = 'audit_' + (await sha256Hex([taskId, fam, rid].join('\n'))).slice(0, 16);
  await env.DB.prepare(
    `INSERT INTO execution_case_audits (audit_id,task_id,model,model_family,receipt_id,verdict_text,verdict_sha256,created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(audit_id) DO UPDATE SET verdict_text=excluded.verdict_text, verdict_sha256=excluded.verdict_sha256`,
  ).bind(auditId, taskId, m, fam, rid, verdict, await sha256Hex(verdict), now).run();
  return { ok: true, audit_id: auditId, model: m, family: fam, receipt_id: rid };
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderReviewHtml(taskId, rows) {
  const pending = rows.filter((r) => r.review_status === 'pending');
  const approved = rows.filter((r) => r.review_status === 'approved');
  const accepted = rows.filter((r) => r.provider_status === 'accepted');
  const quality = auditDraftCorpus(rows);
  const rowQuality = new Map(quality.rows.map((row) => [row.send_id, row]));
  const cards = rows.map((r) => `<article class="letter ${esc(r.review_status)}" id="${esc(r.send_id)}">
    <p class="meta"><b>${esc(r.organization_name)}</b> · <a href="${esc(r.official_url)}">${esc(r.official_url)}</a> · to <code>${esc(r.contact_email || '')}</code></p>
    <p class="meta">found for: ${esc(r.query_text)} · <a href="${esc(r.source_url)}">qualification source</a> · ${esc(r.send_id)} · ${esc(r.review_status)}${r.proof_id ? ' · sent, proof ' + esc(r.proof_id) : ''}</p>
    <h3>${esc(r.subject)}</h3>
    <pre>${esc(r.body_public)}</pre>
    ${r.companion_post ? `<p class="meta">companion X post (OUTBOUND_X_COMPANION law):</p><pre class="companion">${esc(r.companion_post)}</pre>` : ''}
    <p class="meta">body sha256 <code>${esc(r.body_sha256)}</code></p>
    ${(rowQuality.get(r.send_id)?.issues || []).length ? `<p class="quality bad">Quality findings: ${esc(rowQuality.get(r.send_id).issues.join(' · '))}</p>` : ''}
    ${r.review_status === 'pending' ? `${quality.ok ? `<button onclick="review('approve','${esc(r.send_id)}')">Approve this letter</button>` : ''}
    <button class="mute" onclick="review('deleted','${esc(r.send_id)}')">Delete</button>` : ''}
  </article>`).join('');
  const qualitySummary = quality.ok
    ? `<section class="quality good"><b>Quality gate passed.</b> ${quality.rows.length} active drafts; no per-letter or corpus findings.</section>`
    : `<section class="quality bad"><b>Quality gate blocked.</b> ${quality.issue_count} finding(s). ${esc(quality.corpus_issues.map((x) => `${x.code}:${x.count}`).join(' · '))}</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(taskId)} — exact review of every letter</title>
  <style>
    body{margin:0;background:#fff;color:#090909;font:16px/1.6 ui-sans-serif,-apple-system,sans-serif}
    main{width:min(calc(100% - 32px),52rem);margin:2rem auto 6rem}
    h1{font-size:2rem;letter-spacing:-.03em}
    .bar{position:sticky;top:0;background:#000;color:#fff;padding:14px 18px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
    .bar b{font-size:1.1rem}
    .bar button{background:#fff;color:#000;border:0;padding:10px 18px;font-weight:800;cursor:pointer}
    .letter{border:1px solid #d8d8d8;padding:18px;margin:14px 0}
    .letter.approved{border-left:4px solid #000}
    .letter.deleted{opacity:.4}
    .letter pre{white-space:pre-wrap;font:15px/1.6 ui-sans-serif,-apple-system,sans-serif;background:#f6f6f3;padding:14px;margin:8px 0}
    .meta{font-size:13px;color:#5d5d5d;margin:2px 0}
    .quality{padding:12px 14px;margin:12px 0;border:1px solid #bbb;font-size:14px}
    .quality.good{border-color:#247a3c;background:#f2fff5}.quality.bad{border-color:#a12622;background:#fff5f4}
    button{background:#000;color:#fff;border:0;padding:8px 14px;font-weight:700;cursor:pointer;margin-right:8px}
    button.mute{background:#e6e6e6;color:#000}
    code{font:12px ui-monospace,Menlo,monospace;overflow-wrap:anywhere}
  </style></head><body>
  <div class="bar"><b>${rows.length}</b> letters · ${pending.length} pending · ${approved.length} approved · ${accepted.length} provider-accepted
    ${pending.length && quality.ok ? `<button onclick="review('approve_all_pending')">Approve all ${pending.length} pending</button>` : ''}
    <span id="msg"></span></div>
  <main>
  <h1>Every letter, exactly as it will send.</h1>
  <p>These are the exact subjects and bodies. Approving writes one receipted review event and stamps its id on every approved row; nothing sends until a separate send step runs over approved rows only. The public send receipt is injected mechanically at send time, above the closing.</p>
  ${qualitySummary}
  ${cards || '<p>No drafts yet.</p>'}
  </main>
  <script>
  async function review(action, id){
    const body = { action: action };
    if (id) body.send_ids = [id];
    const r = await fetch('/api/execution-case/${esc(taskId)}/review', {method:'POST',headers:{'content-type':'application/json'},body: JSON.stringify(body)});
    const j = await r.json();
    document.getElementById('msg').textContent = j.ok ? ('recorded — ' + j.updated + ' row(s), receipt ' + j.review_receipt) : ('refused: ' + (j.error||r.status));
    if (j.ok) setTimeout(()=>location.reload(), 600);
  }
  </script>
  </body></html>`;
}
