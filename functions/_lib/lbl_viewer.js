/** Read lbl.fyi viewer APIs (cookie auth via LBL_VIEWER_PASS). */

const LBL_ORIGIN = 'https://lbl.fyi';

export async function lblViewerFetch(env, path, opts = {}) {
  const pass = env.LBL_VIEWER_PASS;
  if (!pass) {
    return { ok: false, status: 0, error: 'LBL_VIEWER_PASS not set on miscsubjects build', data: null };
  }
  const p = String(path || '').startsWith('/') ? path : '/' + path;
  const url = (opts.origin || LBL_ORIGIN) + p;
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: `lbl_auth=${encodeURIComponent(pass)}`,
      ...(opts.headers || {}),
    },
    body: opts.body || undefined,
  });
  const text = await r.text();
  if (!r.ok) {
    const isHtml = text.trimStart().startsWith('<!');
    return {
      ok: false,
      status: r.status,
      error: isHtml ? 'lbl_viewer_auth_failed' : text.slice(0, 500),
      data: null,
    };
  }
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: true, status: r.status, data, text };
}

export async function lblMetaAccounts(env) {
  return lblViewerFetch(env, '/api/meta/accounts');
}

export async function lblMetaCreatives(env) {
  return lblViewerFetch(env, '/api/meta/creatives');
}

export async function lblMetaTotals(env) {
  return lblViewerFetch(env, '/api/meta/totals');
}

export async function lblCloakerEvents(env, limit = 50) {
  return lblViewerFetch(env, `/api/cloaker-events?limit=${Math.min(Number(limit) || 50, 200)}`);
}

export async function lblIntelligence(env) {
  return lblViewerFetch(env, '/api/intelligence');
}

export async function lblSyncMetaBackfill(env) {
  const r = await fetch('https://api.lbl.fyi/v1/sync/meta/insights_backfill', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: '{}',
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}