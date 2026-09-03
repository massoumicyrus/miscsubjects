const BASE = 'https://miscsubjects.com';

const DECISIONS = new Set(['CONFORMANT', 'NONCONFORMANT', 'PARTIAL', 'UNKNOWN', 'ABSTAIN', 'LEGAL_REVIEW_REQUIRED']);
const AUTHORITIES = new Set(['model-recommendation', 'owner-authorized', 'external-attestation']);
const STANCES = new Set(['CONFIRM', 'CHALLENGE', 'ABSTAIN']);
const STANDARD_AUTHORITY = new Set(['internal-profile', 'external-source', 'advisory', 'legal-review-required']);
const STANDARD_STATUS = new Set(['draft', 'active', 'superseded', 'withdrawn']);

const text = (value, max = 4000) => String(value == null ? '' : value).trim().slice(0, max);
const list = (value, max = 100) => Array.isArray(value) ? value.slice(0, max) : [];
const jsonParse = (value, fallback = []) => { try { return JSON.parse(value); } catch { return fallback; } };
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

export async function governanceSha(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function idPart(value, fallback) {
  const out = text(value, 100).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return out || fallback;
}

function publicStandard(row) {
  if (!row) return null;
  return { ...row, clauses: jsonParse(row.clauses_json), clauses_json: undefined };
}

function publicDecision(row) {
  if (!row) return null;
  return {
    ...row,
    facts: jsonParse(row.facts_json),
    clause_findings: jsonParse(row.clause_findings_json),
    uncertainties: jsonParse(row.uncertainties_json),
    counterarguments: jsonParse(row.counterarguments_json),
    evidence: jsonParse(row.evidence_json),
    facts_json: undefined,
    clause_findings_json: undefined,
    uncertainties_json: undefined,
    counterarguments_json: undefined,
    evidence_json: undefined,
    prior_answers_visible: !!row.prior_answers_visible,
    causal_claim: 'accountability_artifact_not_hidden_reasoning',
  };
}

function publicReview(row) {
  if (!row) return null;
  return {
    ...row,
    evidence: jsonParse(row.evidence_json),
    evidence_json: undefined,
    evidence_recomputed: !!row.evidence_recomputed,
    prior_answers_visible: !!row.prior_answers_visible,
  };
}

export async function listStandards(env) {
  const rows = (await env.DB.prepare('SELECT * FROM oip_standards ORDER BY created_at DESC,id ASC').all()).results || [];
  return { protocol: 'OIP', kind: 'standards_registry', standards: rows.map(publicStandard), count: rows.length };
}

export async function getStandard(env, id) {
  return publicStandard(await env.DB.prepare('SELECT * FROM oip_standards WHERE id=?').bind(String(id)).first());
}

export async function appendStandard(env, body) {
  const authority = text(body?.authority_class, 40);
  const status = text(body?.status || 'active', 20);
  const id = idPart(body?.id, 'standard');
  const name = text(body?.name, 200);
  const version = text(body?.version, 80);
  const canonical = String(body?.canonical_text == null ? '' : body.canonical_text).slice(0, 100000);
  const sourceUrl = text(body?.source_url, 1000) || null;
  const clauses = list(body?.clauses, 500).map((clause) => ({
    id: idPart(clause?.id, ''), title: text(clause?.title, 240), requirement: text(clause?.requirement, 4000),
    test: text(clause?.test, 2000) || null, authority: text(clause?.authority, 100) || authority,
  }));
  if (!name || !version || !canonical || !text(body?.created_by, 200)) return { error: 'id, name, version, canonical_text and created_by are required', status: 400 };
  if (!STANDARD_AUTHORITY.has(authority) || !STANDARD_STATUS.has(status)) return { error: 'invalid authority_class or status', status: 400 };
  if ((authority === 'external-source' || authority === 'legal-review-required') && !/^https:\/\//i.test(sourceUrl || '')) return { error: 'external and legal-review standards require an HTTPS source_url', status: 400 };
  if (!clauses.length || clauses.some((clause) => !clause.id || !clause.title || !clause.requirement)) return { error: 'clauses require id, title and requirement', status: 400 };
  if (new Set(clauses.map((clause) => clause.id)).size !== clauses.length) return { error: 'clause ids must be unique', status: 409 };
  const parent = text(body?.parent_id, 100) || null;
  if (parent && !(await getStandard(env, parent))) return { error: 'unknown parent_id', status: 404 };
  const record = { id, name, version, authority_class: authority, source_url: sourceUrl, canonical_text: canonical, clauses, status, parent_id: parent, created_by: text(body.created_by, 200) };
  const hash = await governanceSha(record);
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO oip_standards (id,name,version,authority_class,source_url,canonical_text,clauses_json,content_hash,status,parent_id,created_by,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, name, version, authority, sourceUrl, canonical, JSON.stringify(clauses), hash, status, parent, record.created_by, createdAt).run();
  } catch (error) { return { error: /UNIQUE|constraint/i.test(String(error)) ? 'standard id or content already exists' : 'standard write failed', status: 409 }; }
  return { ok: true, standard: await getStandard(env, id), verify: `${BASE}/api/governance/standards/${encodeURIComponent(id)}` };
}

export async function listDecisions(env, standardId) {
  const q = standardId
    ? await env.DB.prepare('SELECT * FROM oip_decision_records WHERE standard_id=? ORDER BY created_at DESC LIMIT 200').bind(String(standardId)).all()
    : await env.DB.prepare('SELECT * FROM oip_decision_records ORDER BY created_at DESC LIMIT 200').all();
  const rows = q.results || [];
  return { protocol: 'OIP', kind: 'decision_records', decisions: rows.map(publicDecision), count: rows.length };
}

export async function getDecision(env, id) {
  return publicDecision(await env.DB.prepare('SELECT * FROM oip_decision_records WHERE id=?').bind(String(id)).first());
}

export async function appendDecision(env, body) {
  const standard = await getStandard(env, text(body?.standard_id, 100));
  if (!standard) return { error: 'unknown standard_id', status: 404 };
  const decision = text(body?.decision, 40).toUpperCase();
  const authority = text(body?.authority, 40);
  if (!DECISIONS.has(decision) || !AUTHORITIES.has(authority)) return { error: 'invalid decision or authority', status: 400 };
  if (standard.authority_class === 'legal-review-required' && !['UNKNOWN', 'ABSTAIN', 'LEGAL_REVIEW_REQUIRED'].includes(decision)) {
    return { error: 'this standard is legal-review-required; runtime may only return UNKNOWN, ABSTAIN or LEGAL_REVIEW_REQUIRED', status: 409 };
  }
  const knownClauses = new Set(standard.clauses.map((clause) => clause.id));
  const findings = list(body?.clause_findings, 500).map((finding) => ({
    clause: idPart(finding?.clause, ''), result: text(finding?.result, 40).toUpperCase(), reason: text(finding?.reason, 4000),
    evidence: list(finding?.evidence, 100).map((item) => text(item, 1000)).filter(Boolean),
  }));
  if (!findings.length || findings.some((finding) => !knownClauses.has(finding.clause) || !finding.reason)) return { error: 'every clause finding must cite a registered clause and give a reason', status: 400 };
  if (findings.some((finding) => ['PASS', 'FAIL'].includes(finding.result) && !finding.evidence.length)) return { error: 'PASS and FAIL findings require evidence', status: 400 };
  const repairOf = text(body?.repair_of, 100) || null;
  if (repairOf && !(await getDecision(env, repairOf))) return { error: 'unknown repair_of decision', status: 404 };
  const record = {
    standard_id: standard.id, model: text(body?.model, 200), provider: text(body?.provider, 160), model_family: text(body?.model_family, 160),
    task: text(body?.task, 2000), decision, justification: text(body?.justification, 6000), facts: list(body?.facts, 200), clause_findings: findings,
    uncertainties: list(body?.uncertainties, 100), counterarguments: list(body?.counterarguments, 100), recommended_action: text(body?.recommended_action, 2000) || null,
    confidence: body?.confidence == null ? null : Math.max(0, Math.min(1, Number(body.confidence))), evidence: list(body?.evidence, 200),
    prompt_hash: text(body?.prompt_hash, 128) || null, context_hash: text(body?.context_hash, 128) || null,
    prior_answers_visible: body?.prior_answers_visible ? 1 : 0, authority, invocation_id: text(body?.invocation_id, 100) || null, repair_of: repairOf,
  };
  if (!record.model || !record.provider || !record.model_family || !record.task || !record.justification) return { error: 'model, provider, model_family, task and justification are required', status: 400 };
  const hash = await governanceSha(record);
  const id = 'dec_' + hash.slice(0, 20);
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO oip_decision_records
      (id,standard_id,model,provider,model_family,task,decision,justification,facts_json,clause_findings_json,uncertainties_json,counterarguments_json,recommended_action,confidence,evidence_json,prompt_hash,context_hash,prior_answers_visible,authority,invocation_id,record_hash,status,repair_of,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)`).bind(id, record.standard_id, record.model, record.provider, record.model_family, record.task, record.decision, record.justification, JSON.stringify(record.facts), JSON.stringify(findings), JSON.stringify(record.uncertainties), JSON.stringify(record.counterarguments), record.recommended_action, Number.isFinite(record.confidence) ? record.confidence : null, JSON.stringify(record.evidence), record.prompt_hash, record.context_hash, record.prior_answers_visible, authority, record.invocation_id, hash, repairOf, createdAt).run();
  } catch (error) { return { error: /UNIQUE|constraint/i.test(String(error)) ? 'identical decision already exists' : 'decision write failed', status: 409 }; }
  if (repairOf) await env.DB.prepare("UPDATE oip_decision_records SET status='repaired' WHERE id=?").bind(repairOf).run();
  return { ok: true, decision: await getDecision(env, id), verify: `${BASE}/api/governance/decisions/${id}`, surety: `${BASE}/api/governance/surety/${id}` };
}

export async function listReviews(env, decisionId) {
  const rows = (await env.DB.prepare('SELECT * FROM oip_review_records WHERE decision_id=? ORDER BY created_at ASC').bind(String(decisionId)).all()).results || [];
  return rows.map(publicReview);
}

export async function appendReview(env, body) {
  const decision = await getDecision(env, text(body?.decision_id, 100));
  if (!decision) return { error: 'unknown decision_id', status: 404 };
  const stance = text(body?.stance, 20).toUpperCase(); const authority = text(body?.authority, 40);
  if (!STANCES.has(stance) || !AUTHORITIES.has(authority)) return { error: 'invalid stance or authority', status: 400 };
  const record = {
    decision_id: decision.id, reviewer_model: text(body?.reviewer_model, 200), reviewer_provider: text(body?.reviewer_provider, 160), reviewer_family: text(body?.reviewer_family, 160),
    stance, justification: text(body?.justification, 6000), evidence: list(body?.evidence, 200), evidence_recomputed: body?.evidence_recomputed ? 1 : 0,
    prompt_hash: text(body?.prompt_hash, 128) || null, context_hash: text(body?.context_hash, 128) || null, prior_answers_visible: body?.prior_answers_visible ? 1 : 0,
    authority, invocation_id: text(body?.invocation_id, 100) || null,
  };
  if (!record.reviewer_model || !record.reviewer_provider || !record.reviewer_family || !record.justification) return { error: 'reviewer identity and justification are required', status: 400 };
  const hash = await governanceSha(record); const id = 'rev_' + hash.slice(0, 20); const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO oip_review_records (id,decision_id,reviewer_model,reviewer_provider,reviewer_family,stance,justification,evidence_json,evidence_recomputed,prompt_hash,context_hash,prior_answers_visible,authority,invocation_id,record_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, record.decision_id, record.reviewer_model, record.reviewer_provider, record.reviewer_family, stance, record.justification, JSON.stringify(record.evidence), record.evidence_recomputed, record.prompt_hash, record.context_hash, record.prior_answers_visible, authority, record.invocation_id, hash, createdAt).run();
  } catch (error) { return { error: /UNIQUE|constraint/i.test(String(error)) ? 'identical review already exists' : 'review write failed', status: 409 }; }
  return { ok: true, review: publicReview(await env.DB.prepare('SELECT * FROM oip_review_records WHERE id=?').bind(id).first()), surety: await computeSurety(env, decision.id) };
}

// Surety formula 1.1 hardening (Operation Independent Compliance Oracle).
// Canonicalize the self-asserted provider string so aliases (OpenAI/open-ai/GPT)
// collapse to one provider key and cannot inflate independent-provider weight.
export function canonicalProvider(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const alias = [
    ['openai', ['openai', 'opanai', 'gpt', 'chatgpt', 'o1', 'o3', 'o4']],
    ['anthropic', ['anthropic', 'claude']],
    ['google', ['google', 'gemini', 'deepmind', 'palm']],
    ['xai', ['xai', 'grok']],
    ['moonshot', ['moonshot', 'kimi']],
    ['meta', ['meta', 'llama']],
    ['mistral', ['mistral']],
    ['deepseek', ['deepseek']],
    ['cohere', ['cohere']],
  ];
  for (const [canon, keys] of alias) if (keys.some((k) => s.includes(k))) return canon;
  return s;
}

async function evidenceSetHash(evidence) {
  const items = (Array.isArray(evidence) ? evidence : []).map((x) => (typeof x === 'string' ? x : JSON.stringify(x)).trim()).filter(Boolean).sort();
  return items.length ? await governanceSha(items) : 'none';
}

// Collapse correlated confirmations to distinct independent units: at most one
// per canonical provider, and none that share an identical (prompt_hash,context_hash)
// pair or an identical evidence set with an already-counted unit. This defeats
// alias rings, replayed confirmations, same-query correlation and copied evidence.
export async function independentConfirmUnits(independentConfirms) {
  const seenProvider = new Set(); const seenQuery = new Set(); const seenEvidence = new Set(); const units = [];
  for (const review of independentConfirms) {
    const prov = canonicalProvider(review.reviewer_provider);
    const query = `${review.prompt_hash || ''}|${review.context_hash || ''}`;
    const ev = await evidenceSetHash(review.evidence);
    if (seenProvider.has(prov)) continue;
    if (query !== '|' && seenQuery.has(query)) continue;
    if (ev !== 'none' && seenEvidence.has(ev)) continue;
    seenProvider.add(prov); seenQuery.add(query); seenEvidence.add(ev);
    units.push(review);
  }
  return units;
}

export async function computeSurety(env, decisionId) {
  const decision = await getDecision(env, decisionId);
  if (!decision) return { error: 'unknown decision_id', status: 404 };
  const reviews = await listReviews(env, decisionId);
  const dp = canonicalProvider(decision.provider);
  const unique = new Map();
  for (const review of reviews) {
    const key = canonicalProvider(review.reviewer_provider);
    const existing = unique.get(key);
    if (!existing || (existing.prior_answers_visible && !review.prior_answers_visible)) unique.set(key, review);
  }
  const crossProvider = [...unique.values()].filter((review) => canonicalProvider(review.reviewer_provider) !== dp);
  const independent = crossProvider.filter((review) => !review.prior_answers_visible && review.prompt_hash && review.context_hash);
  const confirms = await independentConfirmUnits(independent.filter((review) => review.stance === 'CONFIRM'));
  const corroborations = crossProvider.filter((review) => review.stance === 'CONFIRM' && !confirms.some((item) => item.id === review.id));
  const challenges = crossProvider.filter((review) => review.stance === 'CHALLENGE');
  const recomputed = confirms.some((review) => review.evidence_recomputed);
  const receiptEvidence = decision.evidence.some((item) => /inv_[a-z0-9]+|\/receipt\//i.test(typeof item === 'string' ? item : JSON.stringify(item)));
  // Adverse citation validations (UNSUPPORTED/CONTRADICTED) or required legal review
  // discount the score; a decision cannot be highly corroborated over broken citations.
  let citeAdverse = false; let citeLegal = false; let citeCount = 0;
  try {
    const rows = (await env.DB.prepare('SELECT verdict, COUNT(*) AS c FROM oip_citation_validations WHERE decision_id=? GROUP BY verdict').bind(decisionId).all()).results || [];
    for (const row of rows) { citeCount += Number(row.c) || 0; if (['UNSUPPORTED', 'CONTRADICTED'].includes(row.verdict)) citeAdverse = true; if (row.verdict === 'LEGAL_REVIEW_REQUIRED') citeLegal = true; }
  } catch { /* table may predate migration 0292 */ }
  const components = {
    registered_clause_decision: 0.25,
    independent_provider_confirms: Math.min(0.45, confirms.length * 0.15),
    cross_provider_corroborations_with_visible_or_unpinned_context: Math.min(0.15, corroborations.length * 0.05),
    evidence_recomputed: recomputed ? 0.10 : 0,
    execution_receipt_evidence: receiptEvidence ? 0.10 : 0,
    independent_provider_challenges: -Math.min(0.30, challenges.length * 0.10),
    adverse_citation_validation: citeAdverse ? -0.20 : 0,
  };
  const score = Math.max(0.05, Math.min(0.95, Object.values(components).reduce((sum, value) => sum + value, 0)));
  const contested = challenges.length > 0 || citeAdverse;
  const status = contested ? 'DIVERGENT' : score >= 0.75 ? 'HIGHLY_CORROBORATED' : score >= 0.40 ? 'CORROBORATED' : 'ASSERTED';
  const adversariallySurvived = confirms.length >= 2 && !contested && recomputed;
  return {
    protocol: 'OIP', kind: 'decision_surety', decision_id: decisionId, formula_version: '1.1', score: Number(score.toFixed(2)), status,
    oracle_status: contested ? 'CONTESTED' : adversariallySurvived ? 'ADVERSARIALLY_SURVIVED' : confirms.length ? 'CORROBORATED' : 'ASSERTED',
    adversarially_survived: adversariallySurvived, components,
    raw_review_count: reviews.length, cross_provider_count: crossProvider.length, independent_provider_count: confirms.length, independent_confirming_providers: confirms.map((review) => review.reviewer_provider),
    context_exposed_or_unpinned_corroborating_providers: corroborations.map((review) => review.reviewer_provider),
    independent_challenging_providers: challenges.map((review) => review.reviewer_provider),
    citation_validation_count: citeCount, citation_adverse: citeAdverse, citation_legal_review_required: citeLegal,
    discounted_reviews: reviews.filter((review) => canonicalProvider(review.reviewer_provider) === dp || unique.get(canonicalProvider(review.reviewer_provider))?.id !== review.id || (review.stance === 'CONFIRM' && !confirms.some((item) => item.id === review.id) && !corroborations.some((item) => item.id === review.id))).map((review) => review.id),
    discount_law: 'Provider identity is canonicalized before counting, so aliases collapse to one provider. Independent confirms are collapsed to distinct units: at most one per canonical provider, and none sharing an identical prompt/context pair or evidence set. A review from the originating provider, a repeated provider, a visible-prior or unpinned confirmation, or a confirm correlated with another by query or evidence contributes zero independent-provider weight. Adverse citation validations discount the score.',
    law: 'This score measures disclosed corroboration under formula 1.1. It is not truth, legal compliance, consensus authority, model identity verification or proof that a justification caused the model output.',
    reviews,
  };
}

function publicCard(row) {
  if (!row) return null;
  const expired = row.status === 'active' && Date.parse(row.expires_at) <= Date.now();
  return {
    ...row,
    status: expired ? 'expired' : row.status,
    scope: jsonParse(row.scope_json),
    surety_snapshot: jsonParse(row.surety_snapshot_json, {}),
    standing_dissent: jsonParse(row.standing_dissent_json),
    scope_json: undefined,
    surety_snapshot_json: undefined,
    standing_dissent_json: undefined,
    standing: !expired && row.status === 'active',
    authority_law: 'The card certifies only its named system version, standard, scope, risk ceiling, jurisdiction, audit depth and time window. It grants no execution authority.',
  };
}

export async function getStateCard(env, id) {
  const card = publicCard(await env.DB.prepare('SELECT * FROM oip_state_cards WHERE id=?').bind(String(id)).first());
  if (!card) return null;
  const events = (await env.DB.prepare('SELECT * FROM oip_state_card_events WHERE card_id=? ORDER BY created_at ASC').bind(card.id).all()).results || [];
  return { ...card, events: events.map((event) => ({ ...event, evidence: jsonParse(event.evidence_json), evidence_json: undefined })) };
}

export async function appendStateCard(env, body) {
  const decision = await getDecision(env, text(body?.decision_id, 100));
  if (!decision) return { error: 'unknown decision_id', status: 404 };
  const certifierType = text(body?.certifier_type, 40); const authority = text(body?.authority, 40);
  const types = new Set(['regulator', 'insurer', 'auditor', 'compliance_officer', 'standards_body', 'owner']);
  if (!types.has(certifierType) || !new Set(['owner-authorized', 'external-attestation']).has(authority)) return { error: 'invalid certifier_type or authority', status: 400 };
  const expiresAt = Date.parse(body?.expires_at); const now = Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 366 * 86400000) return { error: 'expires_at must be in the future and no more than 366 days away', status: 400 };
  const scope = list(body?.scope, 100).map((item) => text(item, 500)).filter(Boolean);
  const record = {
    decision_id: decision.id, standard_id: decision.standard_id, system_version: text(body?.system_version, 200), scope,
    risk_ceiling: text(body?.risk_ceiling, 500), jurisdiction: text(body?.jurisdiction, 500), audit_depth: Math.max(0, Math.min(20, Number(body?.audit_depth || 0))),
    certifier_type: certifierType, certifier_label: text(body?.certifier_label, 300), authority,
    expires_at: new Date(expiresAt).toISOString(), parent_id: text(body?.parent_id, 100) || null,
  };
  if (!record.system_version || !scope.length || !record.risk_ceiling || !record.jurisdiction || !record.audit_depth || !record.certifier_label) return { error: 'system_version, non-empty scope, risk_ceiling, jurisdiction, positive audit_depth and certifier_label are required', status: 400 };
  if (record.parent_id && !(await getStateCard(env, record.parent_id))) return { error: 'unknown parent_id', status: 404 };
  const surety = await computeSurety(env, decision.id);
  const dissent = (surety.reviews || []).filter((review) => review.stance === 'CHALLENGE').map((review) => review.id);
  const hash = await governanceSha({ ...record, surety, dissent }); const id = 'card_' + hash.slice(0, 20); const createdAt = new Date(now).toISOString();
  const evidence = list(body?.evidence, 200).map((item) => text(item, 1000)).filter(Boolean);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO oip_state_cards (id,decision_id,standard_id,system_version,scope_json,risk_ceiling,jurisdiction,audit_depth,surety_snapshot_json,standing_dissent_json,certifier_type,certifier_label,authority,expires_at,status,parent_id,record_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)`)
        .bind(id, record.decision_id, record.standard_id, record.system_version, JSON.stringify(scope), record.risk_ceiling, record.jurisdiction, record.audit_depth, JSON.stringify(surety), JSON.stringify(dissent), certifierType, record.certifier_label, authority, record.expires_at, record.parent_id, hash, createdAt),
      env.DB.prepare(`INSERT INTO oip_state_card_events (id,card_id,action,actor,reason,evidence_json,invocation_id,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind('ce_' + hash.slice(0, 20), id, 'certify', record.certifier_label, text(body?.reason, 2000) || 'bounded certification', JSON.stringify(evidence), text(body?.invocation_id, 100) || null, createdAt),
    ]);
  } catch (error) { return { error: /UNIQUE|constraint/i.test(String(error)) ? 'identical card already exists' : 'state card write failed', status: 409 }; }
  if (record.parent_id) {
    await env.DB.prepare("UPDATE oip_state_cards SET status='superseded' WHERE id=? AND status='active'").bind(record.parent_id).run();
    await env.DB.prepare(`INSERT INTO oip_state_card_events (id,card_id,action,actor,reason,evidence_json,created_at) VALUES (?,?,?,?,?,'[]',?)`)
      .bind('ce_' + (await governanceSha(record.parent_id + id)).slice(0, 20), record.parent_id, 'supersede', record.certifier_label, 'superseded by ' + id, createdAt).run();
  }
  return { ok: true, card: await getStateCard(env, id), verify: `${BASE}/api/governance/cards/${id}`, outer_receipt_law: 'When invoked through STATE_CARD_CERTIFY, the enclosing inv_ receipt is the execution receipt for this append.' };
}

export async function revokeStateCard(env, body) {
  const card = await getStateCard(env, text(body?.card_id, 100));
  if (!card) return { error: 'unknown card_id', status: 404 };
  if (card.status === 'revoked') return { ok: true, already_revoked: true, card };
  if (card.status !== 'active') return { error: 'only active cards can be revoked', status: 409 };
  const actor = text(body?.actor, 300); const reason = text(body?.reason, 2000);
  if (!actor || !reason) return { error: 'actor and reason are required', status: 400 };
  const createdAt = new Date().toISOString(); const eventId = 'ce_' + (await governanceSha({ card: card.id, actor, reason, createdAt })).slice(0, 20);
  await env.DB.batch([
    env.DB.prepare("UPDATE oip_state_cards SET status='revoked' WHERE id=? AND status='active'").bind(card.id),
    env.DB.prepare(`INSERT INTO oip_state_card_events (id,card_id,action,actor,reason,evidence_json,invocation_id,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(eventId, card.id, 'revoke', actor, reason, JSON.stringify(list(body?.evidence, 200)), text(body?.invocation_id, 100) || null, createdAt),
  ]);
  return { ok: true, card: await getStateCard(env, card.id) };
}

