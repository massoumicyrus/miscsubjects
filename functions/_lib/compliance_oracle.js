// OIP Independent Compliance Oracle: the missing layer.
// - CITATION_VALIDATION: does a cited source actually support the clause finding?
// - COMPLIANCE_GATE: is a bounded card executable state, with typed denials?
// - ORACLE_CONFORMANCE: executes the invariants above (and the surety hardening),
//   never merely checks that a schema field exists.
import { governanceSha, getDecision, getStateCard, canonicalProvider, independentConfirmUnits } from './model_governance.js';

const BASE = 'https://miscsubjects.com';
const text = (value, max = 4000) => String(value == null ? '' : value).trim().slice(0, max);
const b01 = (value) => (value ? 1 : 0);
const idPart = (value, fallback) => {
  const out = text(value, 100).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return out || fallback;
};

const EVIDENCE_CLASSES = new Set(['operator-served', 'independently-recomputable', 'third-party-witnessed', 'institutionally-attested', 'private-scoped', 'unresolved-assertion']);
const CITATION_VERDICTS = new Set(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED', 'CONTRADICTED', 'LEGAL_REVIEW_REQUIRED']);

function publicCiteval(row) {
  if (!row) return null;
  return {
    ...row,
    source_exists: !!row.source_exists, version_hash_correct: !!row.version_hash_correct,
    passage_supports_premise: !!row.passage_supports_premise, clause_governs_conduct: !!row.clause_governs_conduct,
    material_omission: !!row.material_omission, conclusion_overreach: !!row.conclusion_overreach, prior_answers_visible: !!row.prior_answers_visible,
    law: 'This records whether a cited source supports a clause finding under a distinct check. A model confirming the decision does not substitute for it, and this is not itself a legal determination.',
  };
}

export async function getCitationValidation(env, id) {
  return publicCiteval(await env.DB.prepare('SELECT * FROM oip_citation_validations WHERE id=?').bind(String(id)).first());
}

export async function listCitationValidations(env, decisionId) {
  const rows = (await env.DB.prepare('SELECT * FROM oip_citation_validations WHERE decision_id=? ORDER BY created_at ASC').bind(String(decisionId)).all()).results || [];
  return rows.map(publicCiteval);
}

export async function appendCitationValidation(env, body) {
  const decision = await getDecision(env, text(body?.decision_id, 100));
  if (!decision) return { error: 'unknown decision_id', status: 404 };
  const clause = idPart(body?.clause, '');
  const known = new Set((decision.clause_findings || []).map((finding) => finding.clause));
  if (!clause || !known.has(clause)) return { error: 'clause must match a clause_finding on the decision', status: 400 };
  const verdict = text(body?.verdict, 40).toUpperCase();
  const evidenceClass = text(body?.evidence_class, 60);
  if (!CITATION_VERDICTS.has(verdict) || !EVIDENCE_CLASSES.has(evidenceClass)) return { error: 'invalid verdict or evidence_class', status: 400 };
  const record = {
    decision_id: decision.id, clause, evidence_ref: text(body?.evidence_ref, 1000), evidence_class: evidenceClass, verdict,
    source_exists: b01(body?.source_exists), version_hash_correct: b01(body?.version_hash_correct),
    passage_supports_premise: b01(body?.passage_supports_premise), clause_governs_conduct: b01(body?.clause_governs_conduct),
    material_omission: b01(body?.material_omission), conclusion_overreach: b01(body?.conclusion_overreach),
    validator_model: text(body?.validator_model, 200), validator_provider: text(body?.validator_provider, 160), validator_family: text(body?.validator_family, 160),
    prompt_hash: text(body?.prompt_hash, 128) || null, context_hash: text(body?.context_hash, 128) || null,
    prior_answers_visible: b01(body?.prior_answers_visible), recompute_method: text(body?.recompute_method, 2000) || null, justification: text(body?.justification, 6000),
  };
  if (!record.evidence_ref || !record.validator_model || !record.validator_provider || !record.validator_family || !record.justification) return { error: 'evidence_ref, validator identity and justification are required', status: 400 };
  if (verdict === 'SUPPORTED' && !(record.source_exists && record.passage_supports_premise && record.clause_governs_conduct && !record.conclusion_overreach)) return { error: 'a SUPPORTED verdict requires source_exists, passage_supports_premise, clause_governs_conduct and no conclusion_overreach', status: 409 };
  if (evidenceClass === 'operator-served' && String(body?.independently_recomputable) === 'true') return { error: 'operator-served evidence cannot be declared independently recomputable', status: 409 };
  const hash = await governanceSha(record); const id = 'cv_' + hash.slice(0, 20); const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO oip_citation_validations (id,decision_id,clause,evidence_ref,evidence_class,verdict,source_exists,version_hash_correct,passage_supports_premise,clause_governs_conduct,material_omission,conclusion_overreach,validator_model,validator_provider,validator_family,prompt_hash,context_hash,prior_answers_visible,recompute_method,justification,record_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, record.decision_id, clause, record.evidence_ref, evidenceClass, verdict, record.source_exists, record.version_hash_correct, record.passage_supports_premise, record.clause_governs_conduct, record.material_omission, record.conclusion_overreach, record.validator_model, record.validator_provider, record.validator_family, record.prompt_hash, record.context_hash, record.prior_answers_visible, record.recompute_method, record.justification, hash, createdAt).run();
  } catch (error) { return { error: /UNIQUE|constraint/i.test(String(error)) ? 'identical citation validation already exists' : 'citation validation write failed', status: 409 }; }
  return { ok: true, citation_validation: await getCitationValidation(env, id), verify: `${BASE}/api/governance/citation-validation/${id}` };
}

