// GROWTH ADAPTER — Meta Ads, READ ONLY (account discovery, entities, metrics, backfill).
// Runs through the build's META_ADS_* directory capabilities so every provider call is an
// invocation with a receipt (inv_…). Raw payloads are stored once as raw_snapshots; normalized rows
// carry raw_snapshot_id. Primitives (spend, impressions, reach, frequency, clicks, purchases, leads,
// revenue) become metric_observations per deployment per day; provider ratios (ctr/cpc/cpm) are
// kept only as *_reported observations for reconciliation. No mutation lives in this file.

import { buildNowIso } from '../../build_time.js';
import { snapshot, evidence, startSync, finishSync, upsertEntity, observe, newId, sha256 } from '../store.js';

export const manifest = { provider_id: 'meta_ads', reads: ['discover_accounts', 'discover_entities', 'read_entity', 'read_metrics', 'backfill'], writes: [], webhook: false };

/** One receipted call to a directory capability. Returns { ok, list, raw, invocation_id, head } */
async function call(env, origin, key, body) {
  const r = await fetch(origin + '/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': String(env.TERMINAL_KEY || '') }, body: JSON.stringify({ key, body: JSON.stringify(body) }) });
  const j = await r.json().catch(() => ({}));
  const inv = j.invocation?.id || j.invocation_id || j.proof?.invocation_id || null;
  const s = String(j.result || ''); const i = s.indexOf('{');
  if (i < 0) return { ok: false, error: s.slice(0, 200), invocation_id: inv, head: s.slice(0, 300) };
  let o; try { o = JSON.parse(s.slice(i)); } catch { return { ok: false, error: 'unparseable', invocation_id: inv, head: s.slice(0, 300) }; }
  if (o.ok === false) return { ok: false, error: o.data?.error?.message || o.text || 'meta error', raw: o, invocation_id: inv, head: s.slice(0, 300) };
  const list = o.accounts || (o.data && (o.data.data || o.data.accounts)) || o.data || [];
  return { ok: true, list: Array.isArray(list) ? list : [], raw: o, invocation_id: inv, head: s.slice(0, 300) };
}
const cents = (v) => v == null ? null : Number(v) / 100;
const sum = (arr, types) => { let n = 0, seen = false; for (const a of arr || []) if (types.includes(a.action_type)) { n += Number(a.value) || 0; seen = true; } return seen ? n : null; };
const PURCHASE = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'], LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];

export async function discoverAccounts(env, { tenant, origin }) {
  const r = await call(env, origin, 'META_ADS_ACCOUNTS', {});
  return { ok: r.ok, error: r.error, invocation_id: r.invocation_id, head: r.head, accounts: (r.list || []).map((a) => ({ external_id: a.id, account_id: a.account_id, name: a.name, currency: a.currency, status: a.account_status, spent: cents(a.amount_spent), via: a._via })) };
}