export async function certifierHistory(env, label) {
  const value = text(label, 300);
  if (!value) return { error: 'certifier_label required', status: 400 };
  const rows = (await env.DB.prepare('SELECT * FROM oip_state_cards WHERE certifier_label=? ORDER BY created_at DESC LIMIT 500').bind(value).all()).results || [];
  const cards = [];
  for (const row of rows) cards.push(await getStateCard(env, row.id));
  return {
    protocol: 'OIP', kind: 'certifier_history', certifier_label: value, cards,
    counts: { total: cards.length, standing: cards.filter((card) => card.standing).length, revoked: cards.filter((card) => card.status === 'revoked').length, expired: cards.filter((card) => card.status === 'expired').length },
    law: 'This is the history filed under a self-asserted label. It does not by itself prove legal identity, competence, independence, regulatory authority or correct judgment.',
  };
}

export const modelGovernanceManifest = {
  protocol: 'OIP', kind: 'model_governance_facet', version: '1.0',
  thesis: 'Models file clause-cited decision justifications, evidence, uncertainty and counterarguments; independent reviewers confirm or challenge them; later receipts and outcomes can repair the record.',
  boundary: 'The system records an accountability artifact, not hidden chain-of-thought. Model conclusions remain advisory unless separately authorized. Corroboration does not become truth or law.',
  objects: ['STANDARD_REGISTER', 'DECISION_RECORD', 'REVIEW_RECORD', 'SURETY_RECORD', 'STATE_CARD_CERTIFY', 'STATE_CARD_REVOKE', 'CERTIFIER_HISTORY'],
};