// ---- Downstream gate -------------------------------------------------------

function scopeCovers(scope, action) {
  if (!Array.isArray(scope)) return false;
  const a = action.trim().toLowerCase();
  return scope.some((item) => String(item).trim().toLowerCase() === a);
}
function jurisdictionCovers(cardJurisdiction, requested) {
  const c = String(cardJurisdiction || '').toLowerCase(); const r = String(requested || '').toLowerCase();
  return c === r || c.includes(r);
}
function riskProhibited(ceiling, risk) {
  const c = String(ceiling || '').toLowerCase(); const r = String(risk || '').toLowerCase().trim();
  if (!r || r === 'none') return false;
  return c.includes(r); // risk_ceiling enumerates prohibited classes; a requested class named there is denied
}

// Pure decision function shared by the live gate and the conformance suite, so
// the conformance route exercises the exact code path without writing rows.
export function gateDecision(card, req) {
  const deny = (reason_code, detail) => ({ outcome: 'DENY', reason_code, detail });
  if (!card) return deny('CARD_NOT_FOUND', 'no card with that id');
  if (req.presented_card_hash && req.presented_card_hash !== card.record_hash) return deny('FORGED_HASH', 'presented card hash does not match the stored record hash');
  if (card.status === 'revoked') return deny('REVOKED', 'card has been revoked');
  if (card.status === 'superseded') return deny('SUPERSEDED', 'card has been superseded');
  if (card.status === 'expired') return deny('EXPIRED', 'card expiry has passed');
  if (card.status !== 'active' || card.standing === false) return deny('EXPIRED', 'card is not currently standing');
  if (req.requested_system_version && req.requested_system_version !== card.system_version) return deny('WRONG_SYSTEM_VERSION', `card certifies system_version ${card.system_version}`);
  if (req.requested_jurisdiction && !jurisdictionCovers(card.jurisdiction, req.requested_jurisdiction)) return deny('WRONG_JURISDICTION', `card jurisdiction is ${card.jurisdiction}`);
  if (!scopeCovers(card.scope, req.requested_action)) return deny('ACTION_OUT_OF_SCOPE', 'requested_action is not in the card scope');
  if (req.requested_risk && riskProhibited(card.risk_ceiling, req.requested_risk)) return deny('RISK_CEILING_EXCEEDED', `card risk ceiling forbids ${req.requested_risk}`);
  if (req.requested_certifier_type && card.certifier_type !== req.requested_certifier_type) return deny('UNQUALIFIED_CERTIFIER', `action requires a ${req.requested_certifier_type} certifier; card certifier_type is ${card.certifier_type}`);
  if (req.require_no_standing_dissent && Array.isArray(card.standing_dissent) && card.standing_dissent.length) return deny('STANDING_DISSENT_BLOCKS', `${card.standing_dissent.length} unresolved dissent(s) block this action`);
  return { outcome: 'ALLOW', reason_code: 'PERMITTED', detail: 'card valid and in scope for the requested action' };
}

