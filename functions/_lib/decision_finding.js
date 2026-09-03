// decision-finding@1.0.0 — a deterministic parsed projection of a governed model finding.
//
// The raw gateway payload stays untouched and authoritative. This object is what the sealer
// compares, so two models become mechanically comparable at the level of DERIVATION, not just
// the verdict word or the bare clause numbers. It NEVER infers or repairs a missing field: a
// structurally invalid finding is marked invalid with its exact errors and can never authorise.
//
// The defect this closes (documented in /a/auditable-reasoning-audited): the old sealer read
// bracketed clause numbers, so three models could cite [1,2,3] while assigning different truth
// states, evidence, or effects to those clauses — and the gate called that agreement. The
// canonical per-clause tuple below makes that impossible: agreement now requires the same
// clause, the same trigger_state, the same disposition, and the same load-bearing evidence set.

export const FINDING_VERSION = 'decision-finding@1.0.0';

const VALID_VERDICTS = ['AFFIRM', 'DENY', 'CANNOT_CONCLUDE'];
const VALID_TRIGGER = ['triggered', 'not_triggered', 'conflict', 'unknown'];
// 'blocks' (v1.3.3): clause leaves a necessary condition unresolved — prevents authorisation
// without proving denial. The abstention disposition; 'supports'/'defeats' over a gap was the
// divergence that made a clean NO_ACTION unreachable under v1.3.2.
const VALID_DISPOSITION = ['supports', 'defeats', 'blocks', 'neutral'];
const C8_FIELDS = ['APPLICABLE_RULES', 'KNOWN_FACTS', 'UNKNOWN_FACTS', 'EVIDENCE_USED', 'PROPOSED_ACTION',
  'REJECTED_ALTERNATIVE', 'EXPECTED_RESULT', 'FAILURE_RESPONSE', 'VERIFICATION_REQUIRED', 'RECORDS_ABSENT', 'VERDICT'];

async function sha256Hex(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s || '')));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

function fieldBlock(text, label) {
  // From LABEL: to the next ALL-CAPS field label or end.
  const re = new RegExp('(?:^|\\n)\\s*' + label + '\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z_ ]{2,}\\s*:|\\nDECISION:|$)', 'i');
  const m = re.exec(text);
  return m ? m[1].trim() : null;
}

function extractApplicableRules(text) {
  const raw = fieldBlock(text, 'APPLICABLE_RULES') || '';
  return [...new Set([...raw.matchAll(/(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

// CLAUSE_EVALUATIONS is a JSON array. Accept it inline anywhere in the response; take the first
// well-formed array that carries objects with a "clause" key.
function extractClauseVector(text) {
  const label = /CLAUSE_EVALUATIONS\s*:?\s*(\[)/i.exec(text);
  const start = label ? label.index + label[0].length - 1 : -1;
  const scan = (from) => {
    let depth = 0, inStr = false, esc = false;
    for (let i = from; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) return text.slice(from, i + 1); }
    }
    return null;
  };
  const tryParse = (from) => { const blk = scan(from); if (!blk) return null; try { const a = JSON.parse(blk); return Array.isArray(a) && a.some((o) => o && o.clause != null) ? a : null; } catch { return null; } };
  if (start >= 0) { const v = tryParse(start); if (v) return v; }
  // fallback: first bracket that yields a clause array
  for (let i = 0; i < text.length; i++) { if (text[i] === '[') { const v = tryParse(i); if (v) return v; } }
  return null;
}

// The canonical, wording-independent signature of one finding's derivation. Ground text is
// deliberately excluded — models may word the ground differently and still agree on the logic.
export function derivationSignature(clauseVector) {
  if (!Array.isArray(clauseVector) || !clauseVector.length) return null;
  const tuples = clauseVector.map((c) => [
    String(c.clause).trim(),
    String(c.trigger_state || '').toLowerCase().trim(),
    String(c.disposition || '').toLowerCase().trim(),
    [...new Set((Array.isArray(c.evidence_ids) ? c.evidence_ids : []).map((e) => String(e).trim()))].sort().join('+'),
  ].join(':'));
  return tuples.slice().sort().join(' | ');
}

// Build the versioned parsed object. allowedEvidence (optional) is the set of record ids the
// artifact actually supplied; when given, an evidence id outside it is a structural error
// (invented evidence). constitutionVersion/hashes are read from the request text.
export async function parseDecisionFinding(rawResponse, requestText, opts = {}) {
  const text = String(rawResponse || '');
  const errors = [];

  const verdictM = text.match(/\bVERDICT:\s*(AFFIRM|DENY|CANNOT_CONCLUDE)\b/i);
  const verdict = verdictM ? verdictM[1].toUpperCase() : null;
  if (!verdict) errors.push('missing_or_invalid_VERDICT');

  const decisionM = text.match(/DECISION:\s*(VERDICT|TOOL|ASK|REFUSE)\b[^\n]*/i);
  if (!decisionM) errors.push('missing_terminal_DECISION');

  for (const f of C8_FIELDS) { if (fieldBlock(text, f) == null) errors.push('missing_C8_field:' + f); }

  const applicable = extractApplicableRules(text);
  const vector = extractClauseVector(text);
  const clauseEvals = [];
  if (!vector) {
    errors.push('missing_or_unparseable_CLAUSE_EVALUATIONS');
  } else {
    const seen = new Set();
    for (const c of vector) {
      const id = String(c && c.clause != null ? c.clause : '').trim();
      const trig = String(c && c.trigger_state || '').toLowerCase().trim();
      const disp = String(c && c.disposition || '').toLowerCase().trim();
      const ev = Array.isArray(c && c.evidence_ids) ? c.evidence_ids.map((x) => String(x).trim()) : [];
      if (!id) { errors.push('clause_eval_missing_clause_id'); continue; }
      if (seen.has(id)) errors.push('duplicate_clause_eval:' + id); seen.add(id);
      if (!VALID_TRIGGER.includes(trig)) errors.push('invalid_trigger_state:' + id + '=' + trig);
      if (!VALID_DISPOSITION.includes(disp)) errors.push('invalid_disposition:' + id + '=' + disp);
      if (opts.allowedEvidence && opts.allowedEvidence.size) {
        for (const e of ev) if (!opts.allowedEvidence.has(e)) errors.push('invented_evidence_id:' + id + '->' + e);
      }
      clauseEvals.push({ clause: id, trigger_state: trig, disposition: disp, evidence_ids: [...new Set(ev)].sort(), ground: String(c.ground || '').slice(0, 400) });
    }
    // vector clause set must equal the exhaustive APPLICABLE_RULES set
    const vecIds = [...new Set(clauseEvals.map((c) => Number(c.clause)))].filter(Number.isFinite).sort((a, b) => a - b);
    if (applicable.length && (vecIds.join(',') !== applicable.join(','))) {
      errors.push('clause_vector_mismatch_applicable:[' + vecIds.join(',') + ']vs[' + applicable.join(',') + ']');
    }
  }

  const req = String(requestText || '');
  const constitutionVersion = (req.match(/decision-constitution@([0-9.]+(?:-[a-z0-9]+)?)/i) || [])[0] || null;
  if (!constitutionVersion) errors.push('constitution_absent_from_request');
  const rulesetHash = (req.match(/RULESET_HASH:\s*([0-9a-f]{64})/i) || [])[1] || null;
  const artifactHash = (req.match(/(?:ARTIFACT_SHA256|ARTIFACT_HASH):\s*([0-9a-f]{64})/i) || [])[1] || null;

  return {
    version: FINDING_VERSION,
    constitution_version: constitutionVersion,
    ruleset_hash: rulesetHash,
    artifact_hash: artifactHash,
    verdict,
    decision_line: decisionM ? decisionM[0].slice(0, 240) : null,
    applicable_rules: applicable,
    clause_evaluations: clauseEvals,
    derivation_signature: derivationSignature(clauseEvals),
    raw_request_sha256: await sha256Hex(req),
    raw_response_sha256: await sha256Hex(text),
    structural_errors: errors,
    structurally_valid: errors.length === 0,
  };
}
