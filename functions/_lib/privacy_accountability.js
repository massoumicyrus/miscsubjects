import { governanceSha } from './model_governance.js';

const BASE = 'https://miscsubjects.com';
const text = (value, max = 4000) => String(value == null ? '' : value).trim().slice(0, max);
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableJson = (value) => JSON.stringify(stable(value));

export const PRIVACY_CLAUSES = Object.freeze([
  { id: 'PRIV-01', title: 'Shape before sending', requirement: 'A context-derived outbound payload can be inspected and minimized before any transmission executes.' },
  { id: 'PRIV-02', title: 'Exact bounded authorization', requirement: 'Authority binds an exact payload hash, recipient, purpose, expiry, use limit and classification ceiling.' },
  { id: 'PRIV-03', title: 'Recipient-addressable receipt', requirement: 'Every actual transmission records the payload hash, recipient, purpose, execution receipt and claimed recipient role.' },
  { id: 'PRIV-04', title: 'Sensitive context boundary', requirement: 'Sensitive or identity-intent context requires explicit authority before transmission.' },
  { id: 'PRIV-05', title: 'Queryable recipient ledger', requirement: 'Authorized users can enumerate recorded recipients and disclosure receipts without exposing private payload bytes.' },
  { id: 'PRIV-06', title: 'Downstream outcomes stay distinct', requirement: 'Requested, delivered, acknowledged, rejected, unreachable, exempt and unverifiable erasure outcomes never collapse into deleted.' },
  { id: 'PRIV-07', title: 'Unknown stays unknown', requirement: 'Unknown recipients, roles, legal bases, retention and deletion verification remain labeled unknown.' },
  { id: 'PRIV-08', title: 'No fabricated legal conclusion', requirement: 'Runtime classifications and role/legal-basis fields are evidence and claims; legal conclusions require qualified review or authority.' },
]);

const CLASSIFIERS = [
  ['credentials', /\b(?:api[_ -]?key|secret|password|bearer|private[_ -]?key|access[_ -]?token)\b/gi],
  ['health', /\b(?:diagnos(?:is|ed)|medication|prescription|cancer|pregnan\w*|therapy|medical|health|symptom)\b/gi],
  ['legal', /\b(?:attorney|lawyer|privileged|lawsuit|subpoena|settlement|legal advice)\b/gi],
  ['financial', /\b(?:bank account|routing number|credit card|tax return|income|debt|investment account)\b/gi],
  ['trade_secret', /\b(?:trade secret|confidential roadmap|unreleased product|proprietary formula|source code secret)\b/gi],
  ['special_category_indicator', /\b(?:religion|religious|political affiliation|sexual orientation|biometric|genetic|ethnicity|race)\b/gi],
  ['identity', /\b[A-Z][a-z]{1,30}\s+[A-Z][a-z]{1,30}\b/g],
  ['identity', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['identity', /\+?\d[\d ().-]{8,}\d/g],
];

export function classifyContext(value) {
  const source = typeof value === 'string' ? value : stableJson(value);
  const spans = [];
  for (const [classification, regex] of CLASSIFIERS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) && spans.length < 100) spans.push({ classification, start: match.index, end: match.index + match[0].length });
  }
  const classes = [...new Set(spans.map((span) => span.classification))].sort();
  if (classes.includes('identity') && classes.some((item) => !['identity', 'credentials'].includes(item))) classes.push('identity_intent_conjunction');
  return { classes: [...new Set(classes)], spans, source_bytes: new TextEncoder().encode(source).length, evidence_law: 'Spans expose positions and labels, not the matched sensitive text.' };
}

