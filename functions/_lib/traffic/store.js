
import { buildNowIso } from '../build_time.js';
import { logEvent } from '../event_log.js';
import { validateCondition } from './conditions.js';
import { SIGNAL_PATHS } from './signals.js';
import { sha256Hex, identifierHash, maskIdentifier } from './grants.js';

export const DEFAULT_TENANT = 't_root';
export const RULESET_STATES = ['draft', 'test', 'active', 'retired'];
export const FAIL_MODES = ['FAIL_CLOSED', 'FALLBACK', 'DENY', 'STATIC_PAGE'];
export const DESTINATION_TYPES = ['redirect', 'inline', 'proxy', 'group', 'static', 'squeeze'];
export const HEALTH_STATES = ['healthy', 'degraded', 'maintenance', 'down', 'unknown'];
export const LIST_KINDS = ['profile', 'device', 'identifier', 'ip', 'cidr', 'country', 'asn', 'email_domain', 'tag', 'ua', 'referrer', 'region', 'visitor_hash', 'phone_hash'];
export const LIST_EFFECTS = ['decide', 'score', 'skip_challenge', 'route', 'set'];
export const ACTION_TYPES = ['destination', 'experience', 'outcome', 'require_turnstile', 'require_ack', 'tag', 'experiment', 'set', 'persist', 'deny', 'allow', 'grant', 'ttl', 'stop', 'continue', 'capability', 'emit', 'score', 'membership'];
export const EXPERIENCES = ['VERIFY', 'ACK', 'DENY', 'STATIC', 'UNAVAILABLE', 'SQUEEZE'];
export const OUTCOMES = ['approved', 'blocked', 'unknown', 'review'];
export const MEMBERSHIP_STATUSES = ['approved', 'blocked', 'review'];
export const POPULATIONS = ['manual', 'sms_verified', 'customer', 'trusted_device', 'rule', 'behavior', 'external', 'approved_history', 'blocked_history'];
export const SIGNAL_POLICY_EFFECTS = ['allow', 'block', 'score', 'challenge', 'observe'];
export const EVENT_TYPES = ['PAGE_VIEW', 'PRODUCT_VIEW', 'CTA_CLICK', 'SMS_COMPOSER_OPEN', 'SMS_RECEIVED', 'SMS_VERIFIED', 'CUSTOMER_IDENTIFIED', 'ORDER_CREATED', 'ORDER_REFUNDED', 'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_CANCELED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'KLAVIYO_EMAIL_SENT', 'KLAVIYO_EMAIL_OPENED', 'KLAVIYO_EMAIL_CLICKED', 'KLAVIYO_EVENT', 'ROUTING_DECISION', 'TURNSTILE_CHALLENGE', 'TURNSTILE_PASS', 'TURNSTILE_FAIL', 'EXPERIMENT_EXPOSURE', 'DESTINATION_REACHED', 'ACK_ACCEPTED', 'GRANT_CONSUMED', 'GRANT_REPLAYED', 'PROFILE_MERGED', 'PROFILE_SPLIT', 'DEVICE_TRUSTED', 'DEVICE_REVOKED', 'CONVERSION', 'CUSTOM'];

export const CONFIG_TABLES = Object.freeze({
  traffic_rules: { id: 'id', fields: ['ruleset_id', 'name', 'description', 'enabled', 'shadow', 'priority', 'condition_json', 'actions_json', 'on_match', 'effective_from', 'effective_to'] },
  traffic_rulesets: { id: 'id', fields: ['name', 'description', 'state', 'entry_json', 'priority', 'default_destination', 'fail_mode', 'static_html', 'business_tz', 'turnstile_max_age_s', 'capture_query_json', 'allowed_capabilities_json', 'enrichment_json', 'salt', 'status_precedence_json', 'campaign_id'] },
  traffic_destinations: { id: 'id', fields: ['name', 'type', 'url', 'html', 'enabled', 'health', 'fallback_id', 'allowed_hosts_json', 'query_passthrough', 'attribution_passthrough', 'grant_required', 'grant_ttl_s', 'grant_one_time', 'members_json', 'sticky', 'campaign_id', 'meta_json'] },
  traffic_list_entries: { id: 'id', fields: ['list', 'kind', 'value', 'reason', 'expires_at', 'enabled', 'priority', 'effect', 'effect_json', 'provenance', 'meta_json'] },
  traffic_segments: { id: 'id', fields: ['name', 'description', 'condition_json', 'enabled', 'scope'] },
  traffic_experiments: { id: 'id', fields: ['name', 'description', 'enabled', 'state', 'assignment', 'unit', 'salt', 'variants_json', 'segment_condition_json', 'start_at', 'end_at'] },
  traffic_campaigns: { id: 'id', fields: ['name', 'description', 'enabled', 'ruleset_id', 'entry', 'attribution_json', 'default_destination', 'approved_destination', 'blocked_destination', 'review_destination', 'fallback_destination', 'blocked_capture', 'sms_phone', 'sms_channel', 'sms_message_template', 'sms_reply_approved', 'sms_reply_blocked', 'sms_reply_review', 'access_policy_json', 'experiments_json', 'expected_countries_json', 'start_at', 'end_at', 'goals_json'] },
  traffic_squeeze_pages: { id: 'id', fields: ['campaign_id', 'name', 'enabled', 'version', 'weight', 'status', 'headline', 'body_html', 'cta_text', 'media_json', 'layout', 'phone', 'channel', 'message_template', 'completion_html', 'fallback_html', 'start_at', 'end_at'] },
  traffic_signal_policy: { id: 'id', fields: ['signal', 'value', 'effect', 'effect_value', 'note', 'enabled'] },
});

const SNAPSHOT_TTL_S = 300;
const MEMO_MS = 15000;
const memo = new Map(); // tenant -> { at, snap }

export function newId(prefix) {
  try { return prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 14); } catch { return prefix + '_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); }
}
export function tenantOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return DEFAULT_TENANT;
  const slug = s.replace(/^t_/, '').replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
  return 't_' + slug;
}
export function j(v, fallback) { if (v == null || v === '') return fallback; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return fallback; } }
export function js(v) { return v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v)); }
function bool01(v) { return /^(1|true|yes|on|enabled)$/i.test(String(v).trim()) ? 1 : 0; }

// ------------------------------------------------------------------ snapshot (read side)

function hydrateRuleset(rs, rules) {
  return {
    ...rs,
    entry: j(rs.entry_json, []), capture_query: j(rs.capture_query_json, []), allowed_capabilities: j(rs.allowed_capabilities_json, []), enrichment: j(rs.enrichment_json, []), status_precedence: j(rs.status_precedence_json, null),
    rules: rules.filter((r) => r.ruleset_id === rs.id).sort((a, b) => (a.priority - b.priority) || String(a.id).localeCompare(String(b.id)))
      .map((r) => ({ ...r, condition: j(r.condition_json, {}), actions: j(r.actions_json, []) })),
  };
}

/** Load every table a decision needs, for one tenant, from D1 (no cache). */
export async function loadSnapshotFromDb(env, tenant) {
  const t = tenantOf(tenant);
  const q = (sql) => env.DB.prepare(sql).bind(t);
  const [rs, rules, dests, lists, segs, exps, camps, pol] = await env.DB.batch([
    q("SELECT * FROM traffic_rulesets WHERE tenant_id=? AND state IN ('active','test')"),
    q('SELECT * FROM traffic_rules WHERE tenant_id=? AND enabled=1'),
    q('SELECT * FROM traffic_destinations WHERE tenant_id=?'),
    env.DB.prepare("SELECT * FROM traffic_list_entries WHERE tenant_id=? AND enabled=1 AND (expires_at IS NULL OR expires_at='' OR expires_at > ?)").bind(t, buildNowIso()),
    q('SELECT * FROM traffic_segments WHERE tenant_id=? AND enabled=1'),
    q("SELECT * FROM traffic_experiments WHERE tenant_id=? AND enabled=1 AND state='active'"),
    q('SELECT * FROM traffic_campaigns WHERE tenant_id=? AND enabled=1'),
    q('SELECT * FROM traffic_signal_policy WHERE tenant_id=? AND enabled=1'),
  ]);
  const destinations = {};
  for (const d of dests.results || []) destinations[d.id] = { ...d, allowed_hosts: j(d.allowed_hosts_json, []), members: j(d.members_json, []), meta: j(d.meta_json, {}) };
  const campaigns = {};
  for (const c of camps.results || []) campaigns[c.id] = { ...c, attribution: j(c.attribution_json, null), access_policy: j(c.access_policy_json, {}), expected_countries: j(c.expected_countries_json, []), experiments_cfg: j(c.experiments_json, []) };
  const snap = {
    tenant: t, stamp: buildNowIso(),
    rulesets: (rs.results || []).map((r) => hydrateRuleset(r, rules.results || [])).sort((a, b) => (a.priority - b.priority) || String(a.id).localeCompare(String(b.id))),
    destinations, campaigns,
    lists: (lists.results || []).map((l) => ({ ...l, effect_obj: j(l.effect_json, {}) })).sort((a, b) => (a.priority - b.priority) || String(a.id).localeCompare(String(b.id))),
    segments: (segs.results || []).map((s) => ({ ...s, condition: j(s.condition_json, {}) })),
    experiments: (exps.results || []).map((e) => ({ ...e, variants: j(e.variants_json, []), segment_condition: j(e.segment_condition_json, null) })),
    signal_policy: pol.results || [],
  };
  snap.hash = 'sha256:' + await sha256Hex(JSON.stringify({ r: snap.rulesets, d: snap.destinations, l: snap.lists, s: snap.segments, e: snap.experiments, c: snap.campaigns, p: snap.signal_policy }));
  return snap;
}

export function snapshotKey(tenant) { return 'traffic:snapshot:' + tenantOf(tenant); }

/** Cached snapshot: isolate memo (15s) → KV (300s) → D1. */
export async function loadSnapshot(env, tenant, { fresh = false } = {}) {
  const t = tenantOf(tenant);
  const m = memo.get(t);
  if (!fresh && m && Date.now() - m.at < MEMO_MS) return { ...m.snap, cache: 'memo' };
  if (!fresh && env.KV) {
    try {
      const raw = await env.KV.get(snapshotKey(t));
      if (raw) { const snap = JSON.parse(raw); memo.set(t, { at: Date.now(), snap }); return { ...snap, cache: 'kv' }; }
    } catch { /* fall through to D1 */ }
  }
  const snap = await loadSnapshotFromDb(env, t);
  memo.set(t, { at: Date.now(), snap });
  if (env.KV) { try { await env.KV.put(snapshotKey(t), JSON.stringify(snap), { expirationTtl: SNAPSHOT_TTL_S, metadata: { ts: snap.stamp } }); } catch { /* cache is optional */ } }
  return { ...snap, cache: 'd1' };
}

export async function invalidateSnapshot(env, tenant) {
  const t = tenantOf(tenant);
  memo.delete(t);
  if (env.KV) { try { await env.KV.delete(snapshotKey(t)); } catch { /* optional */ } }
}

// ------------------------------------------------------------------ memberships (APPROVED / BLOCKED / UNKNOWN)

export const DEFAULT_PRECEDENCE = ['manual', 'sms_verified', 'customer', 'trusted_device', 'rule', 'behavior', 'external', 'approved_history', 'blocked_history'];

