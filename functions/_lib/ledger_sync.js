// QUADSYNC — the ledger and the build sync in unison across four corners:
// Cloudflare (D1/R2, the source of record) ↔ GitHub (mirror + code) ↔ local Mac ↔ Google Drive.
//
//   OUT  ledger → GitHub : every event mirrored as compact JSONL day-files, cursor-based,
//                          committed via the GitHub contents API (ledger-mirror/events-YYYY-MM-DD.jsonl).
//   IN   GitHub → ledger : recent commits folded in as source='github' events (idempotent gh_<sha>)
//                          + [auto] issues mirrored to tasks (existing syncGithubIssuesToTasks).
//   LOCAL/DRIVE          : scripts/quadsync.sh (launchd, every 10 min) pulls+pushes git, mirrors the
//                          tree into ~/Google Drive/My Drive/miscsubjects-sync/, then stamps
//                          sync:local / sync:drive here via /api/kv.
//
// Every corner writes a KV stamp (sync:<corner> = unix seconds). syncHealth() turns stamps into
// the four-dot strip on /admin/ledger and feeds the governor's sync_asymmetry flag — a stale
// corner is URGENT, texted, and emailed. Asymmetry is a defect class, not a mood.

import { logEvent } from './event_log.js';
import { redactMirrorPreview } from './secret_redaction.js';

const REPO = '[OWNER_HANDLE]/miscsubjects-pages';
const MIRROR_BATCH = 1000;

