/**
 * Meta Marketing API — full surface (reads, writes, insights, catalogs,
 * audiences, signals/datasets, A/B tests, activity logs, targeting) plus a
 * live proxy to Meta's hosted Ads MCP server (https://mcp.facebook.com/ads).
 *
 * Low-level GET/pagination is reused from meta_graph.js. Write helpers are here.
 * SAFETY: create operations default to status PAUSED so nothing spends money
 * until the caller (or the owner) explicitly activates it.
 */
import { metaFetch, metaPaginate, metaToken } from './meta_graph.js';

const API_VERSION = 'v22.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const MCP_URL = 'https://mcp.facebook.com/ads';

const token = (env) => metaToken(env); // bridge-first (fresh Secrets Store), stale env copy as fallback
const act = (id) => (String(id || '').startsWith('act_') ? String(id) : `act_${id}`);
const business = (env) => env.META_BUSINESS_ID || '1602361853681297';

/** POST/DELETE to the Graph API with form-encoded params. Objects are JSON-stringified. */
export async function metaWrite(env, path, params = {}, method = 'POST') {
  const t = await token(env);
  if (!t) return { ok: false, status: 0, error: 'META_ACCESS_TOKEN not set' };
  const u = new URL(path.startsWith('http') ? path : BASE + (path.startsWith('/') ? path : '/' + path));
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const init = { method, headers: { accept: 'application/json' } };
  if (method === 'DELETE') {
    u.searchParams.set('access_token', t);
    for (const [k, v] of form.entries()) u.searchParams.set(k, v);
  } else {
    form.set('access_token', t);
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
    init.body = form.toString();
  }
  const r = await fetch(u.toString(), init);
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

// ---- Generic node ----------------------------------------------------------
export async function getObject(env, id, fields) {
  return metaFetch(env, `/${id}`, fields ? { fields } : {});
}
export async function updateObject(env, id, params) {
  return metaWrite(env, `/${id}`, params, 'POST');
}
export async function deleteObject(env, id) {
  return metaWrite(env, `/${id}`, {}, 'DELETE');
}
export async function setStatus(env, id, status) {
  const s = String(status || '').toUpperCase();
  if (!['ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED'].includes(s)) return { ok: false, status: 400, error: 'status must be ACTIVE|PAUSED|ARCHIVED|DELETED' };
  return metaWrite(env, `/${id}`, { status: s }, 'POST');
}
export async function setBudget(env, id, { daily_budget, lifetime_budget } = {}) {
  const params = {};
  if (daily_budget != null) params.daily_budget = daily_budget; // minor units (cents)
  if (lifetime_budget != null) params.lifetime_budget = lifetime_budget;
  if (!Object.keys(params).length) return { ok: false, status: 400, error: 'daily_budget or lifetime_budget (in minor units) required' };
  return metaWrite(env, `/${id}`, params, 'POST');
}

// ---- Ad account ------------------------------------------------------------
export async function getAdAccount(env, accountId) {
  return metaFetch(env, `/${act(accountId)}`, { fields: 'id,account_id,name,account_status,disable_reason,currency,timezone_name,amount_spent,balance,spend_cap,funding_source_details,business,age,capabilities,min_daily_budget' });
}

// ---- Comprehensive reporting (insights) ------------------------------------
const DEFAULT_INSIGHT_FIELDS = 'account_id,account_name,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,frequency,clicks,unique_clicks,ctr,cpc,cpm,cpp,spend,actions,action_values,conversions,conversion_values,cost_per_action_type,purchase_roas,website_purchase_roas,date_start,date_stop';
export async function insights(env, objectId, opts = {}) {
  const id = String(objectId || '').match(/^\d+$/) ? act(objectId) : objectId; // bare account number -> act_
  const q = {
    level: opts.level || 'account',
    fields: opts.fields || DEFAULT_INSIGHT_FIELDS,
    limit: opts.limit || '200',
  };
  if (opts.breakdowns) q.breakdowns = opts.breakdowns;
  if (opts.action_breakdowns) q.action_breakdowns = opts.action_breakdowns;
  if (opts.time_range) q.time_range = typeof opts.time_range === 'object' ? JSON.stringify(opts.time_range) : opts.time_range;
  else q.date_preset = opts.date_preset || 'last_30d';
  if (opts.time_increment) q.time_increment = opts.time_increment;
  if (opts.action_attribution_windows) q.action_attribution_windows = opts.action_attribution_windows;
  if (opts.filtering) q.filtering = typeof opts.filtering === 'object' ? JSON.stringify(opts.filtering) : opts.filtering;
  if (opts.sort) q.sort = opts.sort;
  return metaPaginate(env, `/${id}/insights`, q, opts.max_pages || 10);
}
/** Async insights report job for large pulls: create -> poll -> read. */
export async function insightsAsyncCreate(env, objectId, opts = {}) {
  const id = String(objectId || '').match(/^\d+$/) ? act(objectId) : objectId;
  const params = { level: opts.level || 'account', fields: opts.fields || DEFAULT_INSIGHT_FIELDS };
  if (opts.breakdowns) params.breakdowns = opts.breakdowns;
  if (opts.time_range) params.time_range = opts.time_range; else params.date_preset = opts.date_preset || 'last_30d';
  if (opts.time_increment) params.time_increment = opts.time_increment;
  return metaWrite(env, `/${id}/insights`, params, 'POST');
}
export async function insightsAsyncStatus(env, reportRunId) {
  return metaFetch(env, `/${reportRunId}`, { fields: 'id,async_status,async_percent_completion,date_start,date_stop' });
}
export async function insightsAsyncResult(env, reportRunId, opts = {}) {
  return metaPaginate(env, `/${reportRunId}/insights`, { limit: opts.limit || '500' }, opts.max_pages || 20);
}

// ---- Ad creation & management (writes) -------------------------------------
export async function createCampaign(env, accountId, body = {}) {
  const params = {
    name: body.name, objective: body.objective, status: (body.status || 'PAUSED').toUpperCase(),
    special_ad_categories: body.special_ad_categories || '[]',
    buying_type: body.buying_type, bid_strategy: body.bid_strategy,
    daily_budget: body.daily_budget, lifetime_budget: body.lifetime_budget,
    campaign_budget_optimization: body.campaign_budget_optimization,
  };
  if (!params.name || !params.objective) return { ok: false, status: 400, error: 'name and objective are required' };
  return metaWrite(env, `/${act(accountId)}/campaigns`, params, 'POST');
}
export async function createAdset(env, accountId, body = {}) {
  const params = {
    name: body.name, campaign_id: body.campaign_id, status: (body.status || 'PAUSED').toUpperCase(),
    optimization_goal: body.optimization_goal, billing_event: body.billing_event, bid_amount: body.bid_amount,
    daily_budget: body.daily_budget, lifetime_budget: body.lifetime_budget,
    targeting: body.targeting, start_time: body.start_time, end_time: body.end_time,
    promoted_object: body.promoted_object, bid_strategy: body.bid_strategy, destination_type: body.destination_type,
  };
  if (!params.name || !params.campaign_id || !params.optimization_goal || !params.billing_event) return { ok: false, status: 400, error: 'name, campaign_id, optimization_goal and billing_event are required' };
  return metaWrite(env, `/${act(accountId)}/adsets`, params, 'POST');
}
export async function createAdCreative(env, accountId, body = {}) {
  const params = { name: body.name, object_story_spec: body.object_story_spec, object_story_id: body.object_story_id, degrees_of_freedom_spec: body.degrees_of_freedom_spec, asset_feed_spec: body.asset_feed_spec };
  if (!params.name || (!params.object_story_spec && !params.object_story_id && !params.asset_feed_spec)) return { ok: false, status: 400, error: 'name and one of object_story_spec|object_story_id|asset_feed_spec required' };
  return metaWrite(env, `/${act(accountId)}/adcreatives`, params, 'POST');
}
export async function createAd(env, accountId, body = {}) {
  const params = { name: body.name, adset_id: body.adset_id, status: (body.status || 'PAUSED').toUpperCase(), creative: body.creative, tracking_specs: body.tracking_specs };
  if (!params.name || !params.adset_id || !params.creative) return { ok: false, status: 400, error: 'name, adset_id and creative ({creative_id:...}) are required' };
  return metaWrite(env, `/${act(accountId)}/ads`, params, 'POST');
}

// ---- Targeting & estimates -------------------------------------------------
export async function targetingSearch(env, { q, type = 'adinterest', limit = 25, class: cls } = {}) {
  const query = { type, limit };
  if (q) query.q = q;
  if (cls) query.class = cls;
  return metaFetch(env, '/search', query);
}
export async function targetingBrowse(env, { limit = 500 } = {}) {
  return metaFetch(env, '/search', { type: 'adTargetingCategory', class: 'interests', limit });
}
export async function deliveryEstimate(env, accountId, { optimization_goal, targeting_spec } = {}) {
  return metaFetch(env, `/${act(accountId)}/delivery_estimate`, { optimization_goal, targeting_spec: typeof targeting_spec === 'object' ? JSON.stringify(targeting_spec) : targeting_spec });
}

// ---- Catalogs --------------------------------------------------------------
export async function listCatalogs(env) {
  return metaPaginate(env, `/${business(env)}/owned_product_catalogs`, { fields: 'id,name,product_count,vertical,da_display_settings', limit: '100' });
}
export async function getCatalog(env, catalogId) {
  return metaFetch(env, `/${catalogId}`, { fields: 'id,name,product_count,vertical,feed_count' });
}
export async function createCatalog(env, body = {}) {
  if (!body.name) return { ok: false, status: 400, error: 'name required' };
  return metaWrite(env, `/${business(env)}/owned_product_catalogs`, { name: body.name, vertical: body.vertical || 'commerce' }, 'POST');
}
export async function listCatalogProducts(env, catalogId) {
  return metaPaginate(env, `/${catalogId}/products`, { fields: 'id,retailer_id,name,availability,price,image_url,url,review_status,visibility', limit: '100' });
}
export async function listCatalogProductSets(env, catalogId) {
  return metaPaginate(env, `/${catalogId}/product_sets`, { fields: 'id,name,product_count,filter', limit: '100' });
}
export async function listCatalogFeeds(env, catalogId) {
  return metaPaginate(env, `/${catalogId}/product_feeds`, { fields: 'id,name,file_name,schedule,latest_upload', limit: '100' });
}
export async function catalogDiagnostics(env, catalogId) {
  return metaFetch(env, `/${catalogId}`, { fields: 'diagnostics' });
}

// ---- Signals & datasets (pixels) -------------------------------------------
export async function listPixels(env, accountId) {
  return metaPaginate(env, `/${act(accountId)}/adspixels`, { fields: 'id,name,last_fired_time,is_unavailable,data_use_setting,enable_automatic_matching', limit: '100' });
}
export async function datasetStats(env, pixelId) {
  return metaFetch(env, `/${pixelId}/stats`, { aggregation: 'event', fields: 'aggregation,data,start_time,end_time' });
}

// ---- Custom audiences ------------------------------------------------------
export async function listAudiences(env, accountId) {
  return metaPaginate(env, `/${act(accountId)}/customaudiences`, { fields: 'id,name,subtype,description,approximate_count_lower_bound,approximate_count_upper_bound,operation_status,delivery_status,time_created', limit: '100' });
}
export async function createCustomAudience(env, accountId, body = {}) {
  if (!body.name || !body.subtype) return { ok: false, status: 400, error: 'name and subtype required' };
  return metaWrite(env, `/${act(accountId)}/customaudiences`, { name: body.name, subtype: body.subtype, description: body.description, customer_file_source: body.customer_file_source, rule: body.rule, retention_days: body.retention_days }, 'POST');
}
export async function createLookalike(env, accountId, body = {}) {
  if (!body.name || !body.origin_audience_id) return { ok: false, status: 400, error: 'name and origin_audience_id required' };
  const spec = body.lookalike_spec || { type: 'similarity', country: body.country || 'US', origin: [{ id: body.origin_audience_id }], ratio: body.ratio || 0.01 };
  return metaWrite(env, `/${act(accountId)}/customaudiences`, { name: body.name, subtype: 'LOOKALIKE', origin_audience_id: body.origin_audience_id, lookalike_spec: spec }, 'POST');
}

// ---- A/B tests & lift studies ----------------------------------------------
export async function listStudies(env) {
  return metaPaginate(env, `/${business(env)}/ad_studies`, { fields: 'id,name,type,status,start_time,end_time,description', limit: '100' });
}
export async function getStudy(env, studyId) {
  return metaFetch(env, `/${studyId}`, { fields: 'id,name,type,status,start_time,end_time,description,cells,objectives' });
}

// ---- Activity logs ---------------------------------------------------------
export async function listActivities(env, accountId, { limit = 100 } = {}) {
  return metaPaginate(env, `/${act(accountId)}/activities`, { fields: 'event_type,event_time,actor_id,actor_name,object_id,object_name,object_type,extra_data,translated_event_type', limit: String(limit) }, 5);
}

// ---- Portfolio (businesses, pages, all accounts + spend) -------------------
export async function listBusinesses(env) {
  return metaPaginate(env, '/me/businesses', { fields: 'id,name,verification_status,created_time', limit: '100' });
}
export async function listPages(env) {
  return metaPaginate(env, '/me/accounts', { fields: 'id,name,category,link,tasks', limit: '100' });
}
export async function portfolio(env) {
  const acc = await metaPaginate(env, '/me/adaccounts', { fields: 'id,account_id,name,account_status,currency,amount_spent,spend_cap,business{id,name}', limit: '200' });
  if (!acc.ok) return acc;
  const accounts = (acc.data.data || []).map((a) => ({ ...a, amount_spent_usd: Number(a.amount_spent || 0) / 100 })).sort((a, b) => Number(b.amount_spent || 0) - Number(a.amount_spent || 0));
  const total = accounts.reduce((s, a) => s + Number(a.amount_spent || 0), 0);
  const byBusiness = {};
  for (const a of accounts) { const b = (a.business && a.business.name) || 'unassigned'; byBusiness[b] = (byBusiness[b] || 0) + Number(a.amount_spent || 0); }
  const [biz, pages] = await Promise.all([listBusinesses(env), listPages(env)]);
  return {
    ok: true, data: {
      account_count: accounts.length, total_spent_cents: total, total_spent_usd: total / 100,
      spend_by_business: byBusiness, accounts,
      businesses: biz.ok ? biz.data.data : [], business_count: biz.ok ? (biz.data.data || []).length : 0,
      pages: pages.ok ? pages.data.data : [], page_count: pages.ok ? (pages.data.data || []).length : 0,
    },
  };
}

// ---- Media -----------------------------------------------------------------
export async function listAdVideos(env, accountId) {
  return metaPaginate(env, `/${act(accountId)}/advideos`, { fields: 'id,title,description,created_time,length,thumbnails{uri}', limit: '100' });
}

// ---- Meta hosted Ads MCP proxy ---------------------------------------------
/** JSON-RPC to Meta's hosted MCP server with the account access token. */
async function mcpRpc(env, method, params) {
  const t = await token(env);
  if (!t) return { ok: false, status: 0, error: 'META_ACCESS_TOKEN not set' };
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || {} }),
  });
  const text = await r.text();
  let data = null;
  // hosted MCP may reply as SSE; extract the JSON data line if so
  try { data = JSON.parse(text); } catch {
    const line = text.split('\n').find((l) => l.startsWith('data:'));
    if (line) { try { data = JSON.parse(line.slice(5).trim()); } catch { data = { raw: text.slice(0, 2000) }; } }
    else data = { raw: text.slice(0, 2000) };
  }
  return { ok: r.ok, status: r.status, data };
}
export async function mcpToolsList(env) { return mcpRpc(env, 'tools/list', {}); }
export async function mcpToolCall(env, name, args) { return mcpRpc(env, 'tools/call', { name, arguments: args || {} }); }