/** Effective status from memberships by population precedence. Mixed statuses inside the deciding population → review. */
export function effectiveStatus(rows, precedence = null) {
  const order = Array.isArray(precedence) && precedence.length ? precedence : DEFAULT_PRECEDENCE;
  const list = rows.map((r) => ({ id: r.id, population: r.population, status: r.effective_status || r.status, subject_kind: r.subject_kind, source: r.source, confidence: r.confidence }));
  for (const pop of order) {
    const here = pop === 'approved_history' || pop === 'blocked_history' ? list.filter((m) => m.population === 'approved_history' || m.population === 'blocked_history') : list.filter((m) => m.population === pop);
    if (!here.length) continue;
    const statuses = new Set(here.map((m) => m.status));
    if (statuses.size === 1) return { status: [...statuses][0], source: pop === 'approved_history' || pop === 'blocked_history' ? 'jci_history' : pop, list };
    return { status: 'review', source: (pop === 'approved_history' || pop === 'blocked_history' ? 'jci_history' : pop) + ':mixed', list };
  }
  return { status: 'unknown', source: null, list };
}

export async function loadMemberships(env, { tenant, profile_id, device_id, phone_hash = null, visitor_hash = null, precedence = null }) {
  const t = tenantOf(tenant);
  const rows = (await env.DB.prepare("SELECT * FROM traffic_memberships WHERE tenant_id=? AND superseded_at IS NULL AND ((subject_kind='profile' AND subject_value=?) OR (subject_kind='device' AND subject_value=?) OR (subject_kind='phone_hash' AND subject_value=?) OR (subject_kind='visitor_hash' AND subject_value=?))")
    .bind(t, profile_id || '', device_id || '', phone_hash || '', visitor_hash || '').all()).results || [];
  return effectiveStatus(rows, precedence);
}

/** Insert or supersede a membership for one subject in one population. Every change carries provenance and is ledgered. */
export async function upsertMembership(env, { tenant, subject_kind, subject_value, status, population, source, provenance = null, confidence = 1, actor = 'system', original_decision = null, original_reason = null, decided_at = null, reason = '' }) {
  const t = tenantOf(tenant);
  if (!MEMBERSHIP_STATUSES.includes(status)) return { ok: false, errors: [{ error: 'bad_status', allowed: MEMBERSHIP_STATUSES }] };
  if (!POPULATIONS.includes(population)) return { ok: false, errors: [{ error: 'bad_population', allowed: POPULATIONS }] };
  if (!subject_kind || !subject_value) return { ok: false, errors: [{ error: 'subject_required' }] };
  const now = buildNowIso();
  const prev = (await env.DB.prepare('SELECT id, status FROM traffic_memberships WHERE tenant_id=? AND subject_kind=? AND subject_value=? AND population=? AND superseded_at IS NULL').bind(t, subject_kind, subject_value, population).all()).results || [];
  const id = newId('mem');
  const stmts = [];
  for (const p of prev) if (p.status !== status || population !== 'manual') stmts.push(env.DB.prepare('UPDATE traffic_memberships SET superseded_at=?, superseded_by=?, updated_at=? WHERE tenant_id=? AND id=?').bind(now, id, now, t, p.id));
  if (prev.some((p) => p.status === status) && population !== 'manual') {
    // same status already active → append evidence instead of a new row
    const keep = prev.find((p) => p.status === status);
    await env.DB.prepare("UPDATE traffic_memberships SET evidence_json = json_insert(COALESCE(evidence_json,'[]'), '$[#]', json(?)), updated_at=? WHERE tenant_id=? AND id=?").bind(JSON.stringify({ at: now, source, actor, provenance, reason }), now, t, keep.id).run();
    return { ok: true, id: keep.id, appended_evidence: true };
  }
  stmts.push(env.DB.prepare('INSERT INTO traffic_memberships (id, tenant_id, subject_kind, subject_value, status, population, source, provenance_json, original_decision, original_reason, decided_at, imported_at, confidence, evidence_json, effective_status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, subject_kind, subject_value, status, population, source, js(provenance), original_decision, original_reason, decided_at || now, null, confidence, '[]', status, actor, now, now));
  await env.DB.batch(stmts);
  await ledger(env, { key: 'TRAFFIC_MEMBERSHIP', action: status, actor, route: '/api/traffic/memberships', trace_id: id, request: { tenant: t, subject_kind, subject_value, population, source, reason, provenance }, response: { id, superseded: prev.map((p) => p.id) } });
  return { ok: true, id, superseded: prev.map((p) => p.id) };
}

// ------------------------------------------------------------------ identity reads (hot path)

const EMPTY_STORED = () => ({ device: null, profile: null, acks: {}, identifier_kinds: [], previous_destinations: [], experiments: {}, original_attribution: null, memberships: { status: 'unknown', source: null, list: [] }, history: null, visitor_hash: null });

/** Hot-path read: device + profile (with snapshot) + acks + identifier kinds + recent destinations + cohorts + memberships + history — two round trips. */
export async function loadStored(env, tenant, deviceId, { visitor_hash = null, precedence = null } = {}) {
  const t = tenantOf(tenant);
  const out = EMPTY_STORED();
  out.visitor_hash = visitor_hash;
  let profileId = null;
  if (deviceId) {
    const dev = await env.DB.prepare('SELECT * FROM traffic_devices WHERE tenant_id=? AND id=?').bind(t, deviceId).first();
    if (dev) {
      out.device = dev;
      profileId = dev.profile_id;
      let profile = profileId ? await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, profileId).first() : null;
      let hops = 0;
      while (profile && profile.merged_into && hops < 5) { profile = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, profile.merged_into).first(); hops++; }
      if (profile) { profileId = profile.id; out.profile = { ...profile, tags: j(profile.tags_json, []), attrs: j(profile.attrs_json, {}), snapshot: j(profile.snapshot_json, {}), merged: !!(profile.merged_from_json && profile.merged_from_json !== '[]') }; out.original_attribution = j(profile.original_attribution_json, null); }
    }
  }
  const stmts = [
    env.DB.prepare("SELECT policy_key, policy_version FROM traffic_acknowledgements WHERE tenant_id=? AND device_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY accepted_at DESC").bind(t, deviceId || '', buildNowIso()),
    env.DB.prepare('SELECT DISTINCT kind FROM traffic_identifiers WHERE tenant_id=? AND profile_id=? AND active=1').bind(t, profileId || ''),
    env.DB.prepare("SELECT destination_id FROM traffic_decisions WHERE tenant_id=? AND profile_id=? AND mode='live' AND destination_id IS NOT NULL ORDER BY ts DESC LIMIT 5").bind(t, profileId || ''),
    env.DB.prepare('SELECT experiment_id, variant FROM traffic_assignments WHERE tenant_id=? AND (profile_id=? OR device_id=?)').bind(t, profileId || '', deviceId || ''),
    env.DB.prepare("SELECT * FROM traffic_memberships WHERE tenant_id=? AND superseded_at IS NULL AND ((subject_kind='profile' AND subject_value=?) OR (subject_kind='device' AND subject_value=?) OR (subject_kind='visitor_hash' AND subject_value=?))").bind(t, profileId || '', deviceId || '', visitor_hash || ''),
    env.DB.prepare("SELECT COUNT(*) n, SUM(CASE WHEN decision='allowed' THEN 1 ELSE 0 END) allowed, SUM(CASE WHEN decision='blocked' THEN 1 ELSE 0 END) blocked, GROUP_CONCAT(DISTINCT raw_reason) reasons, MAX(ts) last_ts FROM traffic_history WHERE tenant_id=? AND visitor_hash=?").bind(t, visitor_hash || ''),
    env.DB.prepare('SELECT signals_json FROM traffic_history WHERE tenant_id=? AND visitor_hash=? ORDER BY ts DESC LIMIT 1').bind(t, visitor_hash || ''),
  ];
  const [acks, kinds, prev, cohorts, mems, hist, histLatest] = await env.DB.batch(stmts);
  const acksMap = {}; for (const a of acks.results || []) if (!(a.policy_key in acksMap)) acksMap[a.policy_key] = a.policy_version;
  const experiments = {}; for (const c of cohorts.results || []) experiments[c.experiment_id] = c.variant;
  out.acks = acksMap; out.identifier_kinds = (kinds.results || []).map((k) => k.kind); out.previous_destinations = (prev.results || []).map((p) => p.destination_id); out.experiments = experiments;
  out.memberships = effectiveStatus(mems.results || [], precedence);
  const h = hist.results?.[0];
  if (h && Number(h.n)) out.history = { jci_status: Number(h.allowed) && Number(h.blocked) ? 'mixed' : (Number(h.allowed) ? 'approved' : 'blocked'), jci_reasons: String(h.reasons || '').split(',').filter(Boolean), rows: Number(h.n), last_ts: h.last_ts, signals: j(histLatest.results?.[0]?.signals_json, {}) };
  return out;
}

// ------------------------------------------------------------------ ledger

export async function ledger(env, { key, action, status = 200, actor = 'traffic-engine', route = '/api/traffic', trace_id = null, request = null, response = null }) {
  try { return await logEvent(env, { source: 'traffic', key, action, direction: 'internal', status, actor, route, trace_id, request, response }); } catch { return null; }
}

// ------------------------------------------------------------------ evidence: decisions, events, visits

