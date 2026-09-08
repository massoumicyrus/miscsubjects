// GROWTH ADAPTER — Meta Ads, READ ONLY (account discovery, entities, metrics, backfill).
// Runs through the build's META_ADS_* directory capabilities so every provider call is an
// invocation with a receipt (inv_…). Raw payloads are stored once as raw_snapshots; normalized rows
// carry raw_snapshot_id. Primitives (spend, impressions, reach, frequency, clicks, purchases, leads,
// revenue) become metric_observations per deployment per day; provider ratios (ctr/cpc/cpm) are
// kept only as *_reported observations for reconciliation. No mutation lives in this file.
//
// Windows are explicit (since/until) because Meta's relative presets return nothing for an account
// whose campaigns are paused today, while its history is fully retrievable. All writes are batched:
// a real account is hundreds of ads and thousands of daily rows, and a request has ~1,000 subrequests.

import { buildNowIso } from '../../build_time.js';
import { snapshot, evidence, startSync, finishSync, upsertEntity, upsertMany, snapshotMany, observeMany, runBatch, newId, sha256 } from '../store.js';

export const manifest = { provider_id: 'meta_ads', reads: ['discover_accounts', 'discover_entities', 'read_entity', 'read_metrics', 'backfill'], writes: [], webhook: false };

/** One receipted call to a directory capability. Returns { ok, list, raw, invocation_id, head } */
export async function callCapability(env, origin, key, body) {
  const r = await fetch(origin + '/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': String(env.TERMINAL_KEY || '') }, body: JSON.stringify({ key, body: JSON.stringify(body) }) });
  const j = await r.json().catch(() => ({}));
  const inv = j.invocation?.id || j.invocation_id || j.proof?.invocation_id || null;
  const s = String(j.result || ''); const i = s.indexOf('{');
  if (i < 0) return { ok: false, list: [], error: s.slice(0, 200), invocation_id: inv, head: s.slice(0, 300) };
  let o; try { o = JSON.parse(s.slice(i)); } catch { return { ok: false, list: [], error: 'unparseable', invocation_id: inv, head: s.slice(0, 300) }; }
  if (o.ok === false) { const err = o.data?.error?.message || (typeof o.text === 'string' && o.text.startsWith('{') ? (() => { try { return JSON.parse(o.text)?.error?.message; } catch { return null; } })() : null) || o.text || 'meta error'; return { ok: false, list: [], error: String(err), raw: o, invocation_id: inv, head: s.slice(0, 300) }; }
  const list = o.accounts || (o.data && (o.data.data || o.data.accounts)) || o.data || [];
  return { ok: true, list: Array.isArray(list) ? list : [], raw: o, invocation_id: inv, head: s.slice(0, 300) };
}
const call = callCapability;
const TOO_MUCH = /reduce the amount of data/i;
const cents = (v) => v == null ? null : Number(v) / 100;
const sum = (arr, types) => { let n = 0, seen = false; for (const a of arr || []) if (types.includes(a.action_type)) { n += Number(a.value) || 0; seen = true; } return seen ? n : null; };
const PURCHASE = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'], LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const day = (ms) => buildNowIso(ms).slice(0, 10);

export async function discoverAccounts(env, { tenant, origin }) {
  const r = await call(env, origin, 'META_ADS_ACCOUNTS', {});
  return { ok: r.ok, error: r.error, invocation_id: r.invocation_id, head: r.head, accounts: (r.list || []).map((a) => ({ external_id: a.id, account_id: a.account_id, name: a.name, currency: a.currency, status: a.account_status, spent: cents(a.amount_spent), via: a._via })) };
}

