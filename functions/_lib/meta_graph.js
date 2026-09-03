/** Meta Marketing API helpers — live Graph reads with pagination. */

const API_VERSION = 'v22.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

let bridgeToken = null;
/**
 * Resolve the Meta token bridge-first. The loop-meta-bridge worker binds the shared
 * Secrets Store token by reference (rotated in one place, always fresh); the Pages
 * project cannot bind the store, and its per-project META_ACCESS_TOKEN copy expired
 * 2026-07-17 and silently killed portfolio/catalog/ad-write calls. env copy is the
 * fallback only.
 */
export async function metaToken(env) {
  if (bridgeToken) return bridgeToken;
  if (env.META_BRIDGE) {
    try {
      const r = await env.META_BRIDGE.fetch('https://bridge/token');
      if (r.ok) {
        const j = await r.json();
        if (j && j.token) { bridgeToken = j.token; return bridgeToken; }
      }
    } catch {}
  }
  return env.META_ACCESS_TOKEN || null;
}

export async function metaFetch(env, path, query = {}) {
  const t = await metaToken(env);
  if (!t) return { ok: false, error: 'META_ACCESS_TOKEN not set', status: 0, data: null };
  const u = new URL(path.startsWith('http') ? path : BASE + (path.startsWith('/') ? path : '/' + path));
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  }
  u.searchParams.set('access_token', t);
  const r = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data, text };
}

export async function metaPaginate(env, firstPath, query = {}, maxPages = 20) {
  const rows = [];
  let url = null;
  const first = await metaFetch(env, firstPath, query);
  if (!first.ok) return first;
  let page = first.data;
  for (let i = 0; i < maxPages && page; i++) {
    if (Array.isArray(page.data)) rows.push(...page.data);
    url = page.paging?.next || null;
    if (!url) break;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    try { page = JSON.parse(text); } catch { break; }
  }
  return { ok: true, status: 200, data: { data: rows, count: rows.length }, text: null };
}

/**
 * Live ad accounts. Prefer loop-meta-bridge (Secrets Store token with ads_read /
 * user-authorized acts). Pages META_ACCESS_TOKEN is often a system-user without
 * business_management — that path alone yields the OAuth 100/200 errors on
 * owned_ad_accounts + /me/adaccounts and empties the Marketing admin SSR.
 */
export async function listAllAdAccounts(env) {
  if (env.META_BRIDGE) {
    try {
      const r = await env.META_BRIDGE.fetch('https://bridge/accounts');
      const j = await r.json();
      if (r.ok && !j.error) {
        const accounts = (j.accounts || []).map((a) => {
          const account_id = String(a.account_id || (a.id || '').replace(/^act_/, ''));
          const id = a.id && String(a.id).startsWith('act_') ? a.id : (account_id ? 'act_' + account_id : a.id);
          return { ...a, id, account_id };
        });
        return {
          ok: accounts.length > 0,
          source: j.source || 'meta_bridge',
          business_id: null,
          count: accounts.length,
          accounts,
          errors: j.errors,
        };
      }
      // fall through to direct Graph if bridge returned an error body
    } catch {
      // fall through
    }
  }

  const biz = env.META_BUSINESS_ID || '1602361853681297';
  const fields = 'id,account_id,name,account_status,currency,timezone_name,amount_spent,balance';
  const seen = new Set();
  const accounts = [];

  async function pull(path) {
    const res = await metaPaginate(env, path, { fields, limit: '200' });
    if (!res.ok) return res;
    for (const a of res.data.data || []) {
      const id = a.id || (a.account_id ? `act_${a.account_id}` : '');
      if (id && !seen.has(id)) { seen.add(id); accounts.push({ ...a, id }); }
    }
    return { ok: true };
  }

  // Prefer /me/adaccounts first (authorized acts / AdsPower). Business edges need
  // business_management and often fail on system-user tokens.
  const paths = [
    '/me/adaccounts',
    `/${biz}/owned_ad_accounts`,
    `/${biz}/client_ad_accounts`,
  ];
  const errors = [];
  for (const p of paths) {
    const r = await pull(p);
    if (!r.ok) errors.push({ path: p, error: r.error || r.data });
  }
  return {
    ok: accounts.length > 0,
    source: 'pages_meta_access_token',
    business_id: biz,
    count: accounts.length,
    accounts,
    errors: errors.length ? errors : undefined,
  };
}

export async function listCampaigns(env, accountId) {
  const act = String(accountId || '').startsWith('act_') ? accountId : `act_${accountId}`;
  return metaPaginate(env, `/${act}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time',
    limit: '250',
  });
}

export async function listAdsets(env, accountId) {
  const act = String(accountId || '').startsWith('act_') ? accountId : `act_${accountId}`;
  return metaPaginate(env, `/${act}/adsets`, {
    fields: 'id,name,status,daily_budget,campaign_id,effective_status',
    limit: '250',
  });
}

export async function listAds(env, accountId) {
  const act = String(accountId || '').startsWith('act_') ? accountId : `act_${accountId}`;
  return metaPaginate(env, `/${act}/ads`, {
    fields: 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,thumbnail_url}',
    limit: '250',
  });
}

export async function listAdCreatives(env, accountId) {
  const act = String(accountId || '').startsWith('act_') ? accountId : `act_${accountId}`;
  return metaPaginate(env, `/${act}/adcreatives`, {
    fields: 'id,name,title,body,image_url,thumbnail_url,object_story_spec,call_to_action_type,link_url',
    limit: '250',
  });
}

export async function listAdImages(env, accountId) {
  const act = String(accountId || '').startsWith('act_') ? accountId : `act_${accountId}`;
  return metaPaginate(env, `/${act}/adimages`, {
    fields: 'id,name,url,hash,width,height',
    limit: '250',
  });
}