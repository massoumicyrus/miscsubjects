const PROJECT = 'loop-safe-miscsubjects';
function accountId(env) { return env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || ''; }
function storeId(env) { return env.SECRETS_STORE_ID || ''; }

// Mapping of Pages binding name → name of the secret inside the central store.
const BINDINGS = {
  CLOUDFLARE_API_TOKEN:     'CLOUDFLARE_API_TOKEN',
  CLOUDFLARE_ACCOUNT_ID:    'CLOUDFLARE_ACCOUNT_ID',
  META_CAPI_TOKEN:          'META_CAPI_TOKEN',
  META_PIXEL_TOKEN:         'META_PIXEL_TOKEN',
  META_ACCESS_TOKEN:        'META_ACCESS_TOKEN',
  META_BUSINESS_ID:         'META_BUSINESS_ID',
  META_API_VERSION:         'META_API_VERSION',
  KLAVIYO_KEY:              'KLAVIYO_KEY',
  TRIPLEWHALE_API_KEY:      'TRIPLEWHALE_API_KEY',
  TRIPLEWHALE_SHOP_DOMAIN:  'TRIPLEWHALE_SHOP_DOMAIN',
  GITHUB_TOKEN:             'GITHUB_TOKEN',
  GEMINI_API_KEY:           'GEMINI_API_KEY',
  BIGCOMMERCE_TOKEN:        'BIGCOMMERCE_TOKEN',
  BIGCOMMERCE_STORE_HASH:   'BIGCOMMERCE_STORE_HASH',
  BLOOIO_FROM_NUMBER:       'BLOOIO_FROM_NUMBER',
  TWOCHAT_API_KEY:          'TWOCHAT_API_KEY',
};

export async function onRequestGet({ env }) {
  if (!env.CLOUDFLARE_API_TOKEN) return new Response(JSON.stringify({ error: 'CLOUDFLARE_API_TOKEN env var missing' }), { status: 500 });
  const ACCT = accountId(env);
  if (!ACCT) return new Response(JSON.stringify({ error: 'CF_ACCOUNT_ID env var missing' }), { status: 500 });
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/pages/projects/${PROJECT}`;
  const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + env.CLOUDFLARE_API_TOKEN } });
  const j = await r.json();
  const prod = j?.result?.deployment_configs?.production || {};
  return new Response(JSON.stringify({
    status: r.status,
    env_vars: Object.keys(prod.env_vars || {}),
    secrets_store_secrets: prod.secrets_store_secrets || null,
    d1: Object.keys(prod.d1_databases || {}),
    r2: Object.keys(prod.r2_buckets || {}),
    kv: Object.keys(prod.kv_namespaces || {}),
  }, null, 2), { headers: { 'content-type': 'application/json' } });
}

export async function onRequestPost({ env }) {
  if (!env.CLOUDFLARE_API_TOKEN) return new Response(JSON.stringify({ error: 'CLOUDFLARE_API_TOKEN env var missing' }), { status: 500 });
  const ACCT = accountId(env);
  const STORE = storeId(env);
  if (!ACCT) return new Response(JSON.stringify({ error: 'CF_ACCOUNT_ID env var missing' }), { status: 500 });
  if (!STORE) return new Response(JSON.stringify({ error: 'SECRETS_STORE_ID env var missing' }), { status: 500 });
  const sss = {};
  for (const [bind, secret] of Object.entries(BINDINGS)) {
    sss[bind] = { store_id: STORE, secret_name: secret, type: 'secret_text' };
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/pages/projects/${PROJECT}`;
  const payload = { deployment_configs: { production: { secrets_store_secrets: sss } } };
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + env.CLOUDFLARE_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  const prod = parsed?.result?.deployment_configs?.production || {};
  return new Response(JSON.stringify({
    status: r.status,
    sent_bindings: Object.keys(BINDINGS),
    server_now_has_secrets_store_secrets: prod.secrets_store_secrets || null,
    full_response: parsed,
  }, null, 2), { headers: { 'content-type': 'application/json' } });
}