function ghHeaders(env) {
  return {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'miscsubjects-quadsync',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function unb64(b) {
  const bin = atob(String(b || '').replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function stamp(env, corner) {
  try { if (env.KV) await env.KV.put('sync:' + corner, String(Math.floor(Date.now() / 1000))); } catch {}
}

// ── OUT: ledger → GitHub. Compact record per event (full payloads live in R2 forever;
// the mirror is the queryable chronicle, not a second blob store).
export async function ledgerGithubSync(env) {
  if (!env.GITHUB_TOKEN || !env.LEDGER) return { ok: false, reason: 'missing GITHUB_TOKEN or LEDGER' };
  const cursor = parseInt((env.KV ? await env.KV.get('sync:ledger_mirror_rowid') : '0') || '0', 10);
  const rows = (await env.LEDGER.prepare(
    'SELECT rowid, id, ts, source, key, action, direction, status, trace_id, actor, ' +
    'substr(request_preview,1,200) req, substr(response_preview,1,200) res ' +
    'FROM events WHERE rowid > ? ORDER BY rowid LIMIT ?'
  ).bind(cursor, MIRROR_BATCH).all()).results || [];
  if (!rows.length) { await stamp(env, 'github_out'); return { ok: true, mirrored: 0, cursor }; }

  // Group by day file (mixed ts formats tolerated: date = first 10 chars).
  const byDay = {};
  for (const r of rows) (byDay[String(r.ts).slice(0, 10)] = byDay[String(r.ts).slice(0, 10)] || []).push(r);

  // Day files shard at ~800KB: the GitHub contents API cannot return >1MB file content,
  // and silently appending to an unreadable file would overwrite it. Shard counter in KV.
  const SHARD_MAX = 800000;
  let mirrored = 0;
  for (const [day, list] of Object.entries(byDay)) {
    let shard = parseInt((env.KV ? await env.KV.get('sync:mirror_shard:' + day) : '0') || '0', 10);
    const lines = list.map((r) => JSON.stringify({
      id: r.id, ts: r.ts, source: r.source, key: r.key, action: r.action, direction: r.direction,
      status: r.status, trace: r.trace_id, actor: r.actor,
      req: redactMirrorPreview(r.req, env),
      res: redactMirrorPreview(r.res, env),
    })).join('\n') + '\n';

    for (let attempt = 0; attempt < 3; attempt++) {
      const path = 'ledger-mirror/events-' + day + (shard ? '.p' + shard : '') + '.jsonl';
      const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
      let sha = null, existing = '', unreadable = false;
      const g = await fetch(url, { headers: ghHeaders(env) });
      if (g.ok) {
        const j = await g.json();
        sha = j.sha;
        if (j.content) existing = unb64(j.content);
        else unreadable = true;              // >1MB: contents API withholds content
      }
      if (unreadable || existing.length + lines.length > SHARD_MAX) {
        shard++;
        if (env.KV) await env.KV.put('sync:mirror_shard:' + day, String(shard));
        continue;                            // next shard file, fresh
      }
      const put = await fetch(url, {
        method: 'PUT', headers: { ...ghHeaders(env), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'quadsync: mirror ' + list.length + ' ledger events (' + day + (shard ? ' p' + shard : '') + ') [skip ci]',
          content: b64(existing + lines),
          ...(sha ? { sha } : {}),
        }),
      });
      if (put.status === 409) continue;   // sha raced a concurrent writer — re-read and retry
      if (!put.ok) {
        return { ok: false, reason: 'github put ' + put.status + ' ' + path + ': ' + (await put.text()).slice(0, 160), mirrored };
      }
      mirrored += list.length;
      break;
    }
  }
  const maxRow = rows[rows.length - 1].rowid;
  if (env.KV) await env.KV.put('sync:ledger_mirror_rowid', String(maxRow));
  await stamp(env, 'github_out');
  return { ok: true, mirrored, cursor: maxRow, backlog_possible: rows.length === MIRROR_BATCH };
}

// ── IN: GitHub → ledger. Commits become events (idempotent), [auto] issues become tasks.
export async function githubLedgerSync(env) {
  if (!env.GITHUB_TOKEN) return { ok: false, reason: 'no GITHUB_TOKEN' };
  const r = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=15`, { headers: ghHeaders(env) });
  if (!r.ok) return { ok: false, reason: 'github ' + r.status };
  const commits = await r.json();
  let inserted = 0;
  for (const c of (commits || [])) {
    const exists = await env.LEDGER.prepare('SELECT id FROM events WHERE id = ?').bind('gh_' + c.sha).first();
    if (exists) continue;
    await logEvent(env, {
      id: 'gh_' + c.sha, source: 'github', key: 'COMMIT', action: 'push',
      actor: (c.commit?.author?.name) || 'github', trace_id: 'gh_' + String(c.sha).slice(0, 8), status: 200,
      request: { sha: c.sha, message: c.commit?.message, url: c.html_url },
      response: { author: c.commit?.author },
    });
    inserted++;
  }
  let issues = null;
  try {
    const { syncGithubIssuesToTasks } = await import('./github_loop.js');
    const s = await syncGithubIssuesToTasks(env);
    issues = { created: s.created || 0, reopened: s.reopened || 0, closed: s.closed || 0 };
  } catch {}
  await stamp(env, 'github_in');
  return { ok: true, commits_folded: inserted, issues };
}

// ── Health: the four corners as one object. green ≤ stale_s, amber ≤ 3×, red beyond. ──
export const SYNC_CORNERS = [
  { id: 'cloudflare', label: 'Cloudflare', stale_s: 0 },          // source of record — always live
  { id: 'github_out', label: 'Ledger→GitHub', stale_s: 1800 },
  { id: 'github_in',  label: 'GitHub→Ledger', stale_s: 1800 },
  { id: 'local',      label: 'Local Mac',     stale_s: 1800 },
  { id: 'drive',      label: 'Google Drive',  stale_s: 1800 },
];

export async function syncHealth(env) {
  const now = Math.floor(Date.now() / 1000);
  const out = [];
  for (const c of SYNC_CORNERS) {
    if (c.id === 'cloudflare') { out.push({ ...c, age_s: 0, state: 'green' }); continue; }
    let ts = 0;
    try { ts = parseInt((env.KV ? await env.KV.get('sync:' + c.id) : '0') || '0', 10); } catch {}
    const age = ts ? now - ts : null;
    const state = age == null ? 'red' : (age <= c.stale_s ? 'green' : (age <= c.stale_s * 3 ? 'amber' : 'red'));
    out.push({ ...c, age_s: age, state });
  }
  return out;
}

// ── Tick: rides dispatch traffic (same pattern as archiveTick/governorTick). ──
let lastSyncCheck = 0;
export async function syncTick(env) {
  try {
    const now = Date.now();
    if (now - lastSyncCheck < 60000) return null;
    lastSyncCheck = now;
    if (!env || !env.KV) return null;
    const nowS = Math.floor(now / 1000);
    const last = parseInt(await env.KV.get('sync:last_tick') || '0', 10);
    if (nowS - last < 600) return null;               // one sync pass per 10 min
    await env.KV.put('sync:last_tick', String(nowS)); // claim before the slow part
    const outR = await ledgerGithubSync(env);
    const inR = await githubLedgerSync(env);
    await logEvent(env, {
      source: 'sync', key: 'QUADSYNC_TICK', action: 'sync', direction: 'out',
      status: (outR.ok && inR.ok) ? 200 : 500,
      request: { cadence_s: 600 }, response: { out: outR, in: inR },
    });
    return { out: outR, in: inR };
  } catch {
    return null;
  }
}