export async function persistDecision(env, decision) {
  const d = decision;
  await env.DB.prepare(`INSERT OR IGNORE INTO traffic_decisions (decision_id, tenant_id, ts, request_id, host, path, entry, mode, profile_id, device_id, session_id, ruleset_id, ruleset_revision, ruleset_hash, signals_json, evaluated_json, matched_rules_json, list_matches_json, turnstile_json, experiment_json, destination_id, experience, outcome, campaign_id, fallback_used, fail_mode_used, reason, latency_ms, grant_jti, shadow_json, error, evidence_hash, ledger_event_id, response_kind, response_target, profile_snapshot_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(d.decision_id, d.tenant, d.ts, d.request_id, d.host, d.path, d.entry, d.mode, d.profile_id, d.device_id, d.session_id, d.ruleset_id, d.ruleset_revision, d.ruleset_hash,
      js(d.signals), js(d.evaluated), js(d.matched_rules), js(d.list_matches), js(d.turnstile), js(d.experiment), d.destination_id, d.experience, d.outcome || null, d.campaign_id || null, d.fallback_used ? 1 : 0, d.fail_mode_used, d.reason, d.latency_ms, d.grant_jti, js(d.shadow), d.error, d.evidence_hash, d.ledger_event_id, d.response_kind, d.response_target, d.profile_snapshot_version ?? null).run();
  return d.decision_id;
}

/**
 * The canonical first-party event. Append-only. `source_event_id` makes adapter ingestion idempotent
 * (UNIQUE(tenant_id, source, source_event_id)). Returns { id, ts, evidence_hash, deduped }.
 */
export async function appendEvent(env, { tenant, kind, event_type = null, decision_id = null, profile_id = null, device_id = null, session_id = null, destination_id = null, experiment_id = null, variant = null, campaign_id = null, url = null, source = 'engine', source_event_id = null, ts = null, payload = null, attribution = null, provenance = null }) {
  const id = newId('ev');
  const now = buildNowIso();
  const type = String(event_type || kind || 'CUSTOM').toUpperCase();
  const evidence_hash = 'sha256:' + await sha256Hex(JSON.stringify({ id, tenant, kind: kind || type, type, decision_id, profile_id, device_id, session_id, destination_id, experiment_id, variant, campaign_id, url, source, source_event_id, payload, ts: ts || now }));
  const r = await env.DB.prepare('INSERT OR IGNORE INTO traffic_events (id, tenant_id, ts, kind, event_type, decision_id, profile_id, device_id, session_id, destination_id, experiment_id, variant, campaign_id, url, source, source_event_id, payload_json, attribution_json, provenance_json, evidence_hash, ingested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, tenantOf(tenant), ts || now, kind || type.toLowerCase(), type, decision_id, profile_id, device_id, session_id, destination_id, experiment_id, variant, campaign_id, url, source, source_event_id, js(payload), js(attribution), js(provenance), evidence_hash, now).run();
  return { id, ts: ts || now, evidence_hash, deduped: !(r.meta && r.meta.changes) };
}

/** After a live decision: device/profile/session upserts, first-touch attribution, click ids, cohorts. */
export async function persistVisit(env, { tenant, ctx, decision, deviceId, profileId, sessionId, newDevice, newProfile, secret, tags = null, attrs = null }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const stmts = [];
  const attrib = ctx.attribution || {};
  const firstTouch = { utm_source: attrib.utm_source, utm_medium: attrib.utm_medium, utm_campaign: attrib.utm_campaign, utm_content: attrib.utm_content, utm_term: attrib.utm_term, click_ids: attrib.click_ids, referring_domain: attrib.referring_domain, landing_page: attrib.landing_page, at: now, kind: 'observed' };
  if (newProfile) {
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO traffic_profiles (id, tenant_id, known, customer, tags_json, attrs_json, original_attribution_json, visit_count, first_seen, last_seen, created_at, updated_at, version) VALUES (?,?,0,0,?,?,?,1,?,?,?,?,1)')
      .bind(profileId, t, JSON.stringify(tags || []), JSON.stringify(attrs || {}), JSON.stringify(firstTouch), now, now, now, now));
  } else if (profileId) {
    stmts.push(env.DB.prepare(`UPDATE traffic_profiles SET last_seen=?, updated_at=?, visit_count = visit_count + ?, original_attribution_json = COALESCE(original_attribution_json, ?)${tags ? ', tags_json=?' : ''}${attrs ? ', attrs_json=?' : ''} WHERE tenant_id=? AND id=?`)
      .bind(...[now, now, ctx.session?.new ? 1 : 0, JSON.stringify(firstTouch)].concat(tags ? [JSON.stringify(tags)] : []).concat(attrs ? [JSON.stringify(attrs)] : []).concat([t, profileId])));
  }
  if (deviceId) {
    if (newDevice) {
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO traffic_devices (id, tenant_id, profile_id, trusted, class, browser, os, locale, timezone, first_seen, last_seen, last_ip_prefix, last_region, visit_count, meta_json) VALUES (?,?,?,0,?,?,?,?,?,?,?,?,?,1,?)')
        .bind(deviceId, t, profileId, ctx.device?.class || null, ctx.device?.browser || null, ctx.device?.os || null, ctx.device?.locale || null, ctx.device?.timezone || null, now, now, ctx.network?.ip_prefix || null, ctx.network?.region_code || ctx.network?.region || null, JSON.stringify({})));
    } else {
      stmts.push(env.DB.prepare('UPDATE traffic_devices SET last_seen=?, last_ip_prefix=?, last_region=COALESCE(?, last_region), class=COALESCE(?, class), browser=COALESCE(?, browser), os=COALESCE(?, os), locale=COALESCE(?, locale), timezone=COALESCE(?, timezone), visit_count = visit_count + ? WHERE tenant_id=? AND id=?')
        .bind(now, ctx.network?.ip_prefix || null, ctx.network?.region_code || ctx.network?.region || null, ctx.device?.class || null, ctx.device?.browser || null, ctx.device?.os || null, ctx.device?.locale || null, ctx.device?.timezone || null, ctx.session?.new ? 1 : 0, t, deviceId));
    }
  }
  if (sessionId) {
    stmts.push(env.DB.prepare(`INSERT INTO traffic_sessions (session_id, tenant_id, profile_id, device_id, started_at, last_seen, landing_page, attribution_json, campaign_id, experiments_json, routing_state_json, verification_state, decisions, last_decision_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(session_id) DO UPDATE SET last_seen=excluded.last_seen, profile_id=excluded.profile_id, campaign_id=COALESCE(excluded.campaign_id, traffic_sessions.campaign_id), experiments_json=excluded.experiments_json, routing_state_json=excluded.routing_state_json, verification_state=excluded.verification_state, decisions=traffic_sessions.decisions+1, last_decision_id=excluded.last_decision_id`)
      .bind(sessionId, t, profileId, deviceId, now, now, attrib.landing_page || null, JSON.stringify(firstTouch), decision?.campaign_id || null, JSON.stringify(ctx.profile?.experiments || {}), JSON.stringify({ destination: decision?.destination_id || null, experience: decision?.experience || null, outcome: decision?.outcome || null }), ctx.turnstile?.valid ? 'turnstile' : (ctx.grant?.valid ? 'grant' : 'none'), decision?.decision_id || null));
  }
  for (const [kind, value] of Object.entries(attrib.click_ids || {})) {
    if (!profileId) break;
    const vh = await identifierHash(secret, 'click:' + kind, value);
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO traffic_identifiers (id, tenant_id, profile_id, kind, value_hash, value_masked, match_type, match_method, confidence, source, first_seen, last_seen, active, provenance_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)')
      .bind(newId('idn'), t, profileId, 'click:' + kind, vh, maskIdentifier(kind, value), 'probabilistic', 'query_param', 0.3, 'query', now, now, JSON.stringify({ decision_id: decision?.decision_id || null })));
  }
  if (decision?.experiment?.id && decision.experiment.variant && !decision.experiment.existing) {
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO traffic_assignments (id, tenant_id, experiment_id, unit_key, profile_id, device_id, session_id, variant, assignment_method, assigned_at, decision_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(newId('asg'), t, decision.experiment.id, decision.experiment.unit_key, profileId, deviceId, sessionId, decision.experiment.variant, decision.experiment.reason || null, now, decision.decision_id));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

// ------------------------------------------------------------------ grants

export async function recordGrant(env, { tenant, payload, reason, decision_id }) {
  await env.DB.prepare('INSERT OR IGNORE INTO traffic_grants (jti, tenant_id, audience, destination_id, profile_id, device_id, issued_at, expires_at, one_time, consumed_at, consumed_by, reason, ruleset_revision, decision_id, status) VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?)')
    .bind(payload.jti, tenantOf(tenant), payload.aud, payload.dest, payload.sub, payload.dev, buildNowIso(payload.iat * 1000), buildNowIso(payload.exp * 1000), payload.ot ? 1 : 0, reason || payload.why || '', payload.rev, decision_id || payload.dec || null, 'issued').run();
}

/** One-time consumption: exactly one caller ever sees ok:true for a jti. */
export async function consumeGrant(env, { tenant, payload, consumer }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const row = await env.DB.prepare('SELECT jti, one_time, consumed_at FROM traffic_grants WHERE tenant_id=? AND jti=?').bind(t, payload.jti).first();
  if (!row) {
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO traffic_grants (jti, tenant_id, audience, destination_id, profile_id, device_id, issued_at, expires_at, one_time, consumed_at, consumed_by, reason, ruleset_revision, decision_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(payload.jti, t, payload.aud, payload.dest, payload.sub, payload.dev, buildNowIso(payload.iat * 1000), buildNowIso(payload.exp * 1000), payload.ot ? 1 : 0, now, consumer || 'unknown', payload.why || '', payload.rev, payload.dec || null, 'consumed').run();
    if (ins.meta && ins.meta.changes === 1) return { ok: true, first: true };
    return { ok: false, error: 'replayed' };
  }
  if (!row.one_time) {
    await env.DB.prepare("UPDATE traffic_grants SET consumed_at=COALESCE(consumed_at, ?), consumed_by=COALESCE(consumed_by, ?), status='consumed' WHERE tenant_id=? AND jti=?").bind(now, consumer || 'unknown', t, payload.jti).run();
    return { ok: true, reusable: true };
  }
  const upd = await env.DB.prepare("UPDATE traffic_grants SET consumed_at=?, consumed_by=?, status='consumed' WHERE tenant_id=? AND jti=? AND consumed_at IS NULL").bind(now, consumer || 'unknown', t, payload.jti).run();
  if (upd.meta && upd.meta.changes === 1) return { ok: true, first: true };
  await env.DB.prepare("UPDATE traffic_grants SET error=COALESCE(error,'') || ? WHERE tenant_id=? AND jti=?").bind(`replay@${now};`, t, payload.jti).run();
  return { ok: false, error: 'replayed', consumed_at: row.consumed_at };
}

/** Revoking a device invalidates its unconsumed grants. */
export async function revokeGrantsForDevice(env, { tenant, device_id }) {
  const r = await env.DB.prepare("UPDATE traffic_grants SET status='revoked', error=COALESCE(error,'') || 'device_revoked;' WHERE tenant_id=? AND device_id=? AND consumed_at IS NULL AND status='issued'").bind(tenantOf(tenant), device_id).run();
  return r.meta?.changes ?? 0;
}

// ------------------------------------------------------------------ acknowledgements

export async function recordAck(env, { tenant, policy_key, policy_version, profile_id, device_id, source = 'page', expires_at = null, meta = null }) {
  const id = newId('ack');
  await env.DB.prepare('INSERT INTO traffic_acknowledgements (id, tenant_id, policy_key, policy_version, profile_id, device_id, accepted_at, source, expires_at, meta_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id, tenantOf(tenant), String(policy_key), String(policy_version), profile_id, device_id, buildNowIso(), source, expires_at, js(meta)).run();
  return id;
}

// ------------------------------------------------------------------ configuration writes

function validateActions(actions, ruleset) {
  const out = [];
  const list = j(actions, null);
  if (!Array.isArray(list)) return [{ error: 'actions_must_be_array' }];
  list.forEach((a, i) => {
    if (!a || typeof a !== 'object') { out.push({ at: i, error: 'action_must_be_object' }); return; }
    if (!ACTION_TYPES.includes(a.type)) { out.push({ at: i, error: 'unknown_action:' + a.type, allowed: ACTION_TYPES }); return; }
    if (a.type === 'destination' && !a.id) out.push({ at: i, error: 'destination_action_needs_id' });
    if (a.type === 'experience' && !EXPERIENCES.includes(String(a.value || '').toUpperCase()) && !a.html) out.push({ at: i, error: 'experience_value_unknown', allowed: EXPERIENCES });
    if (a.type === 'outcome' && !OUTCOMES.includes(String(a.value || ''))) out.push({ at: i, error: 'outcome_value_unknown', allowed: OUTCOMES });
    if (a.type === 'require_ack' && (!a.policy || a.version == null)) out.push({ at: i, error: 'require_ack_needs_policy_and_version' });
    if (a.type === 'experiment' && !a.id) out.push({ at: i, error: 'experiment_action_needs_id' });
    if (a.type === 'set' && !a.path) out.push({ at: i, error: 'set_needs_path' });
    if (a.type === 'set' && a.path && !/^custom\./.test(String(a.path))) out.push({ at: i, error: 'set_path_must_start_with_custom.' });
    if (a.type === 'persist' && !a.key) out.push({ at: i, error: 'persist_needs_key' });
    if (a.type === 'grant' && !a.audience && !a.destination) out.push({ at: i, error: 'grant_needs_audience_or_destination' });
    if (a.type === 'score' && !Number.isFinite(Number(a.delta))) out.push({ at: i, error: 'score_needs_numeric_delta' });
    if (a.type === 'membership' && (!MEMBERSHIP_STATUSES.includes(a.status) || !['rule', 'behavior'].includes(a.population || 'rule'))) out.push({ at: i, error: 'membership_needs_status(approved|blocked|review)_and_population(rule|behavior)' });
    if (a.type === 'capability') {
      if (!a.key) out.push({ at: i, error: 'capability_needs_key' });
      const allowed = ruleset ? j(ruleset.allowed_capabilities_json, []) : [];
      if (a.key && ruleset && !allowed.includes(a.key)) out.push({ at: i, error: 'capability_not_allowed_by_ruleset', key: a.key, allowed });
    }
    if (a.type === 'emit' && !a.kind) out.push({ at: i, error: 'emit_needs_kind' });
  });
  return out;
}

function urlHost(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return null; } }

/** Validate a partial row for a config table. Returns { ok, errors, warnings, row }. */
export async function validateRow(env, table, row, { tenant, existing = null } = {}) {
  const errors = [], warnings = [];
  const r = { ...row };
  const t = tenantOf(tenant);
  const exists = async (tbl, id) => !!(await env.DB.prepare(`SELECT id FROM ${tbl} WHERE tenant_id=? AND id=?`).bind(t, id).first());
  if (table === 'traffic_rules') {
    const rsId = r.ruleset_id ?? existing?.ruleset_id;
    if (!rsId) errors.push({ error: 'ruleset_id_required' });
    const rs = rsId ? await env.DB.prepare('SELECT * FROM traffic_rulesets WHERE tenant_id=? AND id=?').bind(t, rsId).first() : null;
    if (rsId && !rs) errors.push({ error: 'ruleset_not_found', ruleset_id: rsId });
    if (r.condition_json !== undefined) {
      const c = j(r.condition_json, undefined);
      if (c === undefined) errors.push({ error: 'condition_json_not_json' });
      else for (const d of validateCondition(c, SIGNAL_PATHS)) (d.error ? errors : warnings).push(d);
      r.condition_json = js(c === undefined ? r.condition_json : c);
    }
    if (r.actions_json !== undefined) { errors.push(...validateActions(r.actions_json, rs)); r.actions_json = js(j(r.actions_json, r.actions_json)); }
    if (r.on_match !== undefined && !['stop', 'continue'].includes(r.on_match)) errors.push({ error: 'on_match_must_be_stop_or_continue' });
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
    if (r.shadow !== undefined) r.shadow = bool01(r.shadow);
    if (r.priority !== undefined) { r.priority = Number(r.priority); if (!Number.isFinite(r.priority)) errors.push({ error: 'priority_must_be_number' }); }
  }
  if (table === 'traffic_rulesets') {
    if (r.state !== undefined && !RULESET_STATES.includes(r.state)) errors.push({ error: 'bad_state', allowed: RULESET_STATES });
    if (r.fail_mode !== undefined && !FAIL_MODES.includes(r.fail_mode)) errors.push({ error: 'bad_fail_mode', allowed: FAIL_MODES });
    if (r.entry_json !== undefined) { const e = j(r.entry_json, null); if (!Array.isArray(e)) errors.push({ error: 'entry_json_must_be_array_of_{host,path,entry}' }); else r.entry_json = JSON.stringify(e); }
    if (r.default_destination && !(await exists('traffic_destinations', r.default_destination))) errors.push({ error: 'default_destination_not_found' });
    if (r.campaign_id && !(await exists('traffic_campaigns', r.campaign_id))) errors.push({ error: 'campaign_not_found' });
    if (r.fail_mode === 'STATIC_PAGE' && !(r.static_html || existing?.static_html)) errors.push({ error: 'STATIC_PAGE_needs_static_html' });
    for (const k of ['capture_query_json', 'allowed_capabilities_json', 'enrichment_json', 'status_precedence_json']) if (r[k] !== undefined && r[k] !== null) { const v = j(r[k], null); if (!Array.isArray(v)) errors.push({ error: k + '_must_be_array' }); else r[k] = JSON.stringify(v); }
    if (r.turnstile_max_age_s !== undefined) r.turnstile_max_age_s = Math.max(30, Number(r.turnstile_max_age_s) || 86400);
    if (r.priority !== undefined) r.priority = Number(r.priority) || 100;
  }
  if (table === 'traffic_destinations') {
    const type = r.type ?? existing?.type ?? 'redirect';
    if (!DESTINATION_TYPES.includes(type)) errors.push({ error: 'bad_type', allowed: DESTINATION_TYPES });
    if (r.health !== undefined && !HEALTH_STATES.includes(r.health)) errors.push({ error: 'bad_health', allowed: HEALTH_STATES });
    const hosts = j(r.allowed_hosts_json ?? existing?.allowed_hosts_json, []);
    if (r.allowed_hosts_json !== undefined) { if (!Array.isArray(hosts)) errors.push({ error: 'allowed_hosts_json_must_be_array' }); else r.allowed_hosts_json = JSON.stringify(hosts.map((h) => String(h).toLowerCase())); }
    const url = r.url ?? existing?.url;
    if (['redirect', 'proxy'].includes(type)) {
      if (!url) errors.push({ error: 'url_required_for_' + type });
      else {
        const host = urlHost(url);
        if (!host || !/^https?:$/.test(new URL(url).protocol)) errors.push({ error: 'url_must_be_absolute_http(s)' });
        else if (!(Array.isArray(hosts) && hosts.map((h) => String(h).toLowerCase()).includes(host))) errors.push({ error: 'url_host_not_in_allowed_hosts_json', host, how_to_fix: 'add the host to allowed_hosts_json — this is the open-redirect guard' });
      }
    }
    if (type === 'group') { const m = j(r.members_json ?? existing?.members_json, null); if (!Array.isArray(m) || !m.length || m.some((x) => !x.id || !(Number(x.weight) >= 0))) errors.push({ error: 'group_needs_members_json_[{id,weight}]' }); else r.members_json = JSON.stringify(m); }
    if (type === 'squeeze' && !(r.campaign_id ?? existing?.campaign_id)) errors.push({ error: 'squeeze_destination_needs_campaign_id' });
    if (r.campaign_id && !(await exists('traffic_campaigns', r.campaign_id))) errors.push({ error: 'campaign_not_found' });
    if (type === 'inline' && !(r.html ?? existing?.html)) warnings.push({ warning: 'inline_destination_without_html_renders_default_page' });
    if (r.fallback_id && r.fallback_id === (r.id || existing?.id)) errors.push({ error: 'fallback_cannot_be_self' });
    if (r.fallback_id && !(await exists('traffic_destinations', r.fallback_id))) errors.push({ error: 'fallback_not_found' });
    if (r.query_passthrough !== undefined && !['all', 'none', 'attribution', 'list'].includes(r.query_passthrough)) errors.push({ error: 'query_passthrough_must_be_all|none|attribution|list' });
    for (const k of ['enabled', 'attribution_passthrough', 'grant_required', 'grant_one_time', 'sticky']) if (r[k] !== undefined) r[k] = bool01(r[k]);
    if (r.grant_ttl_s !== undefined) r.grant_ttl_s = Math.max(5, Math.min(86400, Number(r.grant_ttl_s) || 300));
    if (r.meta_json !== undefined) r.meta_json = js(j(r.meta_json, {}));
  }
  if (table === 'traffic_list_entries') {
    if (r.list !== undefined && !['allow', 'deny'].includes(r.list)) errors.push({ error: 'list_must_be_allow_or_deny' });
    if (r.kind !== undefined && !LIST_KINDS.includes(r.kind)) errors.push({ error: 'bad_kind', allowed: LIST_KINDS });
    if (r.effect !== undefined && !LIST_EFFECTS.includes(r.effect)) errors.push({ error: 'bad_effect', allowed: LIST_EFFECTS });
    if (r.value !== undefined && !String(r.value).trim()) errors.push({ error: 'value_required' });
    if (r.effect_json !== undefined) r.effect_json = js(j(r.effect_json, {}));
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
    if (r.priority !== undefined) r.priority = Number(r.priority) || 100;
    if (!(r.reason ?? existing?.reason)) errors.push({ error: 'reason_required', how_to_fix: 'every allow/deny entry names why it exists' });
  }
  if (table === 'traffic_segments') {
    if (r.condition_json !== undefined) { const c = j(r.condition_json, undefined); if (c === undefined) errors.push({ error: 'condition_json_not_json' }); else { for (const d of validateCondition(c, SIGNAL_PATHS)) (d.error ? errors : warnings).push(d); r.condition_json = JSON.stringify(c); } }
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
    if (r.scope !== undefined && !['request', 'profile', 'both'].includes(r.scope)) errors.push({ error: 'scope_must_be_request|profile|both' });
  }
  if (table === 'traffic_experiments') {
    if (r.variants_json !== undefined) {
      const v = j(r.variants_json, null);
      if (!Array.isArray(v) || v.length < 2 || v.some((x) => !x.key || !(Number(x.weight) >= 0))) errors.push({ error: 'variants_json_needs_2+_[{key,weight,destination_id?|experience?}]' });
      else r.variants_json = JSON.stringify(v);
    }
    if (r.assignment !== undefined && !['deterministic', 'random'].includes(r.assignment)) errors.push({ error: 'assignment_must_be_deterministic_or_random' });
    if (r.unit !== undefined && !['profile', 'device'].includes(r.unit)) errors.push({ error: 'unit_must_be_profile_or_device' });
    if (r.segment_condition_json !== undefined && r.segment_condition_json !== null) { const c = j(r.segment_condition_json, undefined); if (c === undefined) errors.push({ error: 'segment_condition_json_not_json' }); else r.segment_condition_json = JSON.stringify(c); }
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
  }
  if (table === 'traffic_campaigns') {
    for (const k of ['default_destination', 'approved_destination', 'blocked_destination', 'review_destination', 'fallback_destination']) if (r[k] && !(await exists('traffic_destinations', r[k]))) errors.push({ error: k + '_not_found', id: r[k] });
    if (r.ruleset_id && !(await exists('traffic_rulesets', r.ruleset_id))) errors.push({ error: 'ruleset_not_found' });
    for (const k of ['attribution_json', 'access_policy_json', 'experiments_json', 'expected_countries_json', 'goals_json']) if (r[k] !== undefined && r[k] !== null) { const v = j(r[k], undefined); if (v === undefined) errors.push({ error: k + '_not_json' }); else r[k] = JSON.stringify(v); }
    if (r.sms_phone !== undefined && r.sms_phone && !/^\+\d{8,15}$/.test(String(r.sms_phone))) errors.push({ error: 'sms_phone_must_be_e164' });
    if (r.sms_message_template !== undefined && r.sms_message_template && !/\{code\}/i.test(r.sms_message_template)) errors.push({ error: 'sms_message_template_must_contain_{code}' });
    for (const k of ['enabled', 'blocked_capture']) if (r[k] !== undefined) r[k] = bool01(r[k]);
  }
  if (table === 'traffic_squeeze_pages') {
    const cid = r.campaign_id ?? existing?.campaign_id;
    if (!cid) errors.push({ error: 'campaign_id_required' }); else if (!(await exists('traffic_campaigns', cid))) errors.push({ error: 'campaign_not_found' });
    if (r.status !== undefined && !['draft', 'active', 'retired'].includes(r.status)) errors.push({ error: 'status_must_be_draft|active|retired' });
    if (r.media_json !== undefined && r.media_json !== null) { const v = j(r.media_json, undefined); if (!Array.isArray(v)) errors.push({ error: 'media_json_must_be_array_of_{url,alt}' }); else r.media_json = JSON.stringify(v); }
    if (r.weight !== undefined) r.weight = Math.max(0, Number(r.weight) || 0);
    if (r.version !== undefined) r.version = Number(r.version) || 1;
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
    if (r.message_template !== undefined && r.message_template && !/\{code\}/i.test(r.message_template)) errors.push({ error: 'message_template_must_contain_{code}' });
    if (r.phone !== undefined && r.phone && !/^\+\d{8,15}$/.test(String(r.phone))) errors.push({ error: 'phone_must_be_e164' });
    for (const k of ['body_html', 'completion_html', 'fallback_html']) if (r[k] && /<script/i.test(String(r[k]))) errors.push({ error: k + '_may_not_contain_script' });
  }
  if (table === 'traffic_signal_policy') {
    if (!(r.signal ?? existing?.signal)) errors.push({ error: 'signal_required' });
    if (r.effect !== undefined && !SIGNAL_POLICY_EFFECTS.includes(r.effect)) errors.push({ error: 'bad_effect', allowed: SIGNAL_POLICY_EFFECTS });
    if ((r.effect ?? existing?.effect) === 'score' && !Number.isFinite(Number(r.effect_value ?? existing?.effect_value))) errors.push({ error: 'score_effect_needs_numeric_effect_value' });
    if (r.enabled !== undefined) r.enabled = bool01(r.enabled);
  }
  return { ok: errors.length === 0, errors, warnings, row: r };
}

const ID_PREFIX = { traffic_rules: 'rule', traffic_rulesets: 'rs', traffic_destinations: 'dst', traffic_list_entries: 'lst', traffic_segments: 'seg', traffic_experiments: 'exp', traffic_campaigns: 'cmp', traffic_squeeze_pages: 'sqz', traffic_signal_policy: 'pol' };

/** The canonical config write. `patch` is a partial row; `id` null creates. */
export async function writeConfig(env, { table, id = null, patch = {}, tenant, actor = 'owner', reason = '' }) {
  const spec = CONFIG_TABLES[table];
  if (!spec) return { ok: false, errors: [{ error: 'unknown_config_table', allowed: Object.keys(CONFIG_TABLES) }] };
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const existing = id ? await env.DB.prepare(`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`).bind(t, id).first() : null;
  if (id && !existing && patch.__create !== true) return { ok: false, errors: [{ error: 'not_found', table, id }] };
  const clean = {};
  for (const k of spec.fields) if (patch[k] !== undefined) clean[k] = patch[k];
  const unknown = Object.keys(patch).filter((k) => !spec.fields.includes(k) && !['id', '__create', 'tenant_id'].includes(k));
  const v = await validateRow(env, table, clean, { tenant: t, existing });
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings, unknown_fields: unknown };
  if (table === 'traffic_rulesets' && v.row.state && existing && v.row.state !== existing.state) {
    const order = RULESET_STATES.indexOf(existing.state), next = RULESET_STATES.indexOf(v.row.state);
    if (!(next === order + 1 || v.row.state === 'retired' || v.row.state === 'draft')) return { ok: false, errors: [{ error: 'state_transition_not_allowed', from: existing.state, to: v.row.state, allowed: 'draft → test → active → retired (retired and draft are reachable from anywhere)' }] };
    if (v.row.state === 'active') return { ok: false, errors: [{ error: 'activate_via_endpoint', how_to_fix: `POST /api/traffic/rulesets/${id}/activate — activation snapshots a revision` }] };
  }
  let rowId = id;
  if (!existing) {
    rowId = id || patch.id || newId(ID_PREFIX[table] || 'row');
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(String(rowId))) return { ok: false, errors: [{ error: 'bad_id' }] };
    const cols = ['id', 'tenant_id', 'created_at', 'updated_at', ...Object.keys(v.row)];
    const vals = [rowId, t, now, now, ...Object.values(v.row)];
    if ((table === 'traffic_list_entries' || table === 'traffic_rules') && !v.row.created_by) { cols.push('created_by'); vals.push(actor); }
    await env.DB.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...vals).run();
  } else {
    const sets = Object.keys(v.row).map((k) => `${k}=?`);
    const vals = Object.values(v.row);
    if (table === 'traffic_rules') sets.push('revision = revision + 1');
    if (table === 'traffic_squeeze_pages' && Object.keys(v.row).some((k) => ['headline', 'body_html', 'cta_text', 'media_json', 'layout', 'message_template', 'completion_html', 'fallback_html'].includes(k)) && v.row.version === undefined) sets.push('version = version + 1');
    sets.push('updated_at=?'); vals.push(now);
    await env.DB.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE tenant_id=? AND id=?`).bind(...vals, t, rowId).run();
  }
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`).bind(t, rowId).first();
  await invalidateSnapshot(env, t);
  const ledger_event_id = await ledger(env, { key: 'TRAFFIC_CONFIG_WRITE', action: existing ? 'update' : 'create', actor, route: '/api/traffic/' + table.replace('traffic_', ''), trace_id: rowId, request: { table, id: rowId, tenant: t, patch: v.row, reason }, response: { before: existing ? Object.fromEntries(Object.keys(v.row).map((k) => [k, existing[k]])) : null, after: row } });
  return { ok: true, id: rowId, table, tenant: t, created: !existing, row, warnings: v.warnings, unknown_fields: unknown, ledger_event_id };
}

/** Activate a ruleset: bump revision, snapshot the whole effective configuration, ledger it. */
export async function activateRuleset(env, { tenant, id, actor = 'owner', note = '' }) {
  const t = tenantOf(tenant);
  const rs = await env.DB.prepare('SELECT * FROM traffic_rulesets WHERE tenant_id=? AND id=?').bind(t, id).first();
  if (!rs) return { ok: false, errors: [{ error: 'not_found' }] };
  if (rs.state === 'retired') return { ok: false, errors: [{ error: 'retired_ruleset_cannot_activate', how_to_fix: 'set state=draft first' }] };
  const rules = (await env.DB.prepare('SELECT * FROM traffic_rules WHERE tenant_id=? AND ruleset_id=? ORDER BY priority, id').bind(t, id).all()).results || [];
  for (const r of rules) {
    const v = await validateRow(env, 'traffic_rules', { ruleset_id: id, condition_json: r.condition_json, actions_json: r.actions_json }, { tenant: t, existing: r });
    if (!v.ok) return { ok: false, errors: [{ error: 'rule_invalid', rule_id: r.id, defects: v.errors }] };
  }
  if (!rs.default_destination) return { ok: false, errors: [{ error: 'default_destination_required_before_activation' }] };
  const all = async (tbl) => (await env.DB.prepare(`SELECT * FROM ${tbl} WHERE tenant_id=?`).bind(t).all()).results || [];
  const [dests, lists, segs, exps, camps, pol, sqz] = await Promise.all([all('traffic_destinations'), all('traffic_list_entries'), all('traffic_segments'), all('traffic_experiments'), all('traffic_campaigns'), all('traffic_signal_policy'), all('traffic_squeeze_pages')]);
  const revision = Number(rs.revision || 0) + 1;
  const now = buildNowIso();
  const snapshot = { ruleset: { ...rs, revision, state: 'active' }, rules, destinations: dests, lists, segments: segs, experiments: exps, campaigns: camps, signal_policy: pol, squeeze_pages: sqz, activated_at: now, activated_by: actor, note };
  const hash = 'sha256:' + await sha256Hex(JSON.stringify({ ruleset: snapshot.ruleset, rules, destinations: dests, lists, segments: segs, experiments: exps, campaigns: camps, signal_policy: pol }));
  await env.DB.batch([
    env.DB.prepare('INSERT INTO traffic_ruleset_revisions (id, tenant_id, ruleset_id, revision, hash, snapshot_json, activated_at, activated_by, note) VALUES (?,?,?,?,?,?,?,?,?)').bind(`${id}:${revision}`, t, id, revision, hash, JSON.stringify(snapshot), now, actor, note),
    env.DB.prepare("UPDATE traffic_rulesets SET state='active', revision=?, hash=?, activated_at=?, activated_by=?, updated_at=? WHERE tenant_id=? AND id=?").bind(revision, hash, now, actor, now, t, id),
  ]);
  await invalidateSnapshot(env, t);
  const ledger_event_id = await ledger(env, { key: 'TRAFFIC_RULESET_ACTIVATE', action: 'activate', actor, route: `/api/traffic/rulesets/${id}/activate`, trace_id: `${id}:${revision}`, request: { tenant: t, ruleset_id: id, note }, response: { revision, hash, rules: rules.length, destinations: dests.length, lists: lists.length } });
  return { ok: true, id, revision, hash, activated_at: now, ledger_event_id };
}

export async function loadRevision(env, { tenant, ruleset_id, revision }) {
  const row = await env.DB.prepare('SELECT * FROM traffic_ruleset_revisions WHERE tenant_id=? AND ruleset_id=? AND revision=?').bind(tenantOf(tenant), ruleset_id, Number(revision)).first();
  if (!row) return null;
  const snap = j(row.snapshot_json, null);
  if (!snap) return null;
  const destinations = {};
  for (const d of snap.destinations || []) destinations[d.id] = { ...d, allowed_hosts: j(d.allowed_hosts_json, []), members: j(d.members_json, []), meta: j(d.meta_json, {}) };
  const campaigns = {};
  for (const c of snap.campaigns || []) campaigns[c.id] = { ...c, attribution: j(c.attribution_json, null), access_policy: j(c.access_policy_json, {}), expected_countries: j(c.expected_countries_json, []) };
  return {
    tenant: tenantOf(tenant), stamp: row.activated_at, hash: row.hash, revision: row.revision,
    rulesets: [hydrateRuleset({ ...snap.ruleset }, (snap.rules || []).filter((r) => r.enabled))],
    destinations, campaigns,
    lists: (snap.lists || []).filter((l) => l.enabled).map((l) => ({ ...l, effect_obj: j(l.effect_json, {}) })).sort((a, b) => a.priority - b.priority),
    segments: (snap.segments || []).filter((s) => s.enabled).map((s) => ({ ...s, condition: j(s.condition_json, {}) })),
    experiments: (snap.experiments || []).filter((e) => e.enabled).map((e) => ({ ...e, variants: j(e.variants_json, []), segment_condition: j(e.segment_condition_json, null) })),
    signal_policy: (snap.signal_policy || []).filter((p) => p.enabled),
  };
}

// ------------------------------------------------------------------ manual profile operations (all ledgered)

export async function profileOp(env, { tenant, profile_id, op, args = {}, actor = 'owner', reason = '' }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const p = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, profile_id).first();
  if (!p) return { ok: false, errors: [{ error: 'profile_not_found' }] };
  let result = {};
  switch (op) {
    case 'allow':
    case 'deny':
    case 'approve':
    case 'block':
    case 'review': {
      if (!reason) return { ok: false, errors: [{ error: 'reason_required' }] };
      const status = op === 'allow' || op === 'approve' ? 'approved' : op === 'review' ? 'review' : 'blocked';
      const m = await upsertMembership(env, { tenant: t, subject_kind: 'profile', subject_value: profile_id, status, population: 'manual', source: 'owner', provenance: { actor, reason, args }, confidence: 1, actor, reason });
      if (!m.ok) return m;
      if (op === 'allow' || op === 'deny') {
        const w = await writeConfig(env, { table: 'traffic_list_entries', tenant: t, actor, reason, patch: { list: op, kind: 'profile', value: profile_id, reason, effect: args.effect || 'decide', effect_json: js(args.effect_json || (op === 'allow' && args.destination ? { destination: args.destination } : {})), enabled: 1, priority: args.priority ?? 10, provenance: 'manual' } });
        if (!w.ok) return w;
        result = { membership: m, list_entry: w.row };
      } else result = { membership: m };
      break;
    }
    case 'tag':
    case 'untag': {
      const tags = new Set(j(p.tags_json, []));
      for (const tg of (Array.isArray(args.tags) ? args.tags : String(args.tags || args.tag || '').split(',')).map((s) => String(s).trim()).filter(Boolean)) op === 'tag' ? tags.add(tg) : tags.delete(tg);
      await env.DB.prepare('UPDATE traffic_profiles SET tags_json=?, updated_at=?, version=version+1 WHERE tenant_id=? AND id=?').bind(JSON.stringify([...tags]), now, t, profile_id).run();
      result = { tags: [...tags] };
      break;
    }
    case 'trust_device':
    case 'revoke_device': {
      const did = args.device_id;
      if (!did) return { ok: false, errors: [{ error: 'device_id_required' }] };
      const d = await env.DB.prepare('SELECT * FROM traffic_devices WHERE tenant_id=? AND id=? AND profile_id=?').bind(t, did, profile_id).first();
      if (!d) return { ok: false, errors: [{ error: 'device_not_on_profile' }] };
      if (op === 'trust_device') {
        const until = args.days ? buildNowIso(Date.now() + Number(args.days) * 86400 * 1000) : null;
        await env.DB.prepare('UPDATE traffic_devices SET trusted=1, revoked_at=NULL, trusted_at=?, trust_reason=?, trust_expires_at=?, last_verification=? WHERE tenant_id=? AND id=?').bind(now, reason || 'manual', until, now, t, did).run();
        await upsertMembership(env, { tenant: t, subject_kind: 'device', subject_value: did, status: 'approved', population: 'trusted_device', source: 'owner', provenance: { actor, reason }, actor, reason });
        await appendEvent(env, { tenant: t, kind: 'device_trusted', event_type: 'DEVICE_TRUSTED', profile_id, device_id: did, payload: { reason, until } });
      } else {
        await env.DB.batch([
          env.DB.prepare('UPDATE traffic_devices SET trusted=0, revoked_at=?, trust_reason=? WHERE tenant_id=? AND id=?').bind(now, reason || 'manual', t, did),
          env.DB.prepare('UPDATE traffic_acknowledgements SET revoked_at=? WHERE tenant_id=? AND device_id=? AND revoked_at IS NULL').bind(now, t, did),
          env.DB.prepare("UPDATE traffic_memberships SET superseded_at=?, updated_at=? WHERE tenant_id=? AND subject_kind='device' AND subject_value=? AND population='trusted_device' AND superseded_at IS NULL").bind(now, now, t, did),
        ]);
        const revoked = await revokeGrantsForDevice(env, { tenant: t, device_id: did });
        await appendEvent(env, { tenant: t, kind: 'device_revoked', event_type: 'DEVICE_REVOKED', profile_id, device_id: did, payload: { reason, grants_revoked: revoked } });
        result.grants_revoked = revoked;
      }
      result = { ...result, device_id: did, trusted: op === 'trust_device' };
      break;
    }
    case 'clear_experiment': {
      const r = await env.DB.prepare(args.experiment_id ? 'DELETE FROM traffic_assignments WHERE tenant_id=? AND profile_id=? AND experiment_id=?' : 'DELETE FROM traffic_assignments WHERE tenant_id=? AND profile_id=?').bind(...(args.experiment_id ? [t, profile_id, args.experiment_id] : [t, profile_id])).run();
      result = { cleared: r.meta?.changes ?? null };
      break;
    }
    case 'set_attrs': {
      const attrs = Object.assign(j(p.attrs_json, {}), args.attrs || {});
      await env.DB.prepare('UPDATE traffic_profiles SET attrs_json=?, updated_at=?, version=version+1 WHERE tenant_id=? AND id=?').bind(JSON.stringify(attrs), now, t, profile_id).run();
      result = { attrs };
      break;
    }
    case 'set_flags': {
      const sets = [], vals = [];
      for (const k of ['known', 'customer']) if (args[k] !== undefined) { sets.push(`${k}=?`); vals.push(bool01(args[k])); }
      if (args.account_state !== undefined) { sets.push('account_state=?'); vals.push(String(args.account_state)); }
      if (!sets.length) return { ok: false, errors: [{ error: 'nothing_to_set' }] };
      await env.DB.prepare(`UPDATE traffic_profiles SET ${sets.join(',')}, updated_at=?, version=version+1 WHERE tenant_id=? AND id=?`).bind(...vals, now, t, profile_id).run();
      result = { set: args };
      break;
    }
    case 'split': {
      const ids = Array.isArray(args.identifier_ids) ? args.identifier_ids : [];
      const devs = Array.isArray(args.device_ids) ? args.device_ids : [];
      if (!ids.length && !devs.length) return { ok: false, errors: [{ error: 'split_needs_identifier_ids_or_device_ids' }] };
      const fresh = newId('prf');
      const stmts = [env.DB.prepare('INSERT INTO traffic_profiles (id, tenant_id, known, customer, tags_json, attrs_json, visit_count, first_seen, last_seen, created_at, updated_at, merged_from_json, version) VALUES (?,?,0,0,?,?,0,?,?,?,?,?,1)').bind(fresh, t, '[]', JSON.stringify({ split_from: profile_id, reason }), now, now, now, now, '[]')];
      for (const iid of ids) stmts.push(env.DB.prepare('UPDATE traffic_identifiers SET profile_id=? WHERE tenant_id=? AND id=? AND profile_id=?').bind(fresh, t, iid, profile_id));
      for (const did of devs) stmts.push(env.DB.prepare('UPDATE traffic_devices SET profile_id=? WHERE tenant_id=? AND id=? AND profile_id=?').bind(fresh, t, did, profile_id));
      stmts.push(env.DB.prepare('INSERT INTO traffic_merge_log (id, tenant_id, kind, from_profiles_json, into_profile, reason, evidence_json, actor, ts) VALUES (?,?,?,?,?,?,?,?,?)').bind(newId('mrg'), t, 'split', JSON.stringify([profile_id]), fresh, reason || 'manual split', JSON.stringify({ identifier_ids: ids, device_ids: devs }), actor, now));
      await env.DB.batch(stmts);
      const det = await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_identifiers WHERE tenant_id=? AND profile_id=? AND match_type='deterministic'").bind(t, fresh).first();
      if (det && det.n > 0) await env.DB.prepare('UPDATE traffic_profiles SET known=1 WHERE tenant_id=? AND id=?').bind(t, fresh).run();
      await appendEvent(env, { tenant: t, kind: 'profile_split', event_type: 'PROFILE_SPLIT', profile_id: fresh, payload: { from: profile_id, identifier_ids: ids, device_ids: devs, reason } });
      result = { new_profile_id: fresh, moved_identifiers: ids, moved_devices: devs };
      break;
    }
    case 'merge': {
      const into = args.into || profile_id;
      const from = (Array.isArray(args.from) ? args.from : [args.from]).filter((x) => x && x !== into);
      if (!from.length) return { ok: false, errors: [{ error: 'merge_needs_from_profiles' }] };
      const r = await mergeProfiles(env, { tenant: t, into, from, kind: 'manual', reason: reason || 'manual merge', actor, evidence: args.evidence || null });
      result = r;
      break;
    }
    case 'erase': {
      await env.DB.batch([
        env.DB.prepare("UPDATE traffic_profiles SET tags_json='[]', attrs_json='{}', original_attribution_json=NULL, account_state=NULL, snapshot_json=NULL, erased_at=?, updated_at=?, version=version+1 WHERE tenant_id=? AND id=?").bind(now, now, t, profile_id),
        env.DB.prepare('DELETE FROM traffic_identifiers WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
        env.DB.prepare("UPDATE traffic_devices SET meta_json='{}', last_ip_prefix=NULL, last_region=NULL WHERE tenant_id=? AND profile_id=?").bind(t, profile_id),
        env.DB.prepare('UPDATE traffic_decisions SET signals_json=NULL, evaluated_json=NULL WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
        env.DB.prepare('UPDATE traffic_events SET payload_json=NULL, attribution_json=NULL WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
        env.DB.prepare('DELETE FROM traffic_features WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
        env.DB.prepare('DELETE FROM traffic_assignments WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
        env.DB.prepare("UPDATE traffic_memberships SET superseded_at=?, updated_at=? WHERE tenant_id=? AND subject_kind='profile' AND subject_value=? AND superseded_at IS NULL").bind(now, now, t, profile_id),
        env.DB.prepare('UPDATE traffic_sessions SET attribution_json=NULL WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
      ]);
      if (env.KV) { try { await env.KV.delete('traffic:profile:' + t + ':' + profile_id); } catch { /* optional */ } }
      result = { erased: true, retained: 'decision ids, evidence hashes, ledger rows (non-identifying integrity records)' };
      break;
    }
    default: return { ok: false, errors: [{ error: 'unknown_op', allowed: ['allow', 'deny', 'approve', 'block', 'review', 'tag', 'untag', 'trust_device', 'revoke_device', 'clear_experiment', 'set_attrs', 'set_flags', 'split', 'merge', 'erase'] }] };
  }
  const ledger_event_id = await ledger(env, { key: 'TRAFFIC_PROFILE_OP', action: op, actor, route: `/api/traffic/profiles/${profile_id}/${op}`, trace_id: profile_id, request: { tenant: t, profile_id, op, args, reason }, response: result });
  return { ok: true, profile_id, op, ...result, ledger_event_id };
}

/** Merge profiles with lineage: from[] → into. Nothing is deleted; losers point at the winner and the log can explain why. */
export async function mergeProfiles(env, { tenant, into, from, kind = 'deterministic', reason = '', actor = 'system', evidence = null }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const winner = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, into).first();
  if (!winner) return { ok: false, errors: [{ error: 'into_profile_not_found' }] };
  const losers = [];
  for (const id of from) { const r = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, id).first(); if (r && !r.merged_into) losers.push(r); }
  if (!losers.length) return { ok: false, errors: [{ error: 'no_mergeable_from_profiles' }] };
  const tags = new Set(j(winner.tags_json, []));
  let attrs = j(winner.attrs_json, {});
  let visits = Number(winner.visit_count || 0);
  let known = Number(winner.known || 0), customer = Number(winner.customer || 0);
  for (const r of losers) { for (const tg of j(r.tags_json, [])) tags.add(tg); attrs = Object.assign(j(r.attrs_json, {}), attrs); visits += Number(r.visit_count || 0); known = Math.max(known, Number(r.known || 0)); customer = Math.max(customer, Number(r.customer || 0)); }
  const mergeId = newId('mrg');
  const stmts = [
    env.DB.prepare('UPDATE traffic_profiles SET tags_json=?, attrs_json=?, visit_count=?, known=?, customer=?, merged_from_json=?, original_attribution_json=COALESCE(original_attribution_json, ?), first_seen=MIN(COALESCE(first_seen, ?), ?), updated_at=?, version=version+1 WHERE tenant_id=? AND id=?')
      .bind(JSON.stringify([...tags]), JSON.stringify(attrs), visits, known, customer, JSON.stringify([...new Set([...j(winner.merged_from_json, []), ...losers.map((l) => l.id)])]), losers.map((l) => l.original_attribution_json).find(Boolean) || null, now, losers.map((l) => l.first_seen).filter(Boolean).sort()[0] || now, now, t, into),
    env.DB.prepare('INSERT INTO traffic_merge_log (id, tenant_id, kind, from_profiles_json, into_profile, reason, evidence_json, actor, ts, undo_json) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(mergeId, t, kind, JSON.stringify(losers.map((l) => l.id)), into, reason, js(evidence), actor, now, JSON.stringify({ losers: losers.map((l) => ({ id: l.id, tags_json: l.tags_json, attrs_json: l.attrs_json, visit_count: l.visit_count, known: l.known, customer: l.customer })) })),
  ];
  for (const l of losers) {
    stmts.push(env.DB.prepare('UPDATE traffic_profiles SET merged_into=?, updated_at=? WHERE tenant_id=? AND id=?').bind(into, now, t, l.id));
    for (const tbl of ['traffic_identifiers', 'traffic_devices', 'traffic_assignments', 'traffic_acknowledgements', 'traffic_sessions', 'traffic_events', 'traffic_features']) stmts.push(env.DB.prepare(`UPDATE ${tbl} SET profile_id=? WHERE tenant_id=? AND profile_id=?`).bind(into, t, l.id));
    stmts.push(env.DB.prepare("UPDATE traffic_memberships SET subject_value=?, updated_at=? WHERE tenant_id=? AND subject_kind='profile' AND subject_value=?").bind(into, now, t, l.id));
  }
  await env.DB.batch(stmts);
  await appendEvent(env, { tenant: t, kind: 'profile_merged', event_type: 'PROFILE_MERGED', profile_id: into, payload: { merge_id: mergeId, from: losers.map((l) => l.id), kind, reason }, provenance: evidence });
  await ledger(env, { key: 'TRAFFIC_PROFILE_MERGE', action: kind, actor, route: '/api/traffic/profiles/merge', trace_id: mergeId, request: { tenant: t, into, from: losers.map((l) => l.id), reason }, response: { merge_id: mergeId, evidence } });
  return { ok: true, merge_id: mergeId, into, merged: losers.map((l) => l.id), kind, reason };
}

// ------------------------------------------------------------------ identity linking (the resolver)

/**
 * Join identifiers to a profile. `identifiers`: [{kind, value, match_type?, match_method?, confidence?, source_ref?}].
 * Deterministic kinds join (and merge, with lineage) profiles; probabilistic ones are only recorded.
 * `plaintext:true` on an identifier stores the plaintext under value_secure (operational need, owner-authorized reads only).
 */
export async function linkIdentifiers(env, { tenant, identifiers = [], device_id = null, profile_id = null, source = 'api', secret, actor = 'api', merge_policy = 'deterministic' }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const hashed = [];
  for (const i of identifiers) {
    if (!i || !i.kind || i.value == null || String(i.value).trim() === '') continue;
    const kind = String(i.kind).toLowerCase().replace(/[^a-z0-9_:.-]/g, '_').slice(0, 40);
    const match_type = ['deterministic', 'first_party', 'probabilistic'].includes(i.match_type) ? i.match_type : (/^click:|fingerprint|ua_hash|resemblance/.test(kind) ? 'probabilistic' : 'deterministic');
    hashed.push({ kind, hash: await identifierHash(secret, kind, i.value), masked: maskIdentifier(kind, i.value), match_type, match_method: i.match_method || (match_type === 'deterministic' ? 'exact_normalized' : 'observed'), confidence: i.confidence != null ? Number(i.confidence) : (match_type === 'deterministic' ? 1 : 0.5), plaintext: i.plaintext ? String(i.value).trim() : null, source_ref: i.source_ref || null });
  }
  if (!hashed.length && !device_id && !profile_id) return { ok: false, errors: [{ error: 'nothing_to_link' }] };
  const candidates = new Set();
  if (profile_id) candidates.add(profile_id);
  let dev = null;
  if (device_id) { dev = await env.DB.prepare('SELECT * FROM traffic_devices WHERE tenant_id=? AND id=?').bind(t, device_id).first(); if (dev?.profile_id) candidates.add(dev.profile_id); }
  const found = [];
  for (const h of hashed.filter((x) => x.match_type === 'deterministic')) {
    const row = await env.DB.prepare('SELECT profile_id FROM traffic_identifiers WHERE tenant_id=? AND kind=? AND value_hash=? AND active=1').bind(t, h.kind, h.hash).first();
    if (row?.profile_id) { candidates.add(row.profile_id); found.push({ kind: h.kind, profile_id: row.profile_id }); }
  }
  const resolved = new Set();
  for (const c of candidates) {
    let p = await env.DB.prepare('SELECT id, merged_into FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, c).first();
    let hops = 0;
    while (p && p.merged_into && hops < 5) { p = await env.DB.prepare('SELECT id, merged_into FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, p.merged_into).first(); hops++; }
    if (p) resolved.add(p.id);
  }
  let canonical = null, merged = [], proposed = [];
  const stmts = [];
  if (resolved.size === 0) {
    canonical = newId('prf');
    stmts.push(env.DB.prepare('INSERT INTO traffic_profiles (id, tenant_id, known, customer, tags_json, attrs_json, visit_count, first_seen, last_seen, created_at, updated_at, version) VALUES (?,?,0,0,?,?,0,?,?,?,?,1)').bind(canonical, t, '[]', '{}', now, now, now, now));
  } else {
    const rows = [];
    for (const id of resolved) rows.push(await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, id).first());
    rows.sort((a, b) => String(a.first_seen || a.created_at).localeCompare(String(b.first_seen || b.created_at)));
    canonical = rows[0].id;
    const others = rows.slice(1).map((r) => r.id);
    if (others.length) {
      if (merge_policy === 'deterministic' && hashed.some((h) => h.match_type === 'deterministic')) {
        await env.DB.batch(stmts.splice(0));
        const m = await mergeProfiles(env, { tenant: t, into: canonical, from: others, kind: 'deterministic', reason: `shared deterministic identifier (${hashed.filter((h) => h.match_type === 'deterministic').map((h) => h.kind).join(',')}) via ${source}`, actor, evidence: { found, device_id: !!device_id } });
        if (m.ok) merged = m.merged;
      } else {
        for (const o of others) { const pid = newId('mp'); stmts.push(env.DB.prepare("INSERT INTO traffic_merge_proposals (id, tenant_id, profile_a, profile_b, basis, confidence, status, created_at) VALUES (?,?,?,?,?,?,'proposed',?)").bind(pid, t, canonical, o, `shared ${hashed.map((h) => h.kind).join(',')} via ${source} (policy ${merge_policy})`, 0.6, now)); proposed.push(o); }
      }
    }
  }
  let known = 0, customer = 0;
  for (const h of hashed) {
    stmts.push(env.DB.prepare('INSERT INTO traffic_identifiers (id, tenant_id, profile_id, kind, value_hash, value_masked, value_secure, match_type, match_method, confidence, source, source_ref, first_seen, last_seen, active, provenance_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(tenant_id, kind, value_hash) DO UPDATE SET profile_id=excluded.profile_id, last_seen=excluded.last_seen, confidence=MAX(traffic_identifiers.confidence, excluded.confidence), value_secure=COALESCE(excluded.value_secure, traffic_identifiers.value_secure), active=1')
      .bind(newId('idn'), t, canonical, h.kind, h.hash, h.masked, h.plaintext, h.match_type, h.match_method, h.confidence, source, h.source_ref, now, now, JSON.stringify({ actor, source, at: now })));
    if (h.match_type === 'deterministic') known = 1;
    if (h.match_type === 'deterministic' && /stripe|bigcommerce|klaviyo|crm|customer|account|login|order|tenant_person/.test(h.kind)) customer = 1;
  }
  if (known || customer) stmts.push(env.DB.prepare('UPDATE traffic_profiles SET known = MAX(known, ?), customer = MAX(customer, ?), updated_at=?, version=version+1 WHERE tenant_id=? AND id=?').bind(known, customer, now, t, canonical));
  if (device_id) {
    if (dev) stmts.push(env.DB.prepare('UPDATE traffic_devices SET profile_id=?, last_seen=? WHERE tenant_id=? AND id=?').bind(canonical, now, t, device_id));
    else stmts.push(env.DB.prepare('INSERT OR IGNORE INTO traffic_devices (id, tenant_id, profile_id, trusted, first_seen, last_seen, visit_count, meta_json) VALUES (?,?,?,0,?,?,0,?)').bind(device_id, t, canonical, now, now, '{}'));
    stmts.push(env.DB.prepare('INSERT INTO traffic_identifiers (id, tenant_id, profile_id, kind, value_hash, value_masked, match_type, match_method, confidence, source, first_seen, last_seen, active, provenance_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(tenant_id, kind, value_hash) DO UPDATE SET profile_id=excluded.profile_id, last_seen=excluded.last_seen, active=1')
      .bind(newId('idn'), t, canonical, 'device', await identifierHash(secret, 'device', device_id), maskIdentifier('device', device_id), 'first_party', 'engine_cookie', 0.9, 'cookie', now, now, JSON.stringify({ actor, source, at: now })));
  }
  if (stmts.length) await env.DB.batch(stmts);
  if (known) await appendEvent(env, { tenant: t, kind: 'customer_identified', event_type: 'CUSTOMER_IDENTIFIED', profile_id: canonical, device_id, source, payload: { kinds: hashed.map((h) => h.kind), merged, proposed } });
  await ledger(env, { key: 'TRAFFIC_IDENTITY_LINK', action: merged.length ? 'merge' : 'link', actor, route: '/api/traffic/profiles/link', trace_id: canonical, request: { tenant: t, kinds: hashed.map((h) => h.kind + ':' + h.match_type), device_id: !!device_id, source }, response: { profile_id: canonical, merged, proposed, found } });
  return { ok: true, profile_id: canonical, merged, proposed, joined: hashed.map((h) => ({ kind: h.kind, match_type: h.match_type, masked: h.masked })), found };
}

// ------------------------------------------------------------------ profile reads

export async function profileView(env, { tenant, profile_id }) {
  const t = tenantOf(tenant);
  const p = await env.DB.prepare('SELECT * FROM traffic_profiles WHERE tenant_id=? AND id=?').bind(t, profile_id).first();
  if (!p) return null;
  const [ids, devs, lists, acks, asg, decs, evs, mems, feats, sess, merges] = await env.DB.batch([
    env.DB.prepare('SELECT id, kind, value_masked, match_type, match_method, confidence, source, source_ref, first_seen, last_seen, active, revoked_at, provenance_json FROM traffic_identifiers WHERE tenant_id=? AND profile_id=? ORDER BY first_seen').bind(t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_devices WHERE tenant_id=? AND profile_id=? ORDER BY last_seen DESC').bind(t, profile_id),
    env.DB.prepare("SELECT * FROM traffic_list_entries WHERE tenant_id=? AND ((kind='profile' AND value=?) OR (kind='device' AND value IN (SELECT id FROM traffic_devices WHERE tenant_id=? AND profile_id=?)))").bind(t, profile_id, t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_acknowledgements WHERE tenant_id=? AND profile_id=? ORDER BY accepted_at DESC LIMIT 50').bind(t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_assignments WHERE tenant_id=? AND profile_id=?').bind(t, profile_id),
    env.DB.prepare('SELECT decision_id, ts, mode, entry, campaign_id, destination_id, experience, outcome, fallback_used, reason, latency_ms, matched_rules_json, ruleset_id, ruleset_revision, profile_snapshot_version FROM traffic_decisions WHERE tenant_id=? AND profile_id=? ORDER BY ts DESC LIMIT 50').bind(t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_events WHERE tenant_id=? AND profile_id=? ORDER BY ts DESC LIMIT 100').bind(t, profile_id),
    env.DB.prepare("SELECT * FROM traffic_memberships WHERE tenant_id=? AND ((subject_kind='profile' AND subject_value=?) OR (subject_kind='device' AND subject_value IN (SELECT id FROM traffic_devices WHERE tenant_id=? AND profile_id=?))) ORDER BY created_at DESC").bind(t, profile_id, t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_features WHERE tenant_id=? AND profile_id=? ORDER BY feature').bind(t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_sessions WHERE tenant_id=? AND profile_id=? ORDER BY last_seen DESC LIMIT 20').bind(t, profile_id),
    env.DB.prepare('SELECT * FROM traffic_merge_log WHERE tenant_id=? AND (into_profile=? OR from_profiles_json LIKE ?) ORDER BY ts DESC').bind(t, profile_id, '%"' + profile_id + '"%'),
  ]);
  const decisions = (decs.results || []).map((d) => ({ ...d, matched_rules: j(d.matched_rules_json, []), matched_rules_json: undefined, why: `/api/traffic/decisions/${d.decision_id}` }));
  const destHistory = {};
  for (const d of decisions) if (d.destination_id) destHistory[d.destination_id] = (destHistory[d.destination_id] || 0) + 1;
  const memberships = mems.results || [];
  return {
    profile: { ...p, tags: j(p.tags_json, []), attrs: j(p.attrs_json, {}), snapshot: j(p.snapshot_json, null), original_attribution: j(p.original_attribution_json, null), merged_from: j(p.merged_from_json, []) },
    status: effectiveStatus(memberships.filter((m) => !m.superseded_at)),
    identifiers: (ids.results || []).map((i) => ({ ...i, provenance: j(i.provenance_json, null), provenance_json: undefined, join_reason: i.match_type === 'deterministic' ? `deterministic ${i.kind} (${i.match_method}) supplied by ${i.source}` : i.match_type === 'first_party' ? `first-party id issued by this engine (${i.source})` : `probabilistic (${i.kind}, confidence ${i.confidence}) — recorded, never used to join` })),
    devices: (devs.results || []).map((d) => ({ ...d, meta: j(d.meta_json, {}), meta_json: undefined })),
    sessions: (sess.results || []).map((s) => ({ ...s, attribution: j(s.attribution_json, null), experiments: j(s.experiments_json, null), routing_state: j(s.routing_state_json, null), attribution_json: undefined, experiments_json: undefined, routing_state_json: undefined })),
    list_memberships: lists.results || [],
    memberships: memberships.map((m) => ({ ...m, provenance: j(m.provenance_json, null), evidence: j(m.evidence_json, []), provenance_json: undefined, evidence_json: undefined })),
    acknowledgements: acks.results || [],
    experiments: asg.results || [],
    decisions,
    destination_history: destHistory,
    events: (evs.results || []).map((e) => ({ ...e, payload: j(e.payload_json, null), attribution: j(e.attribution_json, null), provenance: j(e.provenance_json, null), payload_json: undefined, attribution_json: undefined, provenance_json: undefined })),
    features: (feats.results || []).map((f) => ({ ...f, provenance: j(f.provenance_json, null), source_refs: j(f.source_refs_json, null), provenance_json: undefined, source_refs_json: undefined })),
    merge_log: (merges.results || []).map((m) => ({ ...m, from_profiles: j(m.from_profiles_json, []), evidence: j(m.evidence_json, null), from_profiles_json: undefined, evidence_json: undefined, undo_json: undefined })),
    customer_links: (ids.results || []).filter((i) => /stripe|bigcommerce|klaviyo|crm|customer|login|account|tenant_person|phone|email/.test(i.kind)).map((i) => ({ kind: i.kind, masked: i.value_masked, source: i.source, source_ref: i.source_ref })),
    operations: ['approve', 'block', 'review', 'allow', 'deny', 'tag', 'untag', 'trust_device', 'revoke_device', 'clear_experiment', 'set_attrs', 'set_flags', 'split', 'merge', 'erase'].map((op) => ({ op, href: `/api/traffic/profiles/${profile_id}/${op}`, method: 'POST' })),
  };
}

export async function getDecision(env, { tenant, decision_id }) {
  const d = await env.DB.prepare('SELECT * FROM traffic_decisions WHERE tenant_id=? AND decision_id=?').bind(tenantOf(tenant), decision_id).first();
  if (!d) return null;
  return { ...d, signals: j(d.signals_json, null), evaluated: j(d.evaluated_json, null), matched_rules: j(d.matched_rules_json, []), list_matches: j(d.list_matches_json, []), turnstile: j(d.turnstile_json, null), experiment: j(d.experiment_json, null), shadow: j(d.shadow_json, null), signals_json: undefined, evaluated_json: undefined, matched_rules_json: undefined, list_matches_json: undefined, turnstile_json: undefined, experiment_json: undefined, shadow_json: undefined };
}

// ------------------------------------------------------------------ analytics

export async function metrics(env, { tenant, since_hours = 24, ruleset_id = null, campaign_id = null }) {
  const t = tenantOf(tenant);
  const since = buildNowIso(Date.now() - Number(since_hours || 24) * 3600 * 1000);
  const extra = (ruleset_id ? ' AND ruleset_id=?' : '') + (campaign_id ? ' AND campaign_id=?' : '');
  const where = "tenant_id=? AND ts>=? AND mode IN ('live','test')" + extra;
  const b = [t, since].concat(ruleset_id ? [ruleset_id] : []).concat(campaign_id ? [campaign_id] : []);
  const [tot, dest, exp, rules, lat, ev, outcomes] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) n, COUNT(DISTINCT profile_id) profiles, COUNT(DISTINCT session_id) sessions, COUNT(DISTINCT device_id) devices, SUM(fallback_used) fallbacks, SUM(CASE WHEN experience='DENY' THEN 1 ELSE 0 END) denies, SUM(CASE WHEN experience='VERIFY' THEN 1 ELSE 0 END) challenges, SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) errors, SUM(CASE WHEN profile_id IS NOT NULL THEN 1 ELSE 0 END) resolved, SUM(CASE WHEN json_extract(signals_json,'$.device.known')=1 THEN 1 ELSE 0 END) known_devices, SUM(CASE WHEN json_extract(signals_json,'$.device.trusted')=1 THEN 1 ELSE 0 END) trusted_devices, SUM(CASE WHEN json_extract(signals_json,'$.profile.known')=1 THEN 1 ELSE 0 END) known_profiles, SUM(CASE WHEN grant_jti IS NOT NULL THEN 1 ELSE 0 END) grants FROM traffic_decisions WHERE ${where}`).bind(...b),
    env.DB.prepare(`SELECT COALESCE(destination_id, experience, 'none') k, COUNT(*) n FROM traffic_decisions WHERE ${where} GROUP BY k ORDER BY n DESC`).bind(...b),
    env.DB.prepare(`SELECT json_extract(experiment_json,'$.id') id, json_extract(experiment_json,'$.variant') variant, COUNT(*) n FROM traffic_decisions WHERE ${where} AND experiment_json IS NOT NULL GROUP BY id, variant`).bind(...b),
    env.DB.prepare(`SELECT je.value rule_id, COUNT(*) n, SUM(CASE WHEN d.experience='DENY' THEN 1 ELSE 0 END) blocks, SUM(CASE WHEN d.outcome='approved' OR (d.experience IS NULL AND d.destination_id IS NOT NULL) THEN 1 ELSE 0 END) approvals FROM traffic_decisions d, json_each(d.matched_rules_json) je WHERE d.${where.replace(/ AND /g, ' AND d.')} GROUP BY je.value ORDER BY n DESC LIMIT 50`).bind(...b),
    env.DB.prepare(`SELECT latency_ms FROM traffic_decisions WHERE ${where} AND latency_ms IS NOT NULL ORDER BY ts DESC LIMIT 2000`).bind(...b),
    env.DB.prepare(`SELECT kind, COUNT(*) n FROM traffic_events WHERE tenant_id=? AND ts>=?${campaign_id ? ' AND campaign_id=?' : ''} GROUP BY kind`).bind(...[t, since].concat(campaign_id ? [campaign_id] : [])),
    env.DB.prepare(`SELECT COALESCE(outcome,'none') outcome, COUNT(*) n FROM traffic_decisions WHERE ${where} GROUP BY outcome`).bind(...b),
  ]);
  const lats = (lat.results || []).map((r) => Number(r.latency_ms)).filter(Number.isFinite).sort((a, b2) => a - b2);
  const pct = (p) => (lats.length ? lats[Math.min(lats.length - 1, Math.floor(p * lats.length))] : null);
  const total = tot.results?.[0] || {};
  const evMap = {}; for (const e of ev.results || []) evMap[e.kind] = e.n;
  const n = Number(total.n || 0);
  const outcomeMap = {}; for (const o of outcomes.results || []) outcomeMap[o.outcome] = o.n;
  return {
    tenant: t, since, ruleset_id, campaign_id,
    requests: n, unique_profiles: total.profiles || 0, unique_sessions: total.sessions || 0, unique_devices: total.devices || 0,
    approved: outcomeMap.approved || 0, blocked: (outcomeMap.blocked || 0), unknown: outcomeMap.unknown || 0, review: outcomeMap.review || 0, challenged: total.challenges || 0, verification_attempts: (evMap.turnstile_pass || 0) + (evMap.turnstile_fail || 0) + (evMap.sms_inbound || 0),
    destination_distribution: dest.results || [], rule_match_distribution: rules.results || [], experiment_exposure: exp.results || [],
    turnstile: { challenged: total.challenges || 0, passed: evMap.turnstile_pass || 0, failed: evMap.turnstile_fail || 0 },
    funnel: { squeeze_impressions: evMap.squeeze_view || 0, cta: evMap.cta_tap || 0, sms_composer_open: evMap.sms_open || 0, sms_inbound: evMap.sms_inbound || 0, verified: evMap.verified || 0, approved_progression: evMap.progressed || 0, blocked_completion: evMap.blocked_completion || 0, review_hold: evMap.review_hold || 0, downstream_conversion: (evMap.conversion || 0) + (evMap.order_created || 0) },
    fallback_rate: n ? Number(total.fallbacks || 0) / n : 0, deny_rate: n ? Number(total.denies || 0) / n : 0, error_count: total.errors || 0,
    identity: { profile_resolution_rate: n ? Number(total.resolved || 0) / n : 0, known_profile_rate: n ? Number(total.known_profiles || 0) / n : 0, known_device_rate: n ? Number(total.known_devices || 0) / n : 0, trusted_device_rate: n ? Number(total.trusted_devices || 0) / n : 0 },
    grants_issued: total.grants || 0, grants_consumed: evMap.grant_consumed || 0, grants_replayed: evMap.grant_replayed || 0,
    conversions: (evMap.conversion || 0) + (evMap.outcome || 0), acknowledgements: evMap.ack || 0,
    policy: { manual_overrides: evMap.manual_override || 0 },
    latency_ms: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), samples: lats.length },
    events_by_kind: ev.results || [],
    derived_from: 'traffic_decisions + traffic_events (no separate analytics store)',
  };
}

