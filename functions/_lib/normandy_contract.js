import { SOFTWARE_COMPARISON_AXIS_IDS, normalizeSoftwareComparisonAxis } from './build_comparison_axes.js';

export const NORMANDY_SLOTS = [
  { id: 'opened_source', stores: 'One opened source with URL, title, evidence class, observed time, and the exact fact it establishes.' },
  { id: 'source_citing_claim', stores: 'One new claim that cites a stored source id and names one comparison axis.' },
  { id: 'overlap', stores: 'One evidenced capability both systems have.' },
  { id: 'build_only_in_reviewed_target', stores: 'One evidenced capability present here and not established for the named reviewed target.' },
  { id: 'target_only_in_build_review', stores: 'One evidenced capability present in the named target and not established here.' },
  { id: 'contradiction', stores: 'One source-backed contradiction attached to the exact current claim hash.' },
  { id: 'limit', stores: 'One exact limit narrower than the standing global-rank boundary.' },
  { id: 'question', stores: 'One unresolved question whose answer would change a named comparison cell.' },
  { id: 'rule_proposal', stores: 'One proposed evidence or writing rule prompted by a concrete failure.' },
  { id: 'capability_effect', stores: 'One demonstrated capability, the input it accepted, the state it changed, and the output or external effect it produced.' },
  { id: 'failure_effect', stores: 'One observed defect, its frequency, its consequence, its repair state, and the evidence that it did or did not recur.' },
  { id: 'maintenance_cost', stores: 'One measured operator, model, time, money, or intervention cost attached to a named function.' },
  { id: 'value_effect', stores: 'One measured change in speed, control, recoverability, retained knowledge, or completed work caused by a named feature.' },
];

export const STANDING_ANSWER_LIMITS = [
  'A global rank across invisible private systems is unknown.',
  'Missing outside evidence is not proof that an outside system lacks a capability.',
  'A successful receipt proves one run, not general reliability.',
  'Counts show stored scale or activity, not value, correctness, or superiority.',
  'Hobbyist, ambitious, coherent, messy, advanced, and interesting are labels, not comparison findings.',
];

function parse(value, fallback = {}) { try { return JSON.parse(value || '') || fallback; } catch { return fallback; } }
function absolute(origin, path) { return String(origin || 'https://miscsubjects.com').replace(/\/$/, '') + path; }
function norm(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function words(value) { return new Set(norm(value).split(/\s+/).filter(Boolean)); }

export function contributionSimilarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let same = 0;
  for (const word of A) if (B.has(word)) same++;
  return same / Math.max(A.size, B.size);
}

