// OAuth 1.0a (HMAC-SHA1) for X API user-context requests (Workers crypto.subtle).

function percentEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function nonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function xWriteFailureMessage(status, raw, whoamiStatus) {
  if (Number(status) !== 401) return 'ERR:x_post:' + status + ':' + String(raw || '').slice(0, 400);
  if (Number(whoamiStatus) === 200) {
    return 'ERR:x_post:write_authority_rejected: X read authentication is live (GET /2/users/me = 200), but POST /2/tweets returned 401. Restore Read and write permission for the X app or replace the deployed access-token pair; then verify X_WHOAMI and retry once.';
  }
  return 'ERR:x_post:credential_pair_invalid: X rejected both POST /2/tweets and GET /2/users/me. Replace X_ACCESS_TOKEN and X_ACCESS_SECRET in the deployed runtime, verify X_WHOAMI returns 200, then retry once.';
}

/**
 * Build Authorization: OAuth header for a request.
 * env: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 * (aliases: X_CONSUMER_KEY / X_CONSUMER_SECRET)
 */
export async function xOAuth1Header(env, method, url) {
  const consumerKey = env.X_API_KEY || env.X_CONSUMER_KEY;
  const consumerSecret = env.X_API_SECRET || env.X_CONSUMER_SECRET;
  const token = env.X_ACCESS_TOKEN;
  const tokenSecret = env.X_ACCESS_SECRET;
  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    return { error: 'ERR:x_post:no_creds' };
  }

  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };

  const u = new URL(url);
  const paramPairs = [];
  for (const [k, v] of Object.entries(oauth)) {
    paramPairs.push([percentEncode(k), percentEncode(v)]);
  }
  u.searchParams.forEach((v, k) => {
    paramPairs.push([percentEncode(k), percentEncode(v)]);
  });
  paramPairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const paramString = paramPairs.map(([k, v]) => k + '=' + v).join('&');
  const baseUrl = u.origin + u.pathname;
  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join('&');

  const signingKey = percentEncode(consumerSecret) + '&' + percentEncode(tokenSecret);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(baseString));
  oauth.oauth_signature = b64(sigBuf);

  const header =
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => percentEncode(k) + '="' + percentEncode(oauth[k]) + '"')
      .join(', ');

  return { authorization: header };
}