export async function runRetention(env, { tenant, days = null, actor = 'automation' }) {
  const t = tenantOf(tenant);
  let d = Number(days);
  if (!Number.isFinite(d) || d <= 0) {
    const s = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('TRAFFIC_RETENTION_DAYS').first().catch(() => null);
    d = Number(s?.value) || 90;
  }
  const cutoff = buildNowIso(Date.now() - d * 86400 * 1000);
  const [a, b, c, e] = await env.DB.batch([
    env.DB.prepare('DELETE FROM traffic_decisions WHERE tenant_id=? AND ts < ?').bind(t, cutoff),
    env.DB.prepare("DELETE FROM traffic_events WHERE tenant_id=? AND ts < ? AND source='engine' AND event_type IN ('PAGE_VIEW','ROUTING_DECISION','TURNSTILE_CHALLENGE')").bind(t, cutoff),
    env.DB.prepare("DELETE FROM traffic_grants WHERE tenant_id=? AND expires_at < ? AND status IN ('consumed','issued','revoked')").bind(t, cutoff),
    env.DB.prepare("DELETE FROM traffic_codes WHERE tenant_id=? AND issued_at < ? AND status IN ('issued','expired')").bind(t, cutoff),
  ]);
  const out = { tenant: t, retention_days: d, cutoff, deleted: { decisions: a.meta?.changes ?? null, engine_events: b.meta?.changes ?? null, grants: c.meta?.changes ?? null, codes: e.meta?.changes ?? null }, retained: 'commerce/messaging/identity events (facts), memberships, history, merge log' };
  await ledger(env, { key: 'TRAFFIC_RETENTION', action: 'run', actor, route: '/api/traffic/retention/run', request: { tenant: t, days: d }, response: out });
  return out;
}