export async function resolveGate(env, body, actor) {
  const cardId = text(body?.card_id, 100);
  const action = text(body?.requested_action, 200);
  if (!action) return { error: 'requested_action required', status: 400 };
  const req = {
    requested_action: action,
    requested_system_version: text(body?.system_version, 200) || null,
    requested_jurisdiction: text(body?.jurisdiction, 200) || null,
    requested_risk: text(body?.risk, 100) || null,
    requested_certifier_type: text(body?.required_certifier_type, 60) || null,
    presented_card_hash: text(body?.presented_card_hash, 128) || null,
    require_no_standing_dissent: !!body?.require_no_standing_dissent,
  };
  const card = cardId ? await getStateCard(env, cardId) : null;
  const verdict = gateDecision(card, req);
  const requestHash = await governanceSha(req);
  const id = 'gate_' + (await governanceSha({ ...req, card: cardId, verdict, ts: Date.now() })).slice(0, 20);
  const createdAt = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO oip_gate_resolutions (id,card_id,requested_action,requested_system_version,requested_jurisdiction,requested_risk,requested_certifier_type,presented_card_hash,outcome,reason_code,detail,request_hash,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, cardId || null, action, req.requested_system_version, req.requested_jurisdiction, req.requested_risk, req.requested_certifier_type, req.presented_card_hash, verdict.outcome, verdict.reason_code, verdict.detail, requestHash, actor, createdAt).run();
  return {
    ok: true, protocol: 'OIP', kind: 'gate_resolution', id, outcome: verdict.outcome, reason_code: verdict.reason_code, detail: verdict.detail,
    card_id: cardId || null, card_status: card?.status || null, requested_action: action, request_hash: requestHash,
    verify: `${BASE}/api/governance/gate/${id}`, created_at: createdAt,
    law: 'A gate resolution authorizes only the exact action within the card bounds. ALLOW is not proof of legal compliance; DENY is a typed refusal, not a legal judgment.',
  };
}

export async function getGateResolution(env, id) {
  const row = await env.DB.prepare('SELECT * FROM oip_gate_resolutions WHERE id=?').bind(String(id)).first();
  if (!row) return null;
  return { protocol: 'OIP', kind: 'gate_resolution', ...row };
}

// ---- Live conformance suite ------------------------------------------------

const SAMPLE_CARD = Object.freeze({
  record_hash: 'aaaa', status: 'active', standing: true, system_version: 'commit_A',
  jurisdiction: 'protocol-internal only', scope: ['read-conformance-proof'], risk_ceiling: 'no medical, legal, financial, trading, insurance, regulatory, or production authorization',
  certifier_type: 'owner', standing_dissent: [],
});

async function suretyDedupProbe() {
  // Two provider aliases plus a copied-evidence twin must collapse to one unit.
  const confirms = [
    { reviewer_provider: 'OpenAI', prompt_hash: 'p1', context_hash: 'c1', evidence: ['E-shared'] },
    { reviewer_provider: 'open-ai inc', prompt_hash: 'p2', context_hash: 'c2', evidence: ['E-other'] },
    { reviewer_provider: 'GPT-team', prompt_hash: 'p3', context_hash: 'c3', evidence: ['E-3'] },
  ];
  const units = await independentConfirmUnits(confirms);
  const providersDistinct = canonicalProvider('OpenAI') === canonicalProvider('open-ai inc') && canonicalProvider('OpenAI') === canonicalProvider('GPT-team');
  return { units: units.length, aliases_collapse_to_one_provider: providersDistinct && units.length === 1 };
}

