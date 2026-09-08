// GROWTH — the store for the canonical growth graph (migrations 0383–0386).
// Raw payloads live once (raw_snapshots; R2 above the existing 10 KB cutoff). Metrics are append-only
// observations; canonical ratios are DERIVED here from primitives. Experience versions are immutable;
// many may be active; weights live in allocation policy versions. The bridge joins ad clicks already
// captured on traffic_decisions to deployments, profiles and experience versions. Rules produce
// proposals only — nothing here calls a provider to mutate anything.

import { buildNowIso } from '../build_time.js';
import { logEvent } from '../event_log.js';

const R2_CUTOFF = 10240;
export const tenantOf = (env) => env?.TRACE_CTX?.authContext?.tenant_id || 't_root';
export function newId(p) { try { return p + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch { return p + '_' + Math.random().toString(36).slice(2, 14); } }
export async function sha256(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const js = (v) => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

// ------------------------------------------------------------------ raw snapshots (stored once)
export async function snapshot(env, t, { provider_id, sync_run_id = null, subject_type = null, subject_external_id = null, body }) {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = await sha256(str);
  const existing = await env.DB.prepare('SELECT id FROM raw_snapshots WHERE tenant_id=? AND provider_id=? AND body_hash=?').bind(t, provider_id, hash).first();
  if (existing) return { id: existing.id, deduped: true };
  const id = newId('raw'); const now = buildNowIso(); const bytes = new TextEncoder().encode(str).length;
  let inline = str, r2 = null;
  if (bytes > R2_CUTOFF && env.R2) { r2 = `growth/raw/${provider_id}/${id}.json`; try { await env.R2.put(r2, str); inline = null; } catch { r2 = null; } }
  await env.DB.prepare('INSERT INTO raw_snapshots (id, tenant_id, provider_id, sync_run_id, subject_type, subject_external_id, captured_at, body_preview, body_inline, r2_key, body_hash, bytes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, provider_id, sync_run_id, subject_type, subject_external_id, now, str.slice(0, 300), inline, r2, hash, bytes).run();
  return { id, deduped: false, bytes, r2 };
}

// ------------------------------------------------------------------ evidence + sync runs
export async function evidence(env, t, { evidence_class, source, sync_run_id = null, raw_snapshot_id = null, request = null, normalizer_version = 'growth/1', derived = null, interpretation = null, confidence = null, actor = 'owner' }) {
  const id = newId('evd');
  await env.DB.prepare('INSERT INTO evidence_records (id, tenant_id, ts, evidence_class, source, sync_run_id, raw_snapshot_id, request_json, normalizer_version, derived_json, interpretation, confidence, actor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, buildNowIso(), evidence_class, source, sync_run_id, raw_snapshot_id, js(request), normalizer_version, js(derived), interpretation, confidence, actor).run();
  return id;
}
export async function startSync(env, t, { provider_id, connection_id = null, kind, window_start = '', window_end = '', actor = 'owner' }) {
  const key = [provider_id, connection_id || '', kind, window_start, window_end].join('|');
  const prior = await env.DB.prepare("SELECT id FROM sync_runs WHERE tenant_id=? AND idempotency_key=? AND state IN ('ok','partial')").bind(t, key).first();
  const id = newId('syn');
  await env.DB.prepare('INSERT INTO sync_runs (id, tenant_id, provider_id, connection_id, kind, window_start, window_end, idempotency_key, started_at, state, actor) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, provider_id, connection_id, kind, window_start, window_end, key, buildNowIso(), prior ? 'replayed' : 'running', actor).run();
  return { id, replay_of: prior?.id || null };
}
export async function finishSync(env, t, id, { state, counts = null, errors = null, evidence_id = null, invocation_ids = [] }) {
  await env.DB.prepare("UPDATE sync_runs SET finished_at=?, state=CASE WHEN state='replayed' THEN 'replayed' ELSE ? END, counts_json=?, errors_json=?, evidence_id=?, invocation_ids_json=? WHERE tenant_id=? AND id=?")
    .bind(buildNowIso(), state, js(counts), js(errors), evidence_id, JSON.stringify(invocation_ids), t, id).run();
}

// ------------------------------------------------------------------ canonical entity upsert (unique on tenant+provider+external_id)
const PREFIX = { media_accounts: 'mac', media_initiatives: 'min', media_groups: 'mgr', media_deployments: 'mdp', creatives: 'crv' };
export async function upsertEntity(env, t, table, fields) {
  const now = buildNowIso();
  const keyCols = table === 'creatives' ? null : ['provider_id', 'external_id'];
  let existing = null;
  if (keyCols) existing = await env.DB.prepare(`SELECT id FROM ${table} WHERE tenant_id=? AND provider_id=? AND external_id=?`).bind(t, fields.provider_id, String(fields.external_id)).first();
  else if (fields.asset_hash) existing = await env.DB.prepare('SELECT id FROM creatives WHERE tenant_id=? AND asset_hash=?').bind(t, fields.asset_hash).first();
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const vals = cols.map((k) => (fields[k] !== null && typeof fields[k] === 'object') ? JSON.stringify(fields[k]) : fields[k]);
  if (existing) {
    await env.DB.prepare(`UPDATE ${table} SET ${cols.map((k) => k + '=?').join(', ')}, ${table === 'creatives' ? '' : 'synced_at=?, '}updated_at=? WHERE tenant_id=? AND id=?`).bind(...vals, ...(table === 'creatives' ? [now] : [now, now]), t, existing.id).run();
    return { id: existing.id, created: false };
  }
  const id = newId(PREFIX[table] || 'row');
  const all = ['id', 'tenant_id', ...cols, ...(table === 'creatives' ? [] : ['synced_at']), 'created_at', 'updated_at'];
  await env.DB.prepare(`INSERT INTO ${table} (${all.join(',')}) VALUES (${all.map(() => '?').join(',')})`).bind(id, t, ...vals, ...(table === 'creatives' ? [] : [now]), now, now).run();
  return { id, created: true };
}

// ------------------------------------------------------------------ observations (append-only, unique per subject/metric/interval/dims/source)
export async function observe(env, t, o) {
  const dimsHash = o.dimensions && Object.keys(o.dimensions).length ? (await sha256(JSON.stringify(o.dimensions))).slice(0, 16) : 'none';
  const r = await env.DB.prepare(`INSERT OR IGNORE INTO metric_observations (id, tenant_id, subject_type, subject_id, metric, value, state, interval_start, interval_end, dimensions_json, dimensions_hash, currency, timezone, source, evidence_class, observed_at, evidence_id, sync_run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(newId('mo'), t, o.subject_type, o.subject_id, o.metric, o.value ?? null, o.state || (o.value == null ? 'not_collected' : 'observed'), o.interval_start, o.interval_end, JSON.stringify(o.dimensions || {}), dimsHash, o.currency || null, o.timezone || null, o.source, o.evidence_class || 'provider_reported', buildNowIso(), o.evidence_id || null, o.sync_run_id || null).run();
  return !!(r.meta && r.meta.changes);
}
export const PRIMITIVES = ['spend', 'impressions', 'reach', 'frequency', 'clicks', 'landing_page_views', 'conversions', 'purchases', 'leads', 'revenue', 'refunds', 'orders'];

/** Canonical ratios derived from primitives over a window. Never stored. */
export async function derived(env, t, { subject_type, subject_id, since, until, dimensions_hash = 'none' }) {
  const rows = (await env.DB.prepare("SELECT metric, SUM(value) v, COUNT(*) n, MIN(state) st FROM metric_observations WHERE tenant_id=? AND subject_type=? AND subject_id=? AND dimensions_hash=? AND interval_start>=? AND interval_end<=? AND state='observed' GROUP BY metric").bind(t, subject_type, subject_id, dimensions_hash, since, until).all()).results || [];
  const m = {}; for (const r of rows) m[r.metric] = Number(r.v);
  const has = (k) => m[k] != null;
  const out = { subject_type, subject_id, since, until, primitives: m, derived: {} };
  if (has('impressions') && has('clicks')) out.derived.ctr_pct = m.impressions ? (m.clicks / m.impressions) * 100 : null;
  if (has('spend') && has('clicks')) out.derived.cpc = m.clicks ? m.spend / m.clicks : null;
  if (has('spend') && has('impressions')) out.derived.cpm = m.impressions ? (m.spend / m.impressions) * 1000 : null;
  const conv = has('purchases') ? m.purchases : (has('conversions') ? m.conversions : (has('leads') ? m.leads : null));
  if (has('spend') && conv != null) out.derived.cpa = conv ? m.spend / conv : null;
  if (has('spend') && has('revenue')) out.derived.roas = m.spend ? m.revenue / m.spend : null;
  if (has('clicks') && conv != null) out.derived.click_to_conversion_pct = m.clicks ? (conv / m.clicks) * 100 : null;
  // reported ratios, if the provider supplied them, for reconciliation only
  const rep = (await env.DB.prepare("SELECT metric, AVG(value) v FROM metric_observations WHERE tenant_id=? AND subject_type=? AND subject_id=? AND metric LIKE '%_reported' AND interval_start>=? AND interval_end<=? GROUP BY metric").bind(t, subject_type, subject_id, since, until).all()).results || [];
  out.reported = Object.fromEntries(rep.map((r) => [r.metric, Number(r.v)]));
  if (out.reported.ctr_reported != null && out.derived.ctr_pct != null) out.reconciliation = { ctr_delta_pp: Math.abs(out.derived.ctr_pct - out.reported.ctr_reported) };
  return out;
}

// ------------------------------------------------------------------ experiences + immutable versions + allocation
export async function ensureExperience(env, t, { key, kind, brand_id = null }) {
  const ex = await env.DB.prepare('SELECT id FROM experiences WHERE tenant_id=? AND key=?').bind(t, key).first();
  if (ex) return ex.id;
  const id = newId('exp'); const now = buildNowIso();
  await env.DB.prepare('INSERT OR IGNORE INTO experiences (id, tenant_id, brand_id, key, kind, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').bind(id, t, brand_id, key, kind, now, now).run();
  return (await env.DB.prepare('SELECT id FROM experiences WHERE tenant_id=? AND key=?').bind(t, key).first()).id;
}
/** New immutable version (never overwrites). Same artifact hash as the latest version → no new version. */
export async function newVersion(env, t, { experience_key, kind, ref_table, ref_id, components, label = null, source = 'human', created_by = 'owner', change_reason = null, hypothesis_id = null, state = 'active' }) {
  const experience_id = await ensureExperience(env, t, { key: experience_key, kind });
  const artifact_hash = (await sha256(JSON.stringify(components || {}))).slice(0, 32);
  const latest = await env.DB.prepare('SELECT id, version, artifact_hash FROM experience_versions WHERE tenant_id=? AND experience_id=? ORDER BY version DESC LIMIT 1').bind(t, experience_id).first();
  if (latest && latest.artifact_hash === artifact_hash) return { id: latest.id, version: latest.version, created: false };
  const version = (latest?.version || 0) + 1;
  const id = newId('xv'); const now = buildNowIso();
  await env.DB.prepare('INSERT INTO experience_versions (id, tenant_id, experience_id, version, parent_version_id, ref_table, ref_id, artifact_hash, components_json, hypothesis_id, change_reason, state, source, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, experience_id, version, latest?.id || null, ref_table, ref_id, artifact_hash, JSON.stringify(components || {}), hypothesis_id, change_reason, state, source, now, created_by).run();
  await env.DB.prepare('UPDATE experiences SET current_version_id=?, updated_at=? WHERE tenant_id=? AND id=?').bind(id, now, t, experience_id).run();
  return { id, version, created: true, experience_id };
}
/** Register every squeeze page and destination as versions (idempotent by artifact hash). */
export async function registerTrafficVersions(env, t) {
  const [sq, ds] = await env.DB.batch([
    env.DB.prepare('SELECT id, campaign_id, name, headline, cta_text, body_html, weight, version FROM traffic_squeeze_pages WHERE tenant_id=? ORDER BY id').bind(t),
    env.DB.prepare('SELECT id, name, type, url, html, members_json FROM traffic_destinations WHERE tenant_id=? ORDER BY id').bind(t),
  ]);
  let created = 0; const ids = [];
  for (const s of sq.results || []) { const r = await newVersion(env, t, { experience_key: 'squeeze:' + s.campaign_id, kind: 'squeeze', ref_table: 'traffic_squeeze_pages', ref_id: s.id, components: { headline: s.headline, cta: s.cta_text, body: s.body_html || null }, label: s.name }); if (r.created) created++; ids.push(r.id); }
  for (const d of ds.results || []) { const r = await newVersion(env, t, { experience_key: 'destination:' + d.id, kind: 'destination', ref_table: 'traffic_destinations', ref_id: d.id, components: { type: d.type, url: d.url || null, html: d.html || null, members: d.members_json ? JSON.parse(d.members_json) : null }, label: d.name }); if (r.created) created++; ids.push(r.id); }
  // allocation for squeeze experiences from weights (versioned separately from content)
  const camps = (await env.DB.prepare('SELECT DISTINCT campaign_id FROM traffic_squeeze_pages WHERE tenant_id=?').bind(t).all()).results || [];
  for (const c of camps) {
    const exId = await ensureExperience(env, t, { key: 'squeeze:' + c.campaign_id, kind: 'squeeze' });
    const vers = (await env.DB.prepare("SELECT v.id, s.weight FROM experience_versions v JOIN traffic_squeeze_pages s ON s.id=v.ref_id AND s.tenant_id=v.tenant_id WHERE v.tenant_id=? AND v.experience_id=? AND v.state='active' AND s.enabled=1 AND s.status='active'").bind(t, exId).all()).results || [];
    const policy = vers.map((v) => ({ experience_version_id: v.id, weight: Number(v.weight) || 1 }));
    const last = await env.DB.prepare('SELECT id, version, policy_json FROM allocation_policy_versions WHERE tenant_id=? AND experience_id=? ORDER BY version DESC LIMIT 1').bind(t, exId).first();
    if (!last || last.policy_json !== JSON.stringify(policy)) {
      const now = buildNowIso();
      if (last) await env.DB.prepare('UPDATE allocation_policy_versions SET effective_to=? WHERE tenant_id=? AND id=?').bind(now, t, last.id).run();
      const id = newId('apv');
      await env.DB.prepare('INSERT INTO allocation_policy_versions (id, tenant_id, experience_id, version, policy_json, unit, sticky, reason, effective_from, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, t, exId, (last?.version || 0) + 1, JSON.stringify(policy), 'profile', 1, 'weights from traffic_squeeze_pages', now, now, 'system').run();
      await env.DB.prepare('UPDATE experiences SET current_allocation_policy_id=? WHERE tenant_id=? AND id=?').bind(id, t, exId).run();
    }
  }
  return { created, total: ids.length };
}

// ------------------------------------------------------------------ THE BRIDGE
const CLICK_KINDS = { fbclid: 'meta_ads', gclid: 'google_ads', ttclid: 'tiktok_ads', msclkid: 'microsoft_ads', rdt_cid: 'reddit_ads', li_fat_id: 'linkedin_ads' };
export async function resolveClicks(env, t, { limit = 500 } = {}) {
  const secret = env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '';
  const rows = (await env.DB.prepare("SELECT decision_id, ts, profile_id, session_id, device_id, destination_id, signals_json, experience_version_id FROM traffic_decisions WHERE tenant_id=? AND mode IN ('live','post_sms') AND signals_json IS NOT NULL ORDER BY ts DESC LIMIT ?").bind(t, limit).all()).results || [];
  let linked = 0, scanned = rows.length;
  for (const d of rows) {
    let sig; try { sig = JSON.parse(d.signals_json); } catch { continue; }
    const clicks = sig?.attribution?.click_ids || {}; const utm = { source: sig?.attribution?.utm_source, medium: sig?.attribution?.utm_medium, campaign: sig?.attribution?.utm_campaign, content: sig?.attribution?.utm_content, term: sig?.attribution?.utm_term };
    const vh = sig?.network?.visitor_hash || null;
    // experience version for the destination served
    let xv = d.experience_version_id;
    if (!xv && d.destination_id) { const v = await env.DB.prepare("SELECT id FROM experience_versions WHERE tenant_id=? AND ref_table='traffic_destinations' AND ref_id=? ORDER BY version DESC LIMIT 1").bind(t, d.destination_id).first(); xv = v?.id || null; }
    const kinds = Object.keys(clicks).filter((k) => CLICK_KINDS[k]);
    if (!kinds.length && !utm.source) continue;
    for (const kind of (kinds.length ? kinds : ['utm_only'])) {
      const val = clicks[kind];
      const hash = val ? (await sha256(secret + '|click|' + val)).slice(0, 40) : null;
      // deployment: utm_content often carries the ad id on Meta; fall back to null (kept as external id when present)
      const depExt = utm.content && /^\d{8,}$/.test(String(utm.content)) ? String(utm.content) : null;
      const dep = depExt ? await env.DB.prepare('SELECT id, initiative_id, creative_version_id FROM media_deployments WHERE tenant_id=? AND external_id=?').bind(t, depExt).first() : null;
      const r = await env.DB.prepare('INSERT OR IGNORE INTO media_clicks (id, tenant_id, ts, click_kind, click_value_hash, provider_id, deployment_id, deployment_external_id, initiative_id, creative_version_id, utm_json, visitor_hash, profile_id, session_id, device_id, decision_id, experience_version_id, destination_id, evidence_class, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(newId('mcl'), t, d.ts, kind, hash, CLICK_KINDS[kind] || (utm.source ? String(utm.source).toLowerCase() : null), dep?.id || null, depExt, dep?.initiative_id || null, dep?.creative_version_id || null, JSON.stringify(utm), vh, d.profile_id, d.session_id, d.device_id, d.decision_id, xv, d.destination_id, 'first_party_observed', buildNowIso()).run();
      if (r.meta?.changes) {
        linked++;
        const tp = newId('tp');
        await env.DB.prepare('INSERT INTO touchpoints (id, tenant_id, ts, subject_kind, subject_id, channel_id, provider_id, deployment_id, creative_version_id, experience_version_id, action, source, evidence_class, confidence, decision_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(tp, t, d.ts, d.profile_id ? 'profile' : 'visitor_hash', d.profile_id || vh, kind === 'utm_only' ? (utm.medium || 'referral') : 'paid_social', CLICK_KINDS[kind] || null, dep?.id || null, dep?.creative_version_id || null, xv, 'ad_click', 'engine', 'first_party_observed', 1, d.decision_id).run();
        await env.DB.prepare('UPDATE traffic_decisions SET click_ids_json=COALESCE(click_ids_json, ?), experience_version_id=COALESCE(experience_version_id, ?), deployment_id=COALESCE(deployment_id, ?), creative_version_id=COALESCE(creative_version_id, ?), touchpoint_id=COALESCE(touchpoint_id, ?) WHERE tenant_id=? AND decision_id=?')
          .bind(JSON.stringify(clicks), xv, dep?.id || null, dep?.creative_version_id || null, tp, t, d.decision_id).run();
      }
    }
  }
  return { scanned, linked };
}

// ------------------------------------------------------------------ reads
export async function readGraph(env, t, { since_days = 30 } = {}) {
  const since = buildNowIso(Date.now() - since_days * 86400 * 1000).slice(0, 10), until = buildNowIso().slice(0, 10);
  const q = (sql, ...b) => env.DB.prepare(sql).bind(t, ...b).all().then((r) => r.results || []);
  const [accounts, initiatives, groups, deployments, creatives, clicks] = await Promise.all([
    q('SELECT * FROM media_accounts WHERE tenant_id=?'), q('SELECT * FROM media_initiatives WHERE tenant_id=?'), q('SELECT * FROM media_groups WHERE tenant_id=?'),
    q('SELECT * FROM media_deployments WHERE tenant_id=?'), q('SELECT * FROM creatives WHERE tenant_id=?'),
    q('SELECT deployment_external_id, COUNT(*) site_clicks, COUNT(DISTINCT profile_id) visitors FROM media_clicks WHERE tenant_id=? GROUP BY deployment_external_id'),
  ]);
  const prim = await q("SELECT subject_type, subject_id, metric, SUM(value) v FROM metric_observations WHERE tenant_id=? AND state='observed' AND interval_start>=? AND interval_end<=? AND dimensions_hash='none' GROUP BY subject_type, subject_id, metric", since, until + 'T23:59:59');
  const stat = {}; for (const r of prim) { const k = r.subject_type + ':' + r.subject_id; (stat[k] = stat[k] || {})[r.metric] = Number(r.v); }
  const withStat = (type, r) => { const m = stat[type + ':' + r.id] || {}; return { ...r, primitives: m, derived: { ctr_pct: m.impressions ? (m.clicks || 0) / m.impressions * 100 : null, cpc: m.clicks ? (m.spend || 0) / m.clicks : null, cpa: (m.purchases || m.conversions) ? (m.spend || 0) / (m.purchases || m.conversions) : null, roas: m.spend ? (m.revenue || 0) / m.spend : null } }; };
  const clickMap = Object.fromEntries(clicks.map((c) => [c.deployment_external_id, c]));
  return { since, until, accounts: accounts.map((a) => withStat('account', a)), initiatives: initiatives.map((i) => withStat('initiative', i)), groups: groups.map((g) => withStat('group', g)), deployments: deployments.map((d) => ({ ...withStat('deployment', d), site: clickMap[d.external_id] || null })), creatives };
}
export async function journeyFor(env, t, profileId) {
  const [clicks, decisions, events, tps, orders, econ] = await Promise.all([
    env.DB.prepare('SELECT * FROM media_clicks WHERE tenant_id=? AND profile_id=? ORDER BY ts').bind(t, profileId).all(),
    env.DB.prepare('SELECT decision_id, ts, destination_id, experience, outcome, reason, experience_version_id, deployment_id FROM traffic_decisions WHERE tenant_id=? AND profile_id=? ORDER BY ts').bind(t, profileId).all(),
    env.DB.prepare('SELECT ts, kind, event_type, destination_id FROM traffic_events WHERE tenant_id=? AND profile_id=? ORDER BY ts').bind(t, profileId).all(),
    env.DB.prepare('SELECT * FROM touchpoints WHERE tenant_id=? AND subject_id=? ORDER BY ts').bind(t, profileId).all(),
    env.DB.prepare('SELECT * FROM orders WHERE tenant_id=? AND profile_id=? ORDER BY ts').bind(t, profileId).all(),
    env.DB.prepare('SELECT * FROM customer_economics WHERE tenant_id=? AND profile_id=?').bind(t, profileId).first(),
  ]);
  return { profile_id: profileId, clicks: clicks.results || [], decisions: decisions.results || [], events: events.results || [], touchpoints: tps.results || [], orders: orders.results || [], economics: econ || null };
}

// ------------------------------------------------------------------ rules → proposals (never executes)
export async function propose(env, t, p) {
  const key = p.idempotency_key || (await sha256([p.actor, p.action, p.target_type, p.target_id, JSON.stringify(p.after || null), p.reason].join('|'))).slice(0, 32);
  const id = newId('prop'); const now = buildNowIso();
  const r = await env.DB.prepare('INSERT OR IGNORE INTO action_proposals (id, tenant_id, ts, actor, action, target_type, target_id, provider_id, before_json, after_json, reason, evidence_ids_json, hypothesis_id, expected_result, confidence_low, confidence_high, budget_bound, max_loss, currency, rollback_plan_json, required_authority, approval_state, approval_expires_at, idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, t, now, p.actor, p.action, p.target_type, p.target_id, p.provider_id || null, js(p.before), js(p.after), p.reason, JSON.stringify(p.evidence_ids || []), p.hypothesis_id || null, p.expected_result || null, p.confidence_low ?? null, p.confidence_high ?? null, p.budget_bound ?? null, p.max_loss ?? null, p.currency || null, js(p.rollback_plan), p.required_authority, 'proposed', p.approval_expires_at || buildNowIso(Date.now() + 7 * 86400 * 1000), key).run();
  const row = await env.DB.prepare('SELECT id FROM action_proposals WHERE tenant_id=? AND idempotency_key=?').bind(t, key).first();
  try { await logEvent(env, { source: 'growth', key: 'ACTION_PROPOSED', action: p.action, direction: 'internal', status: 202, actor: p.actor, request: { target_type: p.target_type, target_id: p.target_id, after: p.after, reason: p.reason, required_authority: p.required_authority }, response: { proposal_id: row?.id, created: !!(r.meta && r.meta.changes) } }); } catch { /* optional */ }
  return { id: row?.id || id, created: !!(r.meta && r.meta.changes), idempotency_key: key };
}