export function findClaimDuplicate(claims, text, threshold = 0.8) {
  const clean = norm(text);
  if (!clean) return null;
  let best = null;
  for (const claim of Array.isArray(claims) ? claims : []) {
    const score = contributionSimilarity(clean, claim?.text);
    if (norm(claim?.text) === clean) return { claim, similarity: 1 };
    if (score >= threshold && (!best || score > best.similarity)) best = { claim, similarity: score };
  }
  return best;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function articleRows(env) {
  const rows = (await env.DB.prepare("SELECT slug,title,meta,updated_at FROM articles WHERE published=1 AND (slug='opos-formal-audit' OR slug LIKE 'field-%') ORDER BY slug").all()).results || [];
  return rows.map(row => ({ ...row, parsed: parse(row.meta) }));
}

function populatedAxes(row) {
  const set = new Set();
  for (const claim of Array.isArray(row?.parsed?.claims) ? row.parsed.claims : []) {
    if (!(claim.source_ids || []).length) continue;
    const axis = normalizeSoftwareComparisonAxis(claim.section);
    if (SOFTWARE_COMPARISON_AXIS_IDS.includes(axis)) set.add(axis);
  }
  return set;
}

async function openReservations(env) {
  try {
    const rows = (await env.DB.prepare("SELECT slot_key FROM normandy_assignments WHERE status='open' AND expires_at > datetime('now')").all()).results || [];
    return new Set(rows.map(row => row.slot_key));
  } catch { return new Set(); }
}

function candidates(rows, reserved) {
  const out = [];
  const fields = rows.filter(row => row.slug.startsWith('field-'));
  for (const row of fields) {
    const filled = populatedAxes(row);
    for (const axis of SOFTWARE_COMPARISON_AXIS_IDS) {
      const slotKey = row.slug + '|' + axis + '|outside_evidence';
      if (!filled.has(axis) && !reserved.has(slotKey)) out.push({ slot_key: slotKey, target_slug: row.slug, target_name: row.title, axis, required_slot: 'outside_evidence' });
    }
  }
  const root = rows.find(row => row.slug === 'opos-formal-audit');
  const filled = populatedAxes(root);
  for (const axis of SOFTWARE_COMPARISON_AXIS_IDS) {
    const slotKey = 'opos-formal-audit|' + axis + '|build_evidence';
    if (!filled.has(axis) && !reserved.has(slotKey)) out.push({ slot_key: slotKey, target_slug: 'opos-formal-audit', target_name: 'OPOS / miscsubjects build', axis, required_slot: 'build_evidence' });
  }
  return out;
}

function currentCells(row, axis) {
  const claims = (Array.isArray(row?.parsed?.claims) ? row.parsed.claims : []).filter(claim => normalizeSoftwareComparisonAxis(claim.section) === axis);
  const sources = Array.isArray(row?.parsed?.sources) ? row.parsed.sources : [];
  return {
    claims: claims.map(claim => ({ id: claim.id, text: claim.text, source_ids: claim.source_ids || [], register: claim.register || null })).slice(0, 40),
    sources: sources.filter(source => claims.some(claim => (claim.source_ids || []).includes(source.id))).map(source => ({ id: source.id, url: source.url, title: source.title, evidence_class: source.extra?.evidence_class || source.type })).slice(0, 40),
  };
}

export async function reserveNormandyAssignment(env, origin, capabilityFingerprint) {
  const rows = await articleRows(env);
  const reserved = await openReservations(env);
  const pick = candidates(rows, reserved)[0] || { slot_key: 'opos-formal-audit|unresolved|new_rule_or_question', target_slug: 'opos-formal-audit', target_name: 'OPOS / miscsubjects build', axis: 'unresolved', required_slot: 'rule_or_question' };
  const row = rows.find(item => item.slug === pick.target_slug);
  const cells = currentCells(row, pick.axis);
  const snapshot = {
    target_updated_at: row?.updated_at || null,
    claim_count: Array.isArray(row?.parsed?.claims) ? row.parsed.claims.length : 0,
    source_count: Array.isArray(row?.parsed?.sources) ? row.parsed.sources.length : 0,
    axis_claims: cells.claims,
    source_head: row?.parsed?.source_head || 'genesis',
  };
  const snapshotHash = await digest(JSON.stringify(snapshot));
  const id = 'norm-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await env.DB.prepare("INSERT INTO normandy_assignments (id,slot_key,target_slug,target_name,axis,required_slot,status,capability_fingerprint,snapshot_hash,snapshot_json,created_at,expires_at) VALUES (?,?,?,?,?,?,'open',?,?,?,datetime('now'),datetime('now','+24 hours'))")
    .bind(id, pick.slot_key, pick.target_slug, pick.target_name, pick.axis, pick.required_slot, String(capabilityFingerprint || ''), snapshotHash, JSON.stringify(snapshot)).run();
  return {
    schema: 'miscsubjects-normandy-assignment/1.0',
    assignment_id: id,
    slot_key: pick.slot_key,
    target: { slug: pick.target_slug, name: pick.target_name, article: absolute(origin, '/a/' + pick.target_slug), machine: absolute(origin, '/api/articles/' + pick.target_slug) },
    axis: pick.axis,
    required_slot: pick.required_slot,
    snapshot_hash: snapshotHash,
    existing_axis_cells: cells,
    standing_answer_limits: STANDING_ANSWER_LIMITS,
    slots: NORMANDY_SLOTS,
    contract: absolute(origin, '/api/normandy?assignment=' + encodeURIComponent(id)),
    claims: absolute(origin, '/api/articles/' + pick.target_slug + '/claims'),
    sources: absolute(origin, '/api/articles/' + pick.target_slug + '/sources'),
    discourse: absolute(origin, '/api/articles/' + pick.target_slug + '/discourse'),
    append: absolute(origin, '/api/protocol/voxel-batch'),
    answer_field: 'The voxel-batch body carries answer with the exact owner-facing response. It is stored as an article contribution and duplicate answers are rejected.',
  };
}

export async function readNormandyAssignment(env, origin, id) {
  let stored = null;
  try { stored = await env.DB.prepare('SELECT * FROM normandy_assignments WHERE id=?').bind(String(id || '')).first(); } catch {}
  if (!stored) return null;
  return {
    schema: 'miscsubjects-normandy-assignment/1.0', assignment_id: stored.id, slot_key: stored.slot_key,
    target: { slug: stored.target_slug, name: stored.target_name, article: absolute(origin, '/a/' + stored.target_slug), machine: absolute(origin, '/api/articles/' + stored.target_slug) },
    axis: stored.axis, required_slot: stored.required_slot, status: stored.status,
    capability_fingerprint: stored.capability_fingerprint, snapshot_hash: stored.snapshot_hash,
    snapshot: parse(stored.snapshot_json), result: parse(stored.result_json, null),
    standing_answer_limits: STANDING_ANSWER_LIMITS, slots: NORMANDY_SLOTS,
    claims: absolute(origin, '/api/articles/' + stored.target_slug + '/claims'),
    sources: absolute(origin, '/api/articles/' + stored.target_slug + '/sources'),
    discourse: absolute(origin, '/api/articles/' + stored.target_slug + '/discourse'),
    append: absolute(origin, '/api/protocol/voxel-batch'),
    answer_field: 'The voxel-batch body carries answer with the exact owner-facing response. It is stored as an article contribution and duplicate answers are rejected.',
  };
}

export async function completeNormandyAssignment(env, id, capabilityFingerprint, result) {
  if (!id) return { ok: false, error: 'assignment_id required' };
  let row = null;
  try { row = await env.DB.prepare('SELECT * FROM normandy_assignments WHERE id=?').bind(String(id)).first(); } catch { return { ok: false, error: 'assignment store unavailable' }; }
  if (!row) return { ok: false, error: 'unknown assignment_id' };
  if (row.status === 'completed') return { ok: false, error: 'assignment_already_completed', result: parse(row.result_json, null) };
  if (row.capability_fingerprint && capabilityFingerprint && row.capability_fingerprint !== capabilityFingerprint) return { ok: false, error: 'assignment_capability_mismatch' };
  await env.DB.prepare("UPDATE normandy_assignments SET status='completed',completed_at=datetime('now'),result_json=? WHERE id=? AND status='open'").bind(JSON.stringify(result || {}), row.id).run();
  return { ok: true, assignment_id: row.id, slot_key: row.slot_key, status: 'completed' };
}

export function normandyMarkdown(packet) {
  if (!packet) return '# Normandy assignment\n\nUnknown assignment.';
  const lines = [
    '# Normandy contribution contract', '',
    'Assignment: ' + packet.assignment_id,
    'Target: ' + packet.target.name + ' — ' + packet.target.article,
    'Axis: ' + packet.axis,
    'Empty slot: ' + packet.required_slot, '',
    'The standing global-rank boundary is already stored. Repeating it does not complete this assignment.', '',
    '## Existing axis cells', '',
    '```json', JSON.stringify(packet.existing_axis_cells || packet.snapshot?.axis_claims || {}, null, 2), '```', '',
    '## Additive slots', '',
    ...NORMANDY_SLOTS.map(slot => '- ' + slot.id + ' — ' + slot.stores), '',
    '## Completion state', '',
    'At least one new source, source-citing claim, exact-hash contradiction, narrower limit, consequential question, or concrete rule proposal lands in the article graph. The exact owner-facing answer lands as an article contribution. Duplicate-only operations or a repeated answer leave the assignment open.', '',
    'Append endpoint: ' + packet.append,
    'Claims: ' + packet.claims,
    'Sources: ' + packet.sources,
    'Discourse: ' + packet.discourse,
  ];
  return lines.join('\n');
}
