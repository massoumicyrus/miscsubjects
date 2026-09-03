// JustCloakIt (JCI) Enterprise REST classify + ledger capture.
// Ported from the lbl.fyi loop-cloaker-router build. Every classify lands in the miscsubjects
// ledger as source='jci' so it filters like any other source (service=jci). Each visit is keyed
// to a STABLE hashed-IP actor (ip:<hash>) so one visitor's loads stitch into a single identity;
// when a drop/share token is present the actor is tok:<token>, and both carry the visitor's
// hashed IP so an IP that also touches a token merges into one ticket. The raw JCI request +
// response are preserved verbatim (request_json / response_json / R2 for large ones).

import { logEvent } from './event_log.js';

const JCI_API_BASE_DEFAULT = 'https://jcibj.com/lapi/rest/r/';
const JCI_USER_ID_DEFAULT = 'oiuxp3vylhcgnp0opa89dlomb';
// Stitch salt — not a secret, only stabilizes the visitor hash so the raw IP is never logged.
const IP_SALT = 'miscsubjects-jci-stitch-v1';

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(input)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Stable stitch hash of a raw IP — same output everywhere (visit capture + owner recording) so an
// identity's hashed_ip matches. Never store or return the raw IP.
export async function hashVisitorIp(ip) {
  if (!ip) return null;
  return (await sha256Hex((ip || '') + '|' + IP_SALT)).slice(0, 24);
}

function safeQuery(url) {
  const p = new URLSearchParams(url.search);
  for (const key of ['share', 'terminal_key', 'tk', 'token', 'key', 'api_key']) {
    if (p.has(key)) p.set(key, '<redacted>');
  }
  const out = p.toString();
  return out ? '?' + out : '';
}

function safeJciResponse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  delete out.ip;
  delete out.host;
  return out;
}

// Record every request that reaches miscsubjects.com. External JCI classification is separately
// cached per visitor; these ingress rows are never throttled, so APIs, admin, assets, methods,
// redirects, bots, and ordinary pages all remain visible as real-time traffic.
export async function logJciTraffic(env, request) {
  const url = new URL(request.url);
  const hashedIp = await hashVisitorIp(request.headers.get('cf-connecting-ip') || '');
  const actor = hashedIp ? 'ip:' + hashedIp : 'unknown';
  const cf = request.cf || {};
  return logEvent(env, {
    source: 'jci', key: 'JCI_TRAFFIC', action: 'request', direction: 'in', status: 200,
    actor, route: url.pathname,
    request: {
      method: request.method,
      path: url.pathname,
      query: safeQuery(url),
      useragent: request.headers.get('user-agent') || '',
      language: request.headers.get('accept-language') || '',
      referer: request.headers.get('referer') || '',
      visitor: hashedIp,
      ray: request.headers.get('cf-ray') || '',
    },
    response: {
      country: cf.country || request.headers.get('cf-ipcountry') || null,
      region: cf.region || null,
      city: cf.city || null,
      colo: cf.colo || null,
      asn: cf.asn || null,
    },
  });
}

// Call the JCI classifier for one visitor. No secret key — the user_id is the credential.
export async function jciClassify(env, visitor = {}) {
  const base = String(env.JCI_API_BASE || JCI_API_BASE_DEFAULT).replace(/\/+$/, '');
  const uid = env.JCI_USER_ID || JCI_USER_ID_DEFAULT;
  const body = new URLSearchParams();
  body.set('ip', visitor.ip || '');
  body.set('ua', visitor.ua || '');
  body.set('lan', visitor.lan || '');
  body.set('ref', visitor.ref || '');
  body.set('qu', visitor.qu || '');
  if (visitor.inc_loc) body.set('inc_loc', visitor.inc_loc);
  const url = base + '/' + uid;
  let status = 0, raw = '', json = null;
  try {
    const r = await fetch(url, {
      method: 'POST', body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    status = r.status;
    raw = await r.text();
    try { json = JSON.parse(raw); } catch {}
  } catch (e) { raw = String((e && e.message) || e); }
  return { status, json, raw, url, apiBody: body.toString() };
}

// Log one JCI classify to the ledger. Actor stitches the visitor; raw IP is never stored.
export async function logJciVisit(env, { visitor = {}, result, slug = '', token = null }) {
  const hashedIp = await hashVisitorIp(visitor.ip);
  const actor = token ? ('tok:' + String(token).slice(0, 24)) : (hashedIp ? ('ip:' + hashedIp) : 'unknown');
  const j = (result && result.json) || {};
  const safeVisitor = { ...visitor, ip: hashedIp ? ('sha256:' + hashedIp) : '' };
  const safeBody = result && result.apiBody ? '<redacted-ip-form-body>' : '';
  const tokenFingerprint = token ? (await sha256Hex(String(token))).slice(0, 16) : null;
  await logEvent(env, {
    source: 'jci',
    key: 'JCI_CLASSIFY',
    action: 'classify',
    direction: 'out',
    status: (result && result.status) || 0,
    actor,
    route: slug || null,
    request: { url: result && result.url, body: safeBody, visitor: safeVisitor, slug, token_fingerprint: tokenFingerprint, hashed_ip: hashedIp },
    response: safeJciResponse((result && result.json) || (result && result.raw) || null),
  });
  return {
    actor,
    hashed_ip: hashedIp,
    classification: j.type === 'false' ? 'human' : j.type === 'true' ? 'bot' : 'unknown',
    isp: j.isp || null, org: j.org || null, country: j.country || null,
    region: j.region || null, city: j.city || null, device: j.device || null,
    browser: j.browser || null, os: j.os || null, connection: j['connection type'] || null,
  };
}

// Server-side one-shot: read the current request's visitor, classify, log. Safe to waitUntil().
export async function jciTrack(env, request, opts = {}) {
  const url = new URL(request.url);
  const visitor = {
    ip: request.headers.get('cf-connecting-ip') || '',
    ua: request.headers.get('user-agent') || '',
    lan: request.headers.get('accept-language') || '',
    ref: request.headers.get('referer') || url.searchParams.get('r') || '',
    qu: url.search.replace(/^\?/, ''),
    inc_loc: opts.inc_loc,
  };
  const result = await jciClassify(env, visitor);
  const token = opts.token || url.searchParams.get('share') || url.searchParams.get('tk') || url.searchParams.get('terminal_key') || null;
  const summary = await logJciVisit(env, { visitor, result, slug: opts.slug || url.pathname, token });
  return { ...summary, status: result.status };
}
