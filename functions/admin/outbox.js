/**
 * /admin/outbox — the unified outbox + traffic view (owner order 2026-07-30).
 * One page, two tabulations, both projections of the ledger/D1:
 *   1. OUTBOX — every tracked send: to, subject, sent, opens (first/last), clicks
 *      (count, times, targets), and the JCI join — which visitor identity (ip:<hash>)
 *      opened/clicked, when, and that visitor's site-session footprint.
 *   2. TRAFFIC — recent visitor sessions (same session builder the traffic page uses),
 *      with a link to the full /admin/traffic for deep filtering.
 * Server-rendered, explicit high-contrast colors (owner: the Attention tab was
 * black-on-black; nothing here inherits ambiguous theme colors).
 */
import { shellHtml } from './_layout.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parse = (v) => { try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };
const fmtT = (t) => { if (!t) return ''; const s = String(t); return s.slice(5, 16).replace('T', ' ') + (s.length > 16 ? s.slice(16, 19) : ''); };

// HONEST ENGAGEMENT (owner order 2026-08-03: "did actual people click?"). Raw counters lie:
// corporate link scanners fire every link within seconds of the send, image proxies prefetch
// the pixel instantly. The verdict reads the TIMING SHAPE — only late, sparse, or repeated
// engagement is credited as human; everything machine-shaped is named for what it is.
const tsMs = (x) => { const t = Date.parse(x || ''); return Number.isFinite(t) ? t : null; };
export function engagementVerdict(row, clickLog) {
  const s = tsMs(row.sent_at), fo = tsMs(row.first_open_at), fc = tsMs(row.first_click_at);
  if (fc != null && s != null) {
    const dt = (fc - s) / 1000;
    let burst = false;
    if (Array.isArray(clickLog) && clickLog.length >= 3) {
      const t0 = tsMs(clickLog[0]?.ts), t1 = tsMs(clickLog[clickLog.length - 1]?.ts);
      burst = t0 != null && t1 != null && (t1 - t0) / 1000 < 90;
    }
    if (dt < 120 || (burst && dt < 600)) return 'scanner-click';
    return 'human-click';
  }
  if (fo != null && s != null) {
    const dt = (fo - s) / 1000;
    if (dt < 90) return 'proxy-open';
    if ((row.opens || 0) >= 2 || dt > 600) return 'human-open';
    return 'open-ambiguous';
  }
  return 'no-engagement';
}
const VERDICT_STYLE = {
  'human-click': 'background:#1b7a3d;color:#fff', 'human-open': 'background:#3d6fa5;color:#fff',
  'open-ambiguous': 'background:#c9a961;color:#1a1a1a', 'scanner-click': 'background:#777;color:#fff',
  'proxy-open': 'background:#a9a9a9;color:#1a1a1a', 'no-engagement': 'background:transparent;color:var(--muted);border:1px solid var(--line-strong)',
};
const EXTERNAL_KINDS_EXCLUDED = new Set(['draft-review', 'test', 'probe', 'build-draft-approval']);

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ---- OUTBOX rows + engagement (email_sends, DB) ----
  let sends = [];
  try {
    const r = await env.DB.prepare(
      'SELECT id,to_email,subject,kind,sent_at,send_status,opens,first_open_at,last_open_at,clicks,first_click_at,last_click_at,click_log FROM email_sends ORDER BY sent_at DESC LIMIT 400'
    ).all();
    sends = r.results || [];
  } catch {}

  // ---- JCI join: opens/clicks as ledger events with the ip:<hash> actor ----
  const joinByEs = new Map(); // es_id -> [{ts,key,actor,url}]
  const actors = new Set();
  try {
    const r = await env.LEDGER.prepare(
      "SELECT ts,key,actor,request_json FROM events WHERE key IN ('JCI_EMAIL_OPEN','JCI_EMAIL_CLICK') ORDER BY ts DESC LIMIT 2000"
    ).all();
    for (const e of r.results || []) {
      const req = parse(e.request_json);
      const esId = req.es_id || '';
      if (!esId) continue;
      if (!joinByEs.has(esId)) joinByEs.set(esId, []);
      joinByEs.get(esId).push({ ts: e.ts, key: e.key, actor: e.actor, url: req.url || '' });
      if (e.actor && e.actor.startsWith('ip:')) actors.add(e.actor);
    }
  } catch {}

  // ---- visitor footprints for joined actors (full-history SQL, cheap GROUP BY) ----
  const footprint = new Map(); // actor -> {requests, first_seen, last_seen}
  try {
    if (actors.size) {
      const list = [...actors].slice(0, 50);
      const placeholders = list.map(() => '?').join(',');
      const r = await env.LEDGER.prepare(
        `SELECT actor, count(*) requests, min(ts) first_seen, max(ts) last_seen FROM events WHERE source='jci' AND key='JCI_TRAFFIC' AND actor IN (${placeholders}) GROUP BY actor`
      ).bind(...list).all();
      for (const row of r.results || []) footprint.set(row.actor, row);
    }
  } catch {}

  // ---- recent traffic sessions (compact; the deep view stays /admin/traffic) ----
  let recentTraffic = [];
  try {
    const r = await env.LEDGER.prepare(
      "SELECT ts,actor,request_json FROM events WHERE source='jci' AND key='JCI_TRAFFIC' ORDER BY ts DESC LIMIT 400"
    ).all();
    const byActor = new Map();
    for (const e of r.results || []) {
      const req = parse(e.request_json);
      const a = byActor.get(e.actor) || { actor: e.actor, last: e.ts, requests: 0, pages: new Set(), ua: '' };
      a.requests++;
      const path = req.path || '';
      if (path && !/\.(css|js|png|jpg|gif|svg|ico|woff)/.test(path)) a.pages.add(path);
      if (!a.ua && req.useragent) a.ua = req.useragent;
      byActor.set(e.actor, a);
    }
    recentTraffic = [...byActor.values()].slice(0, 25);
  } catch {}

  const totalStored = await env.LEDGER.prepare("SELECT count(*) c FROM events WHERE source='jci' AND key='JCI_TRAFFIC'").first().catch(() => null);

  // Verdict per send + external-only tally for the headline tiles.
  const tally = {};
  let externalCount = 0;
  for (const s of sends) {
    let log = []; try { log = JSON.parse(s.click_log || '[]'); } catch {}
    s._verdict = engagementVerdict(s, log);
    if (!EXTERNAL_KINDS_EXCLUDED.has(s.kind)) { externalCount++; tally[s._verdict] = (tally[s._verdict] || 0) + 1; }
  }
  const pct = (n) => externalCount ? Math.round((n || 0) * 100 / externalCount) + '%' : '—';
  const tiles = [
    ['Human clicks', tally['human-click'], '#1b7a3d'], ['Human opens, no click', tally['human-open'], '#3d6fa5'],
    ['Ambiguous opens', tally['open-ambiguous'], '#c9a961'], ['Scanner clicks', tally['scanner-click'], '#777'],
    ['Proxy opens', tally['proxy-open'], '#a9a9a9'], ['No engagement', tally['no-engagement'], '#555'],
  ].map(([label, n, color]) => `<div class="ob-tile" style="border-top:3px solid ${color}"><div class="ob-tile-n">${n || 0}</div><div class="ob-tile-p">${pct(n)}</div><div class="ob-tile-l">${label}</div></div>`).join('');

  const outboxRows = sends.map((s) => {
    const clicks = (() => { try { return JSON.parse(s.click_log || '[]'); } catch { return []; } })();
    const join = joinByEs.get(s.id) || [];
    const joinHtml = join.slice(0, 8).map((j) => {
      const fp = footprint.get(j.actor);
      return `<div class="ob-join">${j.key === 'JCI_EMAIL_CLICK' ? '↗ click' : '◉ open'} ${esc(fmtT(j.ts))} · <code>${esc(String(j.actor).slice(0, 18))}</code>${fp ? ` · this visitor: ${fp.requests} site requests, first seen ${esc(fmtT(fp.first_seen))}, last ${esc(fmtT(fp.last_seen))}` : ''}${j.url ? ` · → ${esc(j.url.replace('https://miscsubjects.com', ''))}` : ''}</div>`;
    }).join('');
    return `<tr${s._verdict === 'human-click' || s._verdict === 'human-open' ? ' style="background:rgba(27,122,61,.07)"' : ''}>
      <td><strong>${esc(s.to_email)}</strong><div class="ob-dim">${esc(s.kind)} · ${esc(s.id)}</div></td>
      <td>${esc(s.subject)}</td>
      <td><span class="ob-verdict" style="${VERDICT_STYLE[s._verdict] || ''}">${esc(s._verdict)}</span></td>
      <td>${esc(fmtT(s.sent_at))}<div class="ob-dim">status ${esc(s.send_status)}</div></td>
      <td class="${s.opens ? 'ob-hot' : 'ob-dim'}">${s.opens}${s.first_open_at ? `<div class="ob-dim">first ${esc(fmtT(s.first_open_at))}<br>last ${esc(fmtT(s.last_open_at))}</div>` : ''}</td>
      <td class="${s.clicks ? 'ob-hot' : 'ob-dim'}">${s.clicks}${clicks.length ? `<div class="ob-dim">${clicks.slice(-3).map((c) => esc(fmtT(c.ts)) + ' → ' + esc(String(c.url).replace('https://miscsubjects.com', '')).slice(0, 48)).join('<br>')}</div>` : ''}</td>
      <td>${joinHtml || '<span class="ob-dim">no joined visits</span>'}</td>
    </tr>`;
  }).join('');

  const trafficRows = recentTraffic.map((t) => `<tr>
    <td><code>${esc(String(t.actor).slice(0, 22))}</code></td>
    <td>${esc(fmtT(t.last))}</td>
    <td>${t.requests}</td>
    <td>${[...t.pages].slice(0, 4).map((p) => esc(p)).join('<br>') || '<span class="ob-dim">assets only</span>'}</td>
    <td class="ob-dim">${esc(String(t.ua).slice(0, 70))}</td>
  </tr>`).join('');

  const body = `
<style>
.ob-wrap{color:var(--ink)}
.ob-wrap h2{font-size:15px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink);margin:26px 0 10px}
.ob-wrap table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.55;background:var(--bg);border:1px solid var(--line-strong);border-radius:8px;overflow:hidden}
.ob-wrap th{text-align:left;padding:9px 12px;background:var(--panel);color:var(--ink);font-size:11px;letter-spacing:.06em;text-transform:uppercase;border-bottom:2px solid var(--line-strong)}
.ob-wrap td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink-soft)}
.ob-wrap tr:last-child td{border-bottom:none}
.ob-dim{color:var(--muted);font-size:11.5px}
.ob-hot{color:#1b7a3d;font-weight:700}
.ob-join{font-size:11.5px;color:var(--ink-soft);padding:2px 0}
.ob-wrap code{background:var(--raised);padding:1px 5px;border-radius:4px;font-size:11px;color:var(--ink)}
.ob-note{font-size:12.5px;color:var(--muted);margin:6px 0 0}
.ob-note a{color:var(--ink)}
.ob-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:14px 0 4px}
.ob-tile{background:var(--panel);border:1px solid var(--line-strong);border-radius:10px;padding:11px 13px}
.ob-tile-n{font-size:25px;font-weight:800;color:var(--ink)} .ob-tile-p{font-size:12px;color:var(--muted)} .ob-tile-l{font-size:11.5px;color:var(--ink-soft);margin-top:2px}
.ob-verdict{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap}
</style>
<div class="ob-wrap">
<h1>Outbox &amp; Traffic</h1>
<p class="ob-note">The headline answers one question — did actual people engage? A click within 2 minutes of send (or a burst of every link at once) is a corporate mail scanner; a pixel inside 90 seconds is an image proxy; only late, sparse, or repeated engagement earns a human verdict. Tiles count external sends only (drafts to the owner's own inbox excluded). The join column still ties each send to a visitor identity and its full site footprint via the <a href="/admin/traffic">traffic view</a>.</p>

<div class="ob-tiles">${tiles}</div>

<h2>Outbox — ${sends.length} most recent tracked sends</h2>
<table>
<tr><th>To</th><th>Subject</th><th>Verdict</th><th>Sent</th><th>Opens</th><th>Clicks</th><th>JCI join — who, when, then what</th></tr>
${outboxRows || '<tr><td colspan="7" class="ob-dim">no sends</td></tr>'}
</table>

<h2>Traffic — 25 most recent visitors <span class="ob-dim" style="text-transform:none;letter-spacing:0">(${Number(totalStored?.c) || 0} events stored · <a href="/admin/traffic" style="color:var(--ink)">full view with filters →</a>)</span></h2>
<table>
<tr><th>Visitor</th><th>Last seen</th><th>Requests</th><th>Pages</th><th>Agent</th></tr>
${trafficRows || '<tr><td colspan="5" class="ob-dim">no traffic</td></tr>'}
</table>
</div>`;
  return new Response(shellHtml({ activeHref: '/admin/outbox', title: 'Outbox & Traffic', body }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
