// loop-meta-bridge — single Meta owner. Binds the shared Secrets Store Meta token
// by reference and fronts the Graph API read surface. Reachable only via service
// binding (workers_dev=false), so no public exposure and no auth secret to manage.
//
// Routes (called as https://bridge/<path> through env.META_BRIDGE.fetch):
//   GET /health          — token present + a live /me ping (surfaces permission errors)
//   GET /accounts        — live owned/authorized ad accounts
//   GET /insights?preset=last_7d&level=account  — per-account insights (spend/roas/etc)
//
// It NEVER writes and NEVER spends. Read-only. reasoning-free. No D1.

async function readSecret(b) { try { return b ? await b.get() : null; } catch { return null; } }

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json' } });
}

async function graph(base, path, token, params = {}) {
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', token);
  const r = await fetch(u.toString());
  let j; try { j = await r.json(); } catch { j = { error: { message: 'non-json response', status: r.status } }; }
  return { ok: r.ok, status: r.status, body: j };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const token = await readSecret(env.META_ACCESS_TOKEN);
    const biz = await readSecret(env.META_BUSINESS_ID);
    const ver = (await readSecret(env.META_API_VERSION)) || 'v25.0';
    const base = `https://graph.facebook.com/${ver}`;
    if (!token) return json({ error: 'META_ACCESS_TOKEN not bound to bridge' }, 500);

    try {
      if (p === '/token') {
        // Service-binding-only worker (workers_dev=false, no route): callers are other
        // build workers. Hands the Secrets Store token to the Pages runtime, which
        // cannot bind the store itself (wrangler rejects secrets_store_secrets for
        // Pages) — its per-project copy went stale 2026-07-17 and broke every direct
        // Graph call (portfolio, catalogs, ad writes) while bridge lanes stayed live.
        return json({ token });
      }

      if (p === '/health') {
        const me = await graph(base, '/me', token, { fields: 'id,name' });
        return json({ ok: me.ok, token_present: true, api_version: ver, business_id: biz || null, me: me.body });
      }

      if (p === '/accounts') {
        // Union of business-OWNED and user-AUTHORIZED accounts, deduped. His live
        // accounts are authorized (via AdsPower identities), not business-owned, so
        // owned_ad_accounts alone misses them — /me/adaccounts catches the rest.
        const fields = 'id,account_id,name,account_status,currency,timezone_name,amount_spent';
        const byId = {};
        const sources = [];
        const errors = [];
        if (biz) {
          const owned = await graph(base, `/${biz}/owned_ad_accounts`, token, { fields, limit: '500' });
          if (owned.ok && Array.isArray(owned.body.data)) { owned.body.data.forEach(a => { byId[a.account_id || a.id] = { ...a, _via: 'owned' }; }); sources.push('owned_ad_accounts'); }
          else errors.push({ where: 'owned_ad_accounts', status: owned.status, detail: owned.body.error || owned.body });
        }
        const me = await graph(base, '/me/adaccounts', token, { fields, limit: '500' });
        if (me.ok && Array.isArray(me.body.data)) { me.body.data.forEach(a => { const k = a.account_id || a.id; if (!byId[k]) byId[k] = { ...a, _via: 'authorized' }; }); sources.push('me_adaccounts'); }
        else errors.push({ where: 'me_adaccounts', status: me.status, detail: me.body.error || me.body });
        const accounts = Object.values(byId);
        return json({ source: sources.join('+'), count: accounts.length, accounts, errors: errors.length ? errors : undefined });
      }

      if (p === '/insights') {
        const preset = url.searchParams.get('preset') || 'last_7d';
        const level = url.searchParams.get('level') || 'account';
        // Account list: explicit ?accounts=act_x,act_y, else same union as /accounts
        // (owned + /me authorized). Do NOT use owned-only when biz is set — that
        // misses AdsPower-authorized acts and only hits "DO NOT USE" owned rows.
        let actIds = (url.searchParams.get('accounts') || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!actIds.length) {
          const byId = {};
          if (biz) {
            const owned = await graph(base, `/${biz}/owned_ad_accounts`, token, { fields: 'id', limit: '200' });
            if (owned.ok && Array.isArray(owned.body.data)) {
              owned.body.data.forEach((a) => { if (a.id) byId[a.id] = a.id; });
            }
          }
          const me = await graph(base, '/me/adaccounts', token, { fields: 'id', limit: '200' });
          if (me.ok && Array.isArray(me.body.data)) {
            me.body.data.forEach((a) => { if (a.id) byId[a.id] = a.id; });
          }
          actIds = Object.values(byId);
        }
        const fields = 'account_id,account_name,spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,actions,action_values,purchase_roas';
        const out = [];
        const errors = [];
        for (const act of actIds.slice(0, 30)) {
          const ins = await graph(base, `/${act}/insights`, token, { level, date_preset: preset, fields, limit: '50' });
          if (ins.ok && Array.isArray(ins.body.data)) out.push({ account: act, rows: ins.body.data });
          else errors.push({ account: act, status: ins.status, detail: ins.body.error || ins.body });
        }
        return json({ preset, level, accounts_queried: actIds.length, results: out, errors });
      }

      return json({ ok: true, bridge: 'loop-meta-bridge', routes: ['/token', '/health', '/accounts', '/insights'] });
    } catch (e) {
      return json({ error: 'bridge_exception', detail: String(e && e.message || e) }, 500);
    }
  },
};