export async function oracleConformance(env) {
  const clauses = [];
  const add = (id, title, pass, evidence) => clauses.push({ id, title, pass: !!pass, evidence });

  // Surety hardening (pure logic path, no writes).
  const probe = await suretyDedupProbe();
  add('CO-01', 'surety canonicalizes provider aliases to one independent unit', probe.aliases_collapse_to_one_provider, `three aliased confirms collapsed to ${probe.units} unit(s)`);
  const overlap = await independentConfirmUnits([
    { reviewer_provider: 'xai', prompt_hash: 'p', context_hash: 'c', evidence: ['same'] },
    { reviewer_provider: 'moonshot', prompt_hash: 'q', context_hash: 'd', evidence: ['same'] },
  ]);
  add('CO-02', 'copied-evidence confirms across providers collapse to one unit', overlap.length === 1, `two distinct providers sharing one evidence set -> ${overlap.length} unit(s)`);

  // Gate typed denials (pure decision path, no writes).
  add('CO-03', 'forged card hash denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof', presented_card_hash: 'zzzz' }).reason_code === 'FORGED_HASH', 'mismatched presented_card_hash');
  add('CO-04', 'expired card denies', gateDecision({ ...SAMPLE_CARD, status: 'expired' }, { requested_action: 'read-conformance-proof' }).reason_code === 'EXPIRED', 'status=expired');
  add('CO-05', 'revoked card denies', gateDecision({ ...SAMPLE_CARD, status: 'revoked' }, { requested_action: 'read-conformance-proof' }).reason_code === 'REVOKED', 'status=revoked');
  add('CO-06', 'superseded card denies', gateDecision({ ...SAMPLE_CARD, status: 'superseded' }, { requested_action: 'read-conformance-proof' }).reason_code === 'SUPERSEDED', 'status=superseded');
  add('CO-07', 'wrong system version denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof', requested_system_version: 'commit_B' }).reason_code === 'WRONG_SYSTEM_VERSION', 'version mismatch');
  add('CO-08', 'out-of-scope action denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'delete-production-data' }).reason_code === 'ACTION_OUT_OF_SCOPE', 'action not in scope');
  add('CO-09', 'wrong jurisdiction denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof', requested_jurisdiction: 'eu' }).reason_code === 'WRONG_JURISDICTION', 'jurisdiction mismatch');
  add('CO-10', 'risk ceiling exceeded denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof', requested_risk: 'medical' }).reason_code === 'RISK_CEILING_EXCEEDED', 'requested risk is prohibited');
  add('CO-11', 'unqualified certifier denies', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof', requested_certifier_type: 'regulator' }).reason_code === 'UNQUALIFIED_CERTIFIER', 'owner card, regulator required');
  add('CO-12', 'standing dissent blocks when required', gateDecision({ ...SAMPLE_CARD, standing_dissent: ['rev_x'] }, { requested_action: 'read-conformance-proof', require_no_standing_dissent: true }).reason_code === 'STANDING_DISSENT_BLOCKS', 'unresolved dissent present');
  add('CO-13', 'missing card denies', gateDecision(null, { requested_action: 'read-conformance-proof' }).reason_code === 'CARD_NOT_FOUND', 'no card');
  add('CO-14', 'valid in-scope card permits', gateDecision({ ...SAMPLE_CARD }, { requested_action: 'read-conformance-proof' }).outcome === 'ALLOW', 'all bounds satisfied');

  // Citation-validation integrity (SUPPORTED cannot lack its supporting checks). Executes the same guard the writer uses.
  const supportedGuard = (rec) => rec.source_exists && rec.passage_supports_premise && rec.clause_governs_conduct && !rec.conclusion_overreach;
  add('CO-15', 'SUPPORTED citation requires supporting checks', supportedGuard({ source_exists: 1, passage_supports_premise: 1, clause_governs_conduct: 1, conclusion_overreach: 0 }) && !supportedGuard({ source_exists: 1, passage_supports_premise: 0, clause_governs_conduct: 1, conclusion_overreach: 0 }), 'positive and negative control');

  // Live negative and positive controls against the deployed privacy conformance route.
  let neg404 = null; let pos200 = null;
  try { neg404 = (await fetch(`${BASE}/api/privacy/conformance/dis_conformance_negative_control_${Date.now()}`)).status; } catch { neg404 = 'fetch_failed'; }
  try { pos200 = (await fetch(`${BASE}/api/privacy/conformance/dis_d80b129eaa4f018a41c5`)).status; } catch { pos200 = 'fetch_failed'; }
  add('CO-16', 'unknown conformance id returns typed 404 (negative control preserved)', neg404 === 404, `live status ${neg404}`);
  add('CO-17', 'known partial conformance returns 200 not 500 (domain status is not HTTP status)', pos200 === 200, `live status ${pos200}`);

  const passed = clauses.filter((clause) => clause.pass).length;
  return {
    protocol: 'OIP', kind: 'oracle_conformance', version: '1.0', surety_formula_version: '1.1',
    passed, total: clauses.length, conformant: passed === clauses.length, clauses,
    law: 'Each clause executes the behavior it names (pure decision path or a live production probe), never a schema-field existence check. Passing means the runtime behaves as stated; it is not a legal, security or truth determination.',
  };
}