/** Import one account: entities + daily deployment-level metrics for [since, until]. Idempotent per window. */
export async function importAccount(env, { tenant: t, origin, account_id, days = 30, since = null, until = null, actor = 'owner', brand_id = null }) {
  until = until || day(Date.now()); since = since || day(Date.parse(until + 'T00:00:00Z') - days * 86400 * 1000);
  const sync = await startSync(env, t, { provider_id: 'meta_ads', kind: 'entities+metrics', window_start: since, window_end: until, actor });
  const counts = { initiatives: 0, groups: 0, deployments: 0, creatives: 0, creative_versions: 0, observations: 0, not_collected: 0, snapshots: 0, insight_rows: 0 }, errors = [], receipts = [];
  const rec = (op, r) => receipts.push({ op, invocation_id: r.invocation_id, ok: r.ok, rows: r.list ? r.list.length : null, head: r.head });
  const snaps = async (subject_type, list) => { const s = await snapshotMany(env, t, { provider_id: 'meta_ads', sync_run_id: sync.id, items: list.map((x) => ({ subject_type, subject_external_id: String(x.id), body: x })) }); counts.snapshots += s.created; return s.snapshots.map((x) => x.id); };
  const now = buildNowIso();

  const acctSnap = await snapshot(env, t, { provider_id: 'meta_ads', sync_run_id: sync.id, subject_type: 'account', subject_external_id: account_id, body: { id: account_id } });
  const acct = await upsertEntity(env, t, 'media_accounts', { brand_id, provider_id: 'meta_ads', external_id: account_id, native_type: 'ad_account', raw_snapshot_id: acctSnap.id });

  // ---- campaigns → initiatives
  const camps = await call(env, origin, 'META_ADS_CAMPAIGNS', { account_id }); rec('campaigns', camps); if (!camps.ok) errors.push('campaigns: ' + camps.error);
  const campSnap = await snaps('initiative', camps.list);
  const initiatives = await upsertMany(env, t, 'media_initiatives', camps.list.map((c, i) => ({ account_id: acct.id, brand_id, provider_id: 'meta_ads', external_id: String(c.id), name: c.name, objective: c.objective, status: c.status, native_type: 'campaign', daily_budget: cents(c.daily_budget), lifetime_budget: cents(c.lifetime_budget), bid_strategy: c.bid_strategy || null, start_at: c.start_time || null, end_at: c.stop_time || null, channel_id: 'paid_social', raw_snapshot_id: campSnap[i] })));
  counts.initiatives = camps.list.length;

  // ---- adsets → groups
  const sets = await call(env, origin, 'META_ADS_ADSETS', { account_id }); rec('adsets', sets); if (!sets.ok) errors.push('adsets: ' + sets.error);
  const setSnap = await snaps('group', sets.list);
  const groups = await upsertMany(env, t, 'media_groups', sets.list.map((s, i) => ({ initiative_id: initiatives.ids.get(String(s.campaign_id)) || null, provider_id: 'meta_ads', external_id: String(s.id), name: s.name, status: s.effective_status || s.status, native_type: 'adset', daily_budget: cents(s.daily_budget), lifetime_budget: cents(s.lifetime_budget), bid_amount: cents(s.bid_amount), optimization_goal: s.optimization_goal || null, targeting_json: s.targeting ? JSON.stringify(s.targeting) : null, raw_snapshot_id: setSnap[i] })));
  counts.groups = sets.list.length;

  // ---- creatives → logical creatives (one per content hash) + immutable creative versions
  let crs = await call(env, origin, 'META_ADS_CREATIVES', { account_id, limit: 50 }); rec('creatives', crs);
  if (!crs.ok && TOO_MUCH.test(crs.error || '')) { crs = await call(env, origin, 'META_ADS_CREATIVES', { account_id, limit: 10 }); rec('creatives-retry-10', crs); }
  if (!crs.ok) errors.push('creatives: ' + crs.error);
  await snaps('creative', crs.list);
  const hashOf = new Map(); // meta creative id → asset_hash
  for (const cr of crs.list) { const text = [cr.title, cr.body, cr.call_to_action_type, cr.image_hash, cr.video_id].filter(Boolean).join('|'); hashOf.set(String(cr.id), (await sha256(text || 'meta:' + cr.id)).slice(0, 32)); }
  const creatives = await upsertMany(env, t, 'creatives', crs.list.map((cr) => ({ brand_id, name: cr.name || cr.title || String(cr.id), format: cr.video_id ? 'video' : (cr.image_url || cr.image_hash ? 'image' : 'text'), asset_hash: hashOf.get(String(cr.id)), evidence_class: 'provider_reported', first_seen: now, last_seen: now })));
  counts.creatives = creatives.ids.size;
  // existing versions for these creatives, then insert the missing (creative_id, asset_hash) pairs
  const verOf = new Map(); const maxVer = new Map(); const cids = [...new Set([...creatives.ids.values()])];
  for (let i = 0; i < cids.length; i += 90) { const c = cids.slice(i, i + 90); for (const r of (await env.DB.prepare(`SELECT id, creative_id, asset_hash, version FROM creative_versions WHERE tenant_id=? AND creative_id IN (${c.map(() => '?').join(',')})`).bind(t, ...c).all()).results || []) { verOf.set(r.creative_id + '|' + r.asset_hash, r.id); maxVer.set(r.creative_id, Math.max(maxVer.get(r.creative_id) || 0, Number(r.version) || 0)); } }
  const vstmts = []; const cvOf = new Map(); // meta creative id → { creative_id, version_id }
  for (const cr of crs.list) {
    const h = hashOf.get(String(cr.id)), cid = creatives.ids.get(h); if (!cid) continue;
    let vid = verOf.get(cid + '|' + h);
    if (!vid) {
      vid = newId('cvr'); const v = (maxVer.get(cid) || 0) + 1; maxVer.set(cid, v); verOf.set(cid + '|' + h, vid); counts.creative_versions++;
      vstmts.push(env.DB.prepare('INSERT INTO creative_versions (id, tenant_id, creative_id, version, asset_hash, headline, body, cta, image_url, landing_url, provider_external_ids_json, source, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(vid, t, cid, v, h, cr.title || null, cr.body || null, cr.call_to_action_type || cr.object_story_spec?.link_data?.call_to_action?.type || null, cr.image_url || null, cr.object_story_spec?.link_data?.link || cr.link_url || null, JSON.stringify({ meta_ads: String(cr.id) }), 'observed', now, actor));
      vstmts.push(env.DB.prepare('UPDATE creatives SET current_version_id=? WHERE tenant_id=? AND id=?').bind(vid, t, cid));
    }
    cvOf.set(String(cr.id), { creative_id: cid, version_id: vid });
  }
  await runBatch(env, vstmts);

  // ---- ads → deployments
  const ads = await call(env, origin, 'META_ADS_ADS', { account_id }); rec('ads', ads); if (!ads.ok) errors.push('ads: ' + ads.error);
  const adSnap = await snaps('deployment', ads.list);
  const deployments = await upsertMany(env, t, 'media_deployments', ads.list.map((a, i) => { const cv = a.creative?.id ? cvOf.get(String(a.creative.id)) : null; return { group_id: groups.ids.get(String(a.adset_id)) || null, initiative_id: initiatives.ids.get(String(a.campaign_id)) || null, provider_id: 'meta_ads', external_id: String(a.id), name: a.name, status: a.effective_status || a.status, native_type: 'ad', creative_id: cv?.creative_id || null, creative_version_id: cv?.version_id || null, raw_snapshot_id: adSnap[i], first_seen: now, last_seen: now }; }));
  counts.deployments = ads.list.length;

  // ---- daily deployment-level metrics for the explicit window
  const ins = await call(env, origin, 'META_ADS_INSIGHTS', { account_id, level: 'ad', time_range: { since, until }, time_increment: 1, fields: ['ad_id', 'campaign_id', 'adset_id', 'spend', 'impressions', 'reach', 'frequency', 'clicks', 'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'actions', 'action_values'] });
  rec('insights', ins); if (!ins.ok) errors.push('insights: ' + ins.error);
  counts.insight_rows = ins.list.length;
  const insSnap = await snapshot(env, t, { provider_id: 'meta_ads', sync_run_id: sync.id, subject_type: 'insights', subject_external_id: account_id + ':' + since + ':' + until, body: ins.raw || { empty: true } });
  const evd = await evidence(env, t, { evidence_class: 'provider_reported', source: 'meta_ads', sync_run_id: sync.id, raw_snapshot_id: insSnap.id, request: { account_id, level: 'ad', since, until, time_increment: 1 }, normalizer_version: 'meta/2', derived: { rows: ins.list.length, invocation_id: ins.invocation_id }, actor });
  const obs = []; const seen = new Set();
  for (const r of ins.list) {
    const dep = deployments.ids.get(String(r.ad_id)); if (!dep) continue; seen.add(dep);
    const base = { subject_type: 'deployment', subject_id: dep, interval_start: r.date_start, interval_end: r.date_stop || r.date_start, currency: 'USD', timezone: 'America/Los_Angeles', source: 'meta_ads', evidence_class: 'provider_reported', evidence_id: evd, sync_run_id: sync.id };
    const prim = { spend: r.spend, impressions: r.impressions, reach: r.reach, frequency: r.frequency, clicks: r.clicks, landing_page_views: r.inline_link_clicks, purchases: sum(r.actions, PURCHASE), leads: sum(r.actions, LEAD), revenue: sum(r.action_values, PURCHASE) };
    for (const [metric, v] of Object.entries(prim)) if (v != null) obs.push({ ...base, metric, value: Number(v) });
    for (const [metric, v] of [['ctr_reported', r.ctr], ['cpc_reported', r.cpc], ['cpm_reported', r.cpm]]) if (v != null) obs.push({ ...base, metric, value: Number(v) });
  }
  counts.observations = await observeMany(env, t, obs);
  // deployments with NO insight rows in the window: a named state, never a zero
  const missing = [];
  for (const dep of deployments.ids.values()) if (!seen.has(dep)) missing.push({ subject_type: 'deployment', subject_id: dep, metric: 'spend', value: null, state: ins.ok ? 'not_collected' : 'unknown', interval_start: since, interval_end: until, source: 'meta_ads', evidence_class: 'provider_reported', evidence_id: evd, sync_run_id: sync.id });
  counts.not_collected = await observeMany(env, t, missing);

  await finishSync(env, t, sync.id, { state: errors.length ? 'partial' : 'ok', counts, errors, evidence_id: evd, invocation_ids: receipts.map((x) => x.invocation_id).filter(Boolean) });
  return { ok: errors.length === 0, sync_run_id: sync.id, replay_of: sync.replay_of, window: { since, until }, account_id: acct.id, counts, errors, evidence_id: evd, receipts };
}
