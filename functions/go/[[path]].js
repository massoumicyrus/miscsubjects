
import { decide, resolveDestination } from '../_lib/traffic/engine.js';
import { loadSnapshot, consumeGrant, ledger, tenantOf } from '../_lib/traffic/store.js';
import { verifyGrant, signCookie } from '../_lib/traffic/grants.js';
import { pickSqueezePage, issueCode, composeMessage } from '../_lib/traffic/funnel.js';
import {
  renderInlineDestination, renderAckPage, renderDenyPage, renderUnavailablePage,
  renderStaticPage, renderSqueezePage,
} from '../_lib/traffic/render.js';
import { renderChallengePage, TURNSTILE_CSP } from '../_lib/traffic/turnstile.js';

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

function withCookies(headers, cookies_to_set) {
  const h = new Headers(headers);
  for (const [name, val, maxAge] of cookies_to_set || []) {
    h.append('set-cookie', `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`);
  }
  return h;
}

/** Redirect URL with attribution/query passthrough per the destination policy. */
function buildRedirect(dest, ctx, reqUrl) {
  let target;
  try { target = new URL(dest.url); } catch { return dest.url; }
  const src = reqUrl.searchParams;
  const pass = dest.query_passthrough || 'attribution';
  const attributionKeys = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid', 'msclkid']);
  if (pass === 'all') { for (const [k, v] of src) if (!target.searchParams.has(k)) target.searchParams.set(k, v); }
  else if (pass === 'attribution' && Number(dest.attribution_passthrough)) { for (const [k, v] of src) if (attributionKeys.has(k) && !target.searchParams.has(k)) target.searchParams.set(k, v); }
  return target.toString();
}

