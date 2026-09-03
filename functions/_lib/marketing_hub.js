import { logEvent } from './event_log.js';
import {
  listAllAdAccounts, listCampaigns, listAdsets, listAds, listAdCreatives, listAdImages,
} from './meta_graph.js';
import {
  lblMetaAccounts, lblMetaCreatives, lblMetaTotals, lblCloakerEvents, lblSyncMetaBackfill,
} from './lbl_viewer.js';

export async function getMarketingState(env) {
  const row = await env.DB.prepare('SELECT value, updated_at FROM settings WHERE key = ?').bind('marketing_state').first();
  if (!row) return { focus: 'meta_ads_pivot', eagle_batch: 'eagle1-50', updated_at: null };
  try { return { ...JSON.parse(row.value), updated_at: row.updated_at }; } catch { return { raw: row.value, updated_at: row.updated_at }; }
}

export async function setMarketingState(env, patch) {
  const cur = await getMarketingState(env);
  const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
  delete next.updated_at;
  const ts = new Date().toISOString();
  const val = JSON.stringify(next);
  await env.DB.prepare(
    'INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)'
  ).bind('marketing_state', val, 'Model-facing marketing focus — accounts, creatives, funnel', ts).run();
  await logEvent(env, {
    source: 'marketing', key: 'MARKETING_STATE', action: 'settings_write', direction: 'out',
    status: 200, response: { keys: Object.keys(patch || {}) },
  });
  return { ok: true, state: next };
}

export async function marketingSnapshot(env) {
  const [state, liveAccounts, lblAccounts, lblCreatives, lblTotals, cloaker] = await Promise.all([
    getMarketingState(env),
    listAllAdAccounts(env),
    lblMetaAccounts(env),
    lblMetaCreatives(env),
    lblMetaTotals(env),
    lblCloakerEvents(env, 25),
  ]);
  return {
    ts: new Date().toISOString(),
    marketing_state: state,
    meta_live: {
      ok: liveAccounts.ok,
      count: liveAccounts.count,
      source: liveAccounts.source || null,
      accounts: (liveAccounts.accounts || []).slice(0, 50),
      errors: liveAccounts.errors,
    },
    lbl_cached: {
      accounts: lblAccounts.ok ? lblAccounts.data : { error: lblAccounts.error, status: lblAccounts.status },
      creatives: lblCreatives.ok ? { count: lblCreatives.data?.count, rows: (lblCreatives.data?.rows || []).slice(0, 20) } : { error: lblCreatives.error, status: lblCreatives.status },
      totals: lblTotals.ok ? lblTotals.data : { error: lblTotals.error, status: lblTotals.status },
      cloaker: cloaker.ok ? cloaker.data : { error: cloaker.error, status: cloaker.status },
      note: (!lblAccounts.ok || (lblAccounts.data?.count === 0))
        ? 'lbl.fyi auth may be ok while D1 cache is empty — run META_SYNC_BACKFILL / lbl sync jobs, or use meta_live from bridge'
        : null,
    },
  };
}

export async function marketingAccountsFull(env) {
  const live = await listAllAdAccounts(env);
  const lbl = await lblMetaAccounts(env);
  return {
    live: live,
    lbl_d1: lbl.ok ? lbl.data : { error: lbl.error, hint: 'Set LBL_VIEWER_PASS secret to lbl.fyi password' },
  };
}

export async function marketingAccountDetail(env, accountId) {
  const act = String(accountId || '');
  const [campaigns, adsets, ads, creatives, images] = await Promise.all([
    listCampaigns(env, act),
    listAdsets(env, act),
    listAds(env, act),
    listAdCreatives(env, act),
    listAdImages(env, act),
  ]);
  return {
    account_id: act,
    campaigns: campaigns.ok ? campaigns.data : { error: campaigns.data },
    adsets: adsets.ok ? adsets.data : { error: adsets.data },
    ads: ads.ok ? ads.data : { error: ads.data },
    creatives: creatives.ok ? creatives.data : { error: creatives.data },
    ad_images: images.ok ? images.data : { error: images.data },
  };
}

export async function triggerMetaSync(env, actor = 'marketing_hub') {
  const res = await lblSyncMetaBackfill(env);
  await logEvent(env, {
    source: 'marketing', key: 'META_SYNC_BACKFILL', action: 'meta_insights_backfill',
    direction: 'out', status: res.status, actor,
    request: { url: 'https://api.lbl.fyi/v1/sync/meta/insights_backfill' },
    response: res.data,
  });
  return res;
}

export async function knowledgeGet(env, topic) {
  const t = String(topic || '').trim().toUpperCase();
  const map = {
    CUSTOMER_FUNNEL: 'customer_funnel',
    AD_ACCOUNTS: 'ad_accounts_knowledge',
    LEO_RESEARCH: 'leo_research_knowledge',
    IMAGE_REFERENCE: 'image_reference_knowledge',
    REACTIONS: 'reactions_knowledge',
    BATCH: 'batch_knowledge',
    ARTICLE_LIST: 'article_list_knowledge',
    MARKETING_STATE: 'marketing_state',
  };
  if (t === 'MARKETING_STATE' || t === 'AD_ACCOUNTS') {
    const snap = await marketingSnapshot(env);
    await logEvent(env, {
      source: 'marketing', key: 'KNOWLEDGE', action: 'read', direction: 'in', status: 200,
      route: topic, response: { topic: t, live_count: snap.meta_live?.count },
    });
    return JSON.stringify(t === 'AD_ACCOUNTS' ? snap.meta_live : snap, null, 1);
  }
  const sk = map[t] || `knowledge_${t.toLowerCase()}`;
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(sk).first();
  if (row) return row.value;
  return `ERR:knowledge:unknown_topic:${t} — seed settings key ${sk}`;
}