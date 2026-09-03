import { buildReadAuthed } from '../../_lib/admin_session.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), { status, headers: JSON_HEADERS });

function parse(value) { try { return JSON.parse(value || '{}') || {}; } catch { return {}; } }
function text(value) { return String(value == null ? '' : value); }
function escCsv(value) { const s = text(value); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function requestKind(method, path) {
  const p = text(path);
  if (/\.(css|js|mjs|svg|png|jpe?g|gif|webp|woff2?|ico|json|txt|xml|map|pdf|mp4|webm)$/i.test(p)) return 'asset';
  if (p.startsWith('/api/')) return 'api';
  if (p.startsWith('/admin')) return 'admin';
  if (method === 'GET' || method === 'HEAD') return 'page';
  return 'request';
}

function audienceSegment(row) {
  const s = [row.useragent, row.isp, row.org, row.browser, row.device].join(' ').toLowerCase();
  if (/openai|gptbot|chatgpt-user|anthropic|claudebot|claude-web|perplexity|bytespider|cohere-ai|meta-externalagent|facebookexternalhit|amazonbot|applebot|diffbot|youbot/.test(s)) return 'ai_company';
  if (/googlebot|bingbot|yandexbot|duckduckbot|baiduspider|slurp|petalbot|semrushbot|ahrefsbot|mj12bot/.test(s)) return 'search_crawler';
  if (/bot|crawler|spider|headless|selenium|playwright|puppeteer|curl\/|wget\/|python-requests|go-http-client|node-fetch/.test(s) || row.classification === 'bot') return 'automation';
  if (row.classification === 'human') return 'likely_human';
  return 'unclassified';
}

function visitorSessions(rows, lifetime = new Map()) {
  const byVisitor = new Map();
  for (const row of rows) {
    const key = row.visitor || 'unknown';
    const list = byVisitor.get(key) || [];
    list.push(row);
    byVisitor.set(key, list);
  }
  const sessions = [];
  for (const [visitor, list] of byVisitor) {
    list.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    let current = null;
    for (const row of list) {
      const at = Date.parse(row.date);
      if (!current || !Number.isFinite(at) || at - current.last_ms > 30 * 60 * 1000) {
        current = { visitor, first_seen: row.date, last_seen: row.date, last_ms: at, requests: 0, pages: [], detail: row, referers: new Set() };
        sessions.push(current);
      }
      current.last_seen = row.date;
      current.last_ms = at;
      current.requests++;
      if (row.kind === 'page' || row.kind === 'admin') current.pages.push({ date: row.date, path: row.description });
      if (row.referer) current.referers.add(row.referer);
    }
  }
  const visitNumber = new Map();
  for (const session of [...sessions].sort((a, b) => Date.parse(a.first_seen) - Date.parse(b.first_seen))) {
    const n = (visitNumber.get(session.visitor) || 0) + 1;
    visitNumber.set(session.visitor, n);
    session.visit_number = n;
  }
  return sessions.sort((a, b) => Date.parse(b.last_seen) - Date.parse(a.last_seen)).map((session) => ({
    visitor: session.visitor, first_seen: session.first_seen, last_seen: session.last_seen,
    requests: session.requests, pages: session.pages,
    classification: session.detail.classification, isp: session.detail.isp, org: session.detail.org,
    connection: session.detail.connection, browser: session.detail.browser, os: session.detail.os,
    country: session.detail.country, region: session.detail.region, city: session.detail.city,
    device: session.detail.device, segment: session.detail.segment,
    page_count: session.pages.length, visit_number: session.visit_number,
    lifetime_visits: lifetime.get(session.visitor)?.visits || visitNumber.get(session.visitor) || 1,
    visitor_status: (lifetime.get(session.visitor)?.visits || visitNumber.get(session.visitor) || 1) > 1 ? 'returning' : 'new',
    lifetime_pages: lifetime.get(session.visitor)?.pages || session.pages.length,
    lifetime_requests: lifetime.get(session.visitor)?.requests || session.requests,
    first_ever_seen: lifetime.get(session.visitor)?.first_seen || session.first_seen,
    referers: [...session.referers],
  }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await buildReadAuthed(request, env))) return json({ error: 'not_found' }, 404);
  if (!env.LEDGER) return json({ error: 'no_ledger' }, 500);
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, Number(sp.get('page') || 1));
  const perPage = Math.min(100, Math.max(10, Number(sp.get('per_page') || 25)));

  // Window: how many recent traffic events the session builder sees. The old fixed 5000
  // silently truncated history once volume passed it (owner-caught 2026-07-30). Storage
  // was never at risk — every event stays in D1 — but sessions and lifetime stats were
  // computed from a shrinking window. Default is now 20000, raisable to 100000 via
  // ?window=; totals below disclose exactly how much of history the window covers.
  const window = Math.min(100000, Math.max(1000, Number(sp.get('window') || 20000)));
  const [trafficResult, classifyResult, totalRow, lifetimeAll] = await Promise.all([
    env.LEDGER.prepare("SELECT id,ts,actor,route,request_json,response_json FROM events WHERE source='jci' AND key='JCI_TRAFFIC' ORDER BY ts DESC LIMIT ?").bind(window).all(),
    env.LEDGER.prepare("SELECT ts,actor,request_json,response_json FROM events WHERE source='jci' AND key='JCI_CLASSIFY' ORDER BY ts DESC LIMIT 5000").all(),
    env.LEDGER.prepare("SELECT count(*) c, min(ts) first_ts FROM events WHERE source='jci' AND key='JCI_TRAFFIC'").first(),
    // Lifetime per visitor comes from SQL over FULL history — never from the window.
    env.LEDGER.prepare("SELECT actor, count(*) requests, min(ts) first_seen FROM events WHERE source='jci' AND key='JCI_TRAFFIC' GROUP BY actor").all(),
  ]);

  const enrichment = new Map();
  for (const event of classifyResult.results || []) {
    if (enrichment.has(event.actor)) continue;
    const req = parse(event.request_json);
    const res = parse(event.response_json);
    const actor = req.hashed_ip ? 'ip:' + req.hashed_ip : event.actor;
    enrichment.set(actor, {
      classification: res.type === 'false' ? 'human' : res.type === 'true' ? 'bot' : 'unknown',
      isp: res.isp || '', org: res.org || '', connection: res['connection type'] || '',
      browser: res.browser || '', os: res.os || '', country: res.country || '',
      region: res.region || '', city: res.city || '', device: res.device || '',
    });
  }

  let rows = (trafficResult.results || []).map((event) => {
    const req = parse(event.request_json);
    const edge = parse(event.response_json);
    const info = enrichment.get(event.actor) || {};
    return {
      id: event.id, date: event.ts, type: req.method || 'REQUEST',
      description: (req.path || event.route || '') + (req.query || ''),
      useragent: req.useragent || '', visitor: req.visitor || text(event.actor).replace(/^ip:/, ''),
      classification: info.classification || 'unclassified', isp: info.isp || '', org: info.org || '',
      connection: info.connection || '', browser: info.browser || '', os: info.os || '',
      country: info.country || edge.country || '', region: info.region || edge.region || '',
      city: info.city || edge.city || '', device: info.device || '', ray: req.ray || '',
      referer: req.referer || '', colo: edge.colo || '', asn: edge.asn || '',
      kind: requestKind(req.method || 'REQUEST', req.path || event.route || ''),
    };
  });
  rows = rows.map((row) => ({ ...row, segment: audienceSegment(row) }));

  // Lifetime visitor profiles are computed before display filters so “new/returning” and
  // visit counts remain honest even when the owner filters down to pages or likely humans.
  const allSessions = visitorSessions(rows);
  const lifetime = new Map();
  for (const session of allSessions) {
    const p = lifetime.get(session.visitor) || { first_seen: session.first_seen, visits: 0, pages: 0, requests: 0 };
    p.first_seen = Date.parse(session.first_seen) < Date.parse(p.first_seen) ? session.first_seen : p.first_seen;
    p.visits++;
    p.pages += session.page_count;
    p.requests += session.requests;
    lifetime.set(session.visitor, p);
  }
  // Overlay full-history truth from SQL: request counts and first-seen span ALL events,
  // not the window, so "returning" and lifetime figures stop resetting as the window rolls.
  const windowStart = rows.length ? rows[rows.length - 1].date : null;
  for (const r of (lifetimeAll.results || [])) {
    const visitor = text(r.actor).replace(/^ip:/, '');
    const p = lifetime.get(visitor) || { first_seen: r.first_seen, visits: 1, pages: 0, requests: 0 };
    p.requests = Math.max(p.requests, Number(r.requests) || 0);
    p.first_seen = r.first_seen && (!p.first_seen || r.first_seen < p.first_seen) ? r.first_seen : p.first_seen;
    // Seen before the window began → definitionally a returning visitor.
    if (windowStart && r.first_seen && r.first_seen < windowStart) p.visits = Math.max(p.visits, 2);
    lifetime.set(visitor, p);
  }

  const fields = ['kind','type','classification','segment','isp','org','connection','browser','os','country','region','city','device'];
  for (const field of fields) {
    const wanted = text(sp.get(field)).toLowerCase().trim();
    if (wanted) rows = rows.filter((row) => text(row[field]).toLowerCase().includes(wanted));
  }
  const q = text(sp.get('q')).toLowerCase().trim();
  if (q) rows = rows.filter((row) => Object.values(row).some((value) => text(value).toLowerCase().includes(q)));
  const wantedStatus = text(sp.get('visitor_status')).toLowerCase();
  if (wantedStatus) rows = rows.filter((row) => ((lifetime.get(row.visitor)?.visits || 1) > 1 ? 'returning' : 'new') === wantedStatus);
  const minPages = Math.max(0, Number(sp.get('min_pages') || 0));
  const minVisits = Math.max(0, Number(sp.get('min_visits') || 0));
  if (minPages) rows = rows.filter((row) => (lifetime.get(row.visitor)?.pages || 0) >= minPages);
  if (minVisits) rows = rows.filter((row) => (lifetime.get(row.visitor)?.visits || 0) >= minVisits);

  const total = rows.length;
  const uniqueVisitors = new Set(rows.map((row) => row.visitor).filter(Boolean)).size;
  const humans = rows.filter((row) => row.classification === 'human').length;
  const bots = rows.filter((row) => row.classification === 'bot').length;
  const sessions = visitorSessions(rows, lifetime);
  const visibleVisitors = new Set(rows.map((row) => row.visitor).filter(Boolean));
  const newVisitors = [...visibleVisitors].filter((v) => (lifetime.get(v)?.visits || 1) === 1).length;
  const returningVisitors = visibleVisitors.size - newVisitors;
  const likelyHumanRequests = rows.filter((row) => row.segment === 'likely_human').length;
  const aiCompanyRequests = rows.filter((row) => row.segment === 'ai_company').length;
  const pageViews = rows.filter((row) => row.kind === 'page').length;
  const summary = {
    total_requests: total, unique_visitors: uniqueVisitors, visits: sessions.length, page_views: pageViews,
    pages_per_visit: sessions.length ? Number((pageViews / sessions.length).toFixed(2)) : 0,
    new_visitors: newVisitors, returning_visitors: returningVisitors,
    likely_human_requests: likelyHumanRequests, ai_company_requests: aiCompanyRequests,
    human_requests: humans, bot_requests: bots, unclassified_requests: total - humans - bots,
  };

  if (sp.get('format') === 'csv') {
    const columns = ['date','type','description','useragent','visitor','classification','isp','org','connection','browser','os','country','region','city','device','ray'];
    const body = [columns.join(','), ...rows.map((row) => columns.map((key) => escCsv(row[key])).join(','))].join('\n');
    return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="miscsubjects-jci-traffic.csv"', 'cache-control': 'no-store' } });
  }

  const start = (page - 1) * perPage;
  return json({
    summary, page, per_page: perPage, total, total_sessions: sessions.length,
    pages: Math.max(1, Math.ceil(sessions.length / perPage)),
    // No silent caps: how much of history this view covers, and how to widen it.
    window: { events_in_window: (trafficResult.results || []).length, window_limit: window, total_events_stored: Number(totalRow?.c) || 0, stored_since: totalRow?.first_ts || null, widen: '?window=<n> up to 100000' },
    visitor_sessions: sessions.slice(start, start + perPage),
    rows: rows.slice(start, start + perPage),
  });
}