async function renderDecision(context, out, reqUrl) {
  const { env } = context;
  const { decision, ctx, snapshot, ruleset, campaign, cookies_to_set, deviceId } = out;
  const exp = decision.experience;

  if (exp === 'VERIFY') {
    const sitekey = env.TURNSTILE_SITEKEY || '';
    const page = renderChallengePage({ sitekey, returnTo: reqUrl.pathname + reqUrl.search, decisionId: decision.decision_id, reason: decision.reason || '' });
    return new Response(page, { status: 200, headers: withCookies({ ...HTML, 'content-security-policy': TURNSTILE_CSP }, cookies_to_set) });
  }
  if (exp === 'ACK') {
    const meta = decision.experience_meta || {};
    return new Response(renderAckPage({ decision, meta, returnTo: reqUrl.pathname + reqUrl.search, csrf: '' }), { status: 200, headers: withCookies(HTML, cookies_to_set) });
  }
  if (exp === 'DENY') return new Response(renderDenyPage(decision, (decision.experience_meta || {}).message), { status: 403, headers: withCookies(HTML, cookies_to_set) });
  if (exp === 'STATIC') return new Response(renderStaticPage(decision, (decision.experience_meta || {}).html || ruleset?.static_html), { status: 200, headers: withCookies(HTML, cookies_to_set) });
  if (exp === 'UNAVAILABLE') { const st = (decision.experience_meta || {}).status || 503; return new Response(renderUnavailablePage(decision, st), { status: st, headers: withCookies(HTML, cookies_to_set) }); }

  if (exp === 'SQUEEZE') {
    const camp = campaign;
    const picked = camp ? await pickSqueezePage(env, { tenant: out.snapshot.tenant, campaign: camp, ctx, nowIso: decision.ts }) : { page: null };
    if (!picked.page) return new Response(renderUnavailablePage(decision, 503), { status: 503, headers: withCookies(HTML, cookies_to_set) });
    const issued = await issueCode(env, { tenant: out.snapshot.tenant, campaign: camp, page: picked.page, decision, ctx });
    const phone = picked.page.phone || camp.sms_phone;
    const channel = picked.page.channel || camp.sms_channel || 'blooio';
    const message = composeMessage(picked.page.message_template || camp.sms_message_template, issued.code);
    const statusUrl = `/api/traffic/sms/status?code=${encodeURIComponent(issued.code)}`;
    const tapUrl = '/api/traffic/sms/tap';
    const page = renderSqueezePage({ page: picked.page, campaign: camp, code: issued.code, decision, phone, channel, message, statusUrl, tapUrl });
    return new Response(page, { status: 200, headers: withCookies(HTML, cookies_to_set) });
  }

  // No experience: a concrete destination was chosen.
  const dest = decision.destination;
  if (!dest) return new Response(renderUnavailablePage(decision, 503), { status: 503, headers: withCookies(HTML, cookies_to_set) });
  if (dest.type === 'redirect') {
    const loc = buildRedirect({ ...snapshot.destinations[dest.id], ...dest }, ctx, reqUrl);
    return new Response(null, { status: 302, headers: withCookies({ ...HTML, location: loc }, cookies_to_set) });
  }
  if (dest.type === 'proxy') {
    try {
      const upstream = await fetch(dest.url, { headers: { 'user-agent': ctx.request.user_agent || '', 'accept-language': ctx.request.language || '' } });
      const h = withCookies({ 'content-type': upstream.headers.get('content-type') || 'text/html; charset=utf-8', 'cache-control': 'no-store' }, cookies_to_set);
      return new Response(upstream.body, { status: upstream.status, headers: h });
    } catch (e) {
      return new Response(renderUnavailablePage({ ...decision, reason: 'proxy_unreachable' }, 502), { status: 502, headers: withCookies(HTML, cookies_to_set) });
    }
  }
  // inline / static destination html
  return new Response(renderInlineDestination(snapshot.destinations[dest.id] || dest, decision), { status: 200, headers: withCookies(HTML, cookies_to_set) });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/go\/?/, '').split('/').filter(Boolean);
  const tenant = tenantOf(url.searchParams.get('t') || env.TRAFFIC_TENANT || 't_root');

  // grant redeem: /go/_/enter?g=<token>
  if (parts[0] === '_' && parts[1] === 'enter') {
    const token = url.searchParams.get('g') || '';
    const v = await verifyGrant(env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '', token, { aud: url.hostname });
    if (!v.ok) return new Response(`<!doctype html><meta charset=utf-8><title>Link not valid</title><h1>This link is not valid</h1><p>${v.error}</p>`, { status: 403, headers: HTML });
    const consumed = await consumeGrant(env, { tenant, payload: v.payload, consumer: request.headers.get('cf-connecting-ip') || 'redeem' });
    if (!consumed.ok) return new Response(`<!doctype html><meta charset=utf-8><title>Link already used</title><h1>This link was already used</h1>`, { status: 410, headers: HTML });
    const snap = await loadSnapshot(env, tenant);
    const r = await resolveDestination(snap, v.payload.dest, {});
    await ledger(env, { key: 'TRAFFIC_GRANT_REDEEM', action: 'redeem', route: '/go/_/enter', trace_id: v.payload.jti, request: { dest: v.payload.dest, aud: v.payload.aud }, response: { first: consumed.first, destination: r.destination?.id || null } });
    if (r.destination?.type === 'redirect' && r.destination.url) {
      const cookie = await signCookie(env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '', { d: v.payload.dev, dest: v.payload.dest, exp: v.payload.exp });
      const h = new Headers({ ...HTML, location: r.destination.url });
      h.append('set-cookie', `ms_gs=${encodeURIComponent(cookie)}; Path=/; Max-Age=${Math.max(60, v.payload.exp - Math.floor(Date.now() / 1000))}; SameSite=Lax; Secure; HttpOnly`);
      return new Response(null, { status: 302, headers: h });
    }
    if (r.destination) return new Response(renderInlineDestination(r.destination, { decision_id: v.payload.dec || v.payload.jti, destination_id: r.destination.id }), { status: 200, headers: HTML });
    return new Response(renderUnavailablePage({ decision_id: v.payload.jti, reason: 'granted destination unavailable' }, 503), { status: 503, headers: HTML });
  }

  // one destination by id: /go/_/dest/<id>
  if (parts[0] === '_' && parts[1] === 'dest' && parts[2]) {
    const snap = await loadSnapshot(env, tenant);
    const r = await resolveDestination(snap, parts[2], {});
    if (!r.destination) return new Response(renderUnavailablePage({ decision_id: 'dest', reason: r.reason }, 404), { status: 404, headers: HTML });
    if (r.destination.type === 'redirect' && r.destination.url) return new Response(null, { status: 302, headers: { ...HTML, location: r.destination.url } });
    return new Response(renderInlineDestination(r.destination, { decision_id: 'dest', destination_id: r.destination.id }), { status: 200, headers: HTML });
  }

  const entry = parts[0] || null;
  const out = await decide(env, { request, url, tenant, entry, waitUntil: context.waitUntil ? context.waitUntil.bind(context) : null });
  return renderDecision(context, out, url);
}