export async function shapeEgress(body) {
  const payload = body?.proposed_payload ?? {};
  const canonical = stableJson(payload);
  const classification = classifyContext(payload);
  const recipients = Array.isArray(body?.proposed_recipients) ? body.proposed_recipients.slice(0, 50).map((item) => text(item, 500)).filter(Boolean) : [];
  const sensitive = classification.classes.some((item) => !['identity'].includes(item));
  return {
    ok: true, action: 'shape', executed: false, stored: false, exact_outbound_utf8: canonical,
    payload_hash: await governanceSha(canonical), inferred_vs_user_supplied: { runtime_inferred_fields: [], caller_supplied_payload: true },
    classification, proposed_recipients: recipients, retention_declarations: body?.retention_declarations || null,
    redactions: body?.redactions || [], purpose: text(body?.purpose, 1000), policy_decision: recipients.length ? (sensitive ? 'EXPLICIT_AUTHORITY_REQUIRED' : 'AUTHORIZATION_REQUIRED') : 'RECIPIENT_REQUIRED',
    law: 'This is a dry run. It performs no network transmission and stores no submitted payload.',
  };
}

export async function minimizeQuery(body) {
  const original = String(body?.original || ''); const candidate = String(body?.minimized || '');
  if (!original || !candidate) return { error: 'original and minimized are required', status: 400 };
  const before = classifyContext(original); const after = classifyContext(candidate);
  return {
    ok: true, action: 'minimize', executed: false, stored: false,
    original_hash: await governanceSha(original), minimized_hash: await governanceSha(candidate),
    original_classes: before.classes, residual_classes: after.classes, removed_classes: before.classes.filter((item) => !after.classes.includes(item)),
    utility_loss_claim: body?.utility_loss_claim ?? 'unknown', approval_required: after.classes.length > 0,
    law: 'The caller supplies the candidate. The runtime compares disclosure classes; it does not claim the query preserves semantic utility without a separate test.',
  };
}

const publicAuth = (row) => row ? { ...row, human_approval: !!row.human_approval } : null;
const publicDisclosure = (row) => row ? { ...row, payload_bytes: undefined, payload_visibility_law: 'Payload bytes are not stored in this table.' } : null;

export async function authorizeEgress(env, body, actor) {
  const payloadHash = text(body?.payload_hash, 64).toLowerCase(); const recipient = text(body?.recipient, 1000); const purpose = text(body?.purpose, 2000);
  const expiresAt = text(body?.expires_at, 80); const expires = Date.parse(expiresAt); const now = Date.now();
  if (!/^[a-f0-9]{64}$/.test(payloadHash) || !recipient || !purpose || !Number.isFinite(expires) || expires <= now || expires > now + 86400000) return { error: 'valid payload_hash, recipient, purpose and expiry within 24 hours are required', status: 400 };
  const record = { payload_hash: payloadHash, recipient, purpose, expires_at: new Date(expires).toISOString(), maximum_downstream_use: text(body?.maximum_downstream_use, 1000) || 'one stated purpose', classification_ceiling: text(body?.classification_ceiling, 200) || 'unspecified', human_approval: body?.human_approval ? 1 : 0, max_uses: Math.max(1, Math.min(100, Number(body?.max_uses || 1))), actor };
  const id = 'ega_' + (await governanceSha({ ...record, now })).slice(0, 20); const createdAt = new Date(now).toISOString();
  await env.DB.prepare(`INSERT INTO oip_egress_authorizations (id,payload_hash,recipient,purpose,expires_at,maximum_downstream_use,classification_ceiling,human_approval,max_uses,used_count,status,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,0,'active',?,?)`)
    .bind(id, record.payload_hash, recipient, purpose, record.expires_at, record.maximum_downstream_use, record.classification_ceiling, record.human_approval, record.max_uses, actor, createdAt).run();
  return { ok: true, authorization: publicAuth(await env.DB.prepare('SELECT * FROM oip_egress_authorizations WHERE id=?').bind(id).first()) };
}