/** Import one account: entities + daily deployment-level metrics for `days`. Idempotent per window. */
export async function importAccount(env, { tenant: t, origin, account_id, days = 30, actor = 'owner', brand_id = null }) {
  const until = buildNowIso().slice(0, 10), since = buildNowIso(Date.now() - days * 86400 * 1000).slice(0, 10);
  const sync = await startSync(env, t, { provider_id: 'meta_ads', kind: 'entities+metrics', window_start: since, window_end: until, actor });
  const counts = { initiatives: 0, groups: 0, deployments: 0, creatives: 0, observations: 0, not_collected: 0, snapshots: 0 }, errors = [], receipts = [];
  const rec = (op, r) => receipts.push({ op, invocation_id: r.invocation_id, ok: r.ok, head: r.head });
  const snap = async (subject_type, ext, body) => { const s = await snapshot(env, t, { provider_id: 'meta_ads', sync_run_id: sync.id, subject_type, subject_external_id: ext, body }); if (!s.deduped) counts.snapshots++; return s.id; };

  const acctSnap = await snap('account', account_id, { id: account_id });
  const acct = await upsertEntity(env, t, 'media_accounts', { brand_id, provider_id: 'meta_ads', external_id: account_id, name: null, currency: null, status: null, native_type: 'ad_account', raw_snapshot_id: acctSnap });
  const map = { initiative: {}, group: {}, creative: {}, deployment: {} };

  const camps = await call(env, origin, 'META_ADS_CAMPAIGNS', { account_id }); rec('campaigns', camps); if (!camps.ok) errors.push('campaigns: ' + camps.error);
  for (const c of camps.list) { const sid = await snap('initiative', c.id, c); map.initiative[c.id] = (await upsertEntity(env, t, 'media_initiatives', { account_id: acct.id, provider_id: 'meta_ads', external_id: String(c.id), name: c.name, objective: c.objective, status: c.status, native_type: 'campaign', daily_budget: cents(c.daily_budget), lifetime_budget: cents(c.lifetime_budget), bid_strategy: c.bid_strategy || null, start_at: c.start_time || null, end_at: c.stop_time || null, channel_id: 'paid_social', raw_snapshot_id: sid })).id; counts.initiatives++; }

  const sets = await call(env, origin, 'META_ADS_ADSETS', { account_id }); rec('adsets', sets); if (!sets.ok) errors.push('adsets: ' + sets.error);
  for (const s of sets.list) { const sid = await snap('group', s.id, s); map.group[s.id] = (await upsertEntity(env, t, 'media_groups', { initiative_id: map.initiative[s.campaign_id] || null, provider_id: 'meta_ads', external_id: String(s.id), name: s.name, status: s.effective_status || s.status, native_type: 'adset', daily_budget: cents(s.daily_budget), lifetime_budget: cents(s.lifetime_budget), bid_amount: cents(s.bid_amount), optimization_goal: s.optimization_goal || null, targeting_json: s.targeting ? JSON.stringify(s.targeting) : null, raw_snapshot_id: sid })).id; counts.groups++; }

  const crs = await call(env, origin, 'META_ADS_CREATIVES', { account_id }); rec('creatives', crs); if (!crs.ok) errors.push('creatives: ' + crs.error);
  for (const cr of crs.list) {
    const sid = await snap('creative', cr.id, cr);
    const text = [cr.title, cr.body, cr.call_to_action_type, cr.image_hash, cr.video_id].filter(Boolean).join('|');
    const asset_hash = text ? (await sha256(text)).slice(0, 32) : (await sha256('meta:' + cr.id)).slice(0, 32);
    const logical = await upsertEntity(env, t, 'creatives', { brand_id, name: cr.name || cr.title || cr.id, format: cr.video_id ? 'video' : (cr.image_url || cr.image_hash ? 'image' : 'text'), asset_hash, evidence_class: 'provider_reported', first_seen: buildNowIso(), last_seen: buildNowIso() });
    // version: one per distinct content hash; idempotent
    let ver = await env.DB.prepare('SELECT id FROM creative_versions WHERE tenant_id=? AND creative_id=? AND asset_hash=?').bind(t, logical.id, asset_hash).first();
    if (!ver) {
      const last = await env.DB.prepare('SELECT version FROM creative_versions WHERE tenant_id=? AND creative_id=? ORDER BY version DESC LIMIT 1').bind(t, logical.id).first();
      const vid = newId('cvr');
      await env.DB.prepare('INSERT INTO creative_versions (id, tenant_id, creative_id, version, asset_hash, headline, body, cta, image_url, landing_url, provider_external_ids_json, source, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(vid, t, logical.id, (last?.version || 0) + 1, asset_hash, cr.title || null, cr.body || null, cr.call_to_action_type || cr.object_story_spec?.link_data?.call_to_action?.type || null, cr.image_url || null, cr.object_story_spec?.link_data?.link || cr.link_url || null, JSON.stringify({ meta_ads: String(cr.id) }), 'observed', buildNowIso(), actor).run();
      ver = { id: vid };
      await env.DB.prepare('UPDATE creatives SET current_version_id=? WHERE tenant_id=? AND id=?').bind(vid, t, logical.id).run();
    }
    map.creative[cr.id] = { creative_id: logical.id, version_id: ver.id }; counts.creatives++;
  }

  const ads = await call(env, origin, 'META_ADS_ADS', { account_id }); rec('ads', ads); if (!ads.ok) errors.push('ads: ' + ads.error);
  for (const a of ads.list) { const sid = await snap('deployment', a.id, a); const cv = a.creative?.id ? map.creative[a.creative.id] : null; map.deployment[a.id] = (await upsertEntity(env, t, 'media_deployments', { group_id: map.group[a.adset_id] || null, initiative_id: map.initiative[a.campaign_id] || null, provider_id: 'meta_ads', external_id: String(a.id), name: a.name, status: a.effective_status || a.status, native_type: 'ad', creative_id: cv?.creative_id || null, creative_version_id: cv?.version_id || null, raw_snapshot_id: sid, first_seen: buildNowIso(), last_seen: buildNowIso() })).id; counts.deployments++; }

  // daily deployment-level metrics
  const preset = days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d';
  const ins = await call(env, origin, 'META_ADS_INSIGHTS', { account_id, level: 'ad', date_preset: preset, time_increment: 1, fields: ['ad_id', 'campaign_id', 'adset_id', 'spend', 'impressions', 'reach', 'frequency', 'clicks', 'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'actions', 'action_values'] });
  rec('insights', ins); if (!ins.ok) errors.push('insights: ' + ins.error);
  const insSnap = await snap('insights', account_id + ':' + since + ':' + until, ins.raw || { empty: true });
  const evd = await evidence(env, t, { evidence_class: 'provider_reported', source: 'meta_ads', sync_run_id: sync.id, raw_snapshot_id: insSnap, request: { account_id, level: 'ad', preset, time_increment: 1 }, normalizer_version: 'meta/1', derived: { rows: ins.list.length }, actor });
  const seenDeployments = new Set();
  for (const r of ins.list) {
    const dep = map.deployment[r.ad_id]; if (!dep) continue; seenDeployments.add(dep);
    const base = { subject_type: 'deployment', subject_id: dep, interval_start: r.date_start, interval_end: r.date_stop || r.date_start, currency: 'USD', timezone: 'America/Los_Angeles', source: 'meta_ads', evidence_class: 'provider_reported', evidence_id: evd, sync_run_id: sync.id };
    const prim = { spend: r.spend, impressions: r.impressions, reach: r.reach, frequency: r.frequency, clicks: r.clicks, landing_page_views: r.inline_link_clicks, purchases: sum(r.actions, PURCHASE), leads: sum(r.actions, LEAD), revenue: sum(r.action_values, PURCHASE) };
    for (const [metric, v] of Object.entries(prim)) if (v != null) { if (await observe(env, t, { ...base, metric, value: Number(v) })) counts.observations++; }
    for (const [metric, v] of [['ctr_reported', r.ctr], ['cpc_reported', r.cpc], ['cpm_reported', r.cpm]]) if (v != null) { if (await observe(env, t, { ...base, metric, value: Number(v) })) counts.observations++; }
  }
  // deployments with NO insight rows in the window: named state, never zero
  for (const [ext, dep] of Object.entries(map.deployment)) if (!seenDeployments.has(dep)) { if (await observe(env, t, { subject_type: 'deployment', subject_id: dep, metric: 'spend', value: null, state: ins.ok ? 'not_collected' : 'unknown', interval_start: since, interval_end: until, source: 'meta_ads', evidence_class: 'provider_reported', evidence_id: evd, sync_run_id: sync.id })) counts.not_collected++; }

  await finishSync(env, t, sync.id, { state: errors.length ? 'partial' : 'ok', counts, errors, evidence_id: evd, invocation_ids: receipts.map((x) => x.invocation_id).filter(Boolean) });
  return { ok: errors.length === 0, sync_run_id: sync.id, replay_of: sync.replay_of, account_id: acct.id, counts, errors, evidence_id: evd, receipts };
}