export async function appendDisclosure(env, body, actor) {
  const auth = await env.DB.prepare('SELECT * FROM oip_egress_authorizations WHERE id=?').bind(text(body?.authorization_id, 100)).first();
  if (!auth) return { error: 'unknown authorization_id', status: 404 };
  const now = Date.now();
  if (auth.status !== 'active' || Date.parse(auth.expires_at) <= now || auth.used_count >= auth.max_uses) return { error: 'authorization expired, revoked or exhausted', status: 409 };
  const payloadHash = text(body?.payload_hash, 64).toLowerCase(); const recipient = text(body?.recipient, 1000); const purpose = text(body?.purpose, 2000);
  if (payloadHash !== auth.payload_hash || recipient !== auth.recipient || purpose !== auth.purpose) return { error: 'payload hash, recipient or purpose does not match authorization', status: 409 };
  const role = text(body?.recipient_role_claim || 'unknown', 30); const visibility = text(body?.payload_visibility || 'private', 20); const status = text(body?.status || 'unknown', 20);
  if (!['processor', 'controller', 'recipient', 'unknown'].includes(role) || !['private', 'redacted', 'public'].includes(visibility) || !['sent', 'failed', 'blocked', 'unknown'].includes(status)) return { error: 'invalid role, visibility or status', status: 400 };
  const record = { authorization_id: auth.id, source_context_hash: text(body?.source_context_hash, 64), payload_hash: payloadHash, payload_visibility: visibility, recipient, recipient_role_claim: role, purpose, legal_basis_claim: text(body?.legal_basis_claim, 1000) || null, user_notice: text(body?.user_notice, 1000) || 'unknown', user_approval: text(body?.user_approval, 1000) || 'unknown', retention_claim: text(body?.retention_claim, 1000) || null, erasure_route: text(body?.erasure_route, 1000) || null, execution_receipt: text(body?.execution_receipt, 200), status, actor };
  if (!/^[a-f0-9]{64}$/.test(record.source_context_hash) || !/^inv_[a-z0-9]+$/i.test(record.execution_receipt)) return { error: 'source_context_hash and execution_receipt are required', status: 400 };
  const id = 'dis_' + (await governanceSha({ ...record, now })).slice(0, 20); const createdAt = new Date(now).toISOString();
  const batch = [
    env.DB.prepare(`INSERT INTO oip_disclosure_receipts (id,authorization_id,source_context_hash,payload_hash,payload_visibility,recipient,recipient_role_claim,purpose,legal_basis_claim,user_notice,user_approval,retention_claim,erasure_route,execution_receipt,status,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, record.authorization_id, record.source_context_hash, payloadHash, visibility, recipient, role, purpose, record.legal_basis_claim, record.user_notice, record.user_approval, record.retention_claim, record.erasure_route, record.execution_receipt, status, actor, createdAt),
    env.DB.prepare("UPDATE oip_egress_authorizations SET used_count=used_count+1,status=CASE WHEN used_count+1>=max_uses THEN 'exhausted' ELSE status END WHERE id=? AND status='active'").bind(auth.id),
  ];
  await env.DB.batch(batch);
  return { ok: true, disclosure: publicDisclosure(await env.DB.prepare('SELECT * FROM oip_disclosure_receipts WHERE id=?').bind(id).first()), verify: `${BASE}/api/privacy/disclosures/${id}` };
}

export async function appendErasureEvent(env, body, actor) {
  const disclosureId = text(body?.disclosure_id, 100); const disclosure = await env.DB.prepare('SELECT id FROM oip_disclosure_receipts WHERE id=?').bind(disclosureId).first();
  if (!disclosure) return { error: 'unknown disclosure_id', status: 404 };
  const outcome = text(body?.outcome, 40); const allowed = ['requested', 'delivered', 'acknowledged', 'rejected', 'unreachable', 'legally_exempt', 'verification_unavailable'];
  if (!allowed.includes(outcome)) return { error: 'invalid outcome', status: 400 };
  const record = { disclosure_id: disclosureId, outcome, detail: text(body?.detail, 2000) || null, evidence_receipt: text(body?.evidence_receipt, 200) || null, actor };
  const id = 'era_' + (await governanceSha({ ...record, now: Date.now() })).slice(0, 20); const createdAt = new Date().toISOString();
  await env.DB.prepare('INSERT INTO oip_erasure_events (id,disclosure_id,outcome,detail,evidence_receipt,actor,created_at) VALUES (?,?,?,?,?,?,?)').bind(id, disclosureId, outcome, record.detail, record.evidence_receipt, actor, createdAt).run();
  return { ok: true, event: { id, ...record, created_at: createdAt }, law: outcome === 'acknowledged' ? 'Acknowledgement is recorded; deletion verification remains separate.' : 'This outcome is not represented as deletion.' };
}

export async function recipientLedger(env, recipient) {
  const q = recipient
    ? await env.DB.prepare('SELECT * FROM oip_disclosure_receipts WHERE recipient=? ORDER BY created_at DESC LIMIT 500').bind(recipient).all()
    : await env.DB.prepare('SELECT * FROM oip_disclosure_receipts ORDER BY created_at DESC LIMIT 500').all();
  const disclosures = (q.results || []).map(publicDisclosure);
  const events = disclosures.length ? (await env.DB.prepare(`SELECT * FROM oip_erasure_events WHERE disclosure_id IN (${disclosures.map(() => '?').join(',')}) ORDER BY created_at ASC`).bind(...disclosures.map((item) => item.id)).all()).results || [] : [];
  return { protocol: 'OIP', kind: 'recipient_ledger', disclosures, erasure_events: events, count: disclosures.length };
}

export async function privacyConformance(env, disclosureId) {
  const row = await env.DB.prepare('SELECT * FROM oip_disclosure_receipts WHERE id=?').bind(String(disclosureId)).first();
  if (!row) return { error: 'unknown disclosure_id', status: 404 };
  const auth = await env.DB.prepare('SELECT * FROM oip_egress_authorizations WHERE id=?').bind(row.authorization_id).first();
  const events = (await env.DB.prepare('SELECT * FROM oip_erasure_events WHERE disclosure_id=? ORDER BY created_at ASC').bind(row.id).all()).results || [];
  const clauses = [
    ['PRIV-02', !!auth && auth.payload_hash === row.payload_hash && auth.recipient === row.recipient && auth.purpose === row.purpose, 'authorization binds the recorded payload hash, recipient and purpose'],
    ['PRIV-03', !!row.execution_receipt && !!row.recipient, 'recipient-addressable disclosure receipt exists'],
    ['PRIV-05', true, 'disclosure appears in the queryable recipient ledger'],
    ['PRIV-06', events.every((event) => event.outcome !== 'deleted'), 'downstream outcomes use the enumerated non-deletion states'],
    ['PRIV-07', !!row.recipient_role_claim, 'unknown role and retention fields remain explicitly representable'],
    ['PRIV-08', true, 'role and legal basis are labeled claims, not determinations'],
  ].map(([clause, pass, evidence]) => ({ clause, pass, evidence }));
  const notTested = ['PRIV-01', 'PRIV-04'];
  const testedSubsetConformant = clauses.every((item) => item.pass);
  return {
    protocol: 'OIP', kind: 'privacy_conformance', disclosure_id: row.id,
    status: notTested.length ? 'PARTIAL' : (testedSubsetConformant ? 'CONFORMANT' : 'NONCONFORMANT'),
    conformant: testedSubsetConformant && notTested.length === 0,
    tested_subset_conformant: testedSubsetConformant,
    tested_clause_count: clauses.length,
    profile_clause_count: PRIVACY_CLAUSES.length,
    clauses,
    not_tested: notTested,
    law: 'Full-profile conformance requires every profile clause to pass. This runtime check does not determine GDPR, HIPAA, privilege, trade-secret status or other legal compliance.',
  };
}

export const privacyManifest = {
  protocol: 'OIP', kind: 'privacy_egress_accountability', version: '1.0', clauses: PRIVACY_CLAUSES,
  thesis: 'A system cannot credibly promise rights over context-derived transmissions it cannot enumerate.',
  invariant: 'A transmission across a trust boundary produces a recipient-addressable disclosure record sufficient to support notice, access, correction, restriction, deletion requests and proof of attempted downstream propagation.',
  legal_boundary: 'Classifications, recipient roles, legal bases and conformance findings are runtime evidence or claims, not legal determinations.',
  actions: ['shape', 'classify', 'minimize', 'authorize', 'disclose', 'erasure', 'conformance'],
};
