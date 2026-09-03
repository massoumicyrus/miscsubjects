import { isBuildAuthed } from '../_lib/admin_session.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

async function authed(request, env) { return isBuildAuthed(request, env); }

// Settings table helpers
async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row?.value ?? null;
}
async function setSetting(env, key, value) {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).bind(key, value).run();
}

async function ensureQuickTokensTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS quick_copy_tokens (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      note TEXT,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

function normalizeQuickTokens(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    name: String(row.name || '').trim(),
    value: String(row.value || ''),
    note: String(row.note || ''),
  })).filter((row) => row.name && row.value);
}

async function listQuickTokens(env) {
  await ensureQuickTokensTable(env);
  const result = await env.DB.prepare(
    'SELECT name, value, note, updated_at FROM quick_copy_tokens ORDER BY name ASC'
  ).all();
  return result.results || [];
}

async function replaceQuickTokens(env, rows) {
  await ensureQuickTokensTable(env);
  const tokens = normalizeQuickTokens(rows);
  const ts = new Date().toISOString();
  await env.DB.prepare('DELETE FROM quick_copy_tokens').run();
  for (const row of tokens) {
    await env.DB.prepare(
      'INSERT INTO quick_copy_tokens (name, value, note, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(row.name, row.value, row.note || null, ts).run();
  }
}

const DEFAULT_REMOTE_SITES = [
  { host: 'xandraclicks.com', label: 'xandraclicks.com', enabled: true, mode: 'redirect', connect: 'FRM-199903', fbmAdmin: 'FRM-197381', fbmProfile: 'FRM-197330', metaPixelId: '24856970503998756' },
  { host: 'vibrantthread.com', label: 'vibrantthread.com', enabled: true, mode: 'redirect', connect: 'FRM-199956', fbmAdmin: 'FRM-197381', fbmProfile: '', metaPixelId: '24856970503998756' },
  { host: 'jarrettbuilds.com', label: 'jarrettbuilds.com', enabled: true, mode: 'redirect', connect: 'FRM-199976', fbmAdmin: 'FRM-197381', fbmProfile: 'FRM-197330', metaPixelId: '24856970503998756' },
];

const DEFAULT_MONEY_PAGE = 'https://www.leoresearch.com/shop';

function cleanHost(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0];
}

function parseRemoteSites(value, moneyPage) {
  let parsed = null;
  try { parsed = JSON.parse(value || 'null'); } catch {}
  const rows = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_REMOTE_SITES;
  const target = moneyPage || DEFAULT_MONEY_PAGE;
  return rows.map((row) => {
    const host = cleanHost(row.host || row.domain || row.label);
    return {
      host,
      label: String(row.label || host),
      enabled: row.enabled !== false,
      mode: 'redirect',
      targetUrl: String(row.targetUrl || row.moneyPage || target),
      connect: String(row.connect || ''),
      fbmAdmin: String(row.fbmAdmin || ''),
      fbmProfile: String(row.fbmProfile || ''),
      metaPixelId: String(row.metaPixelId || row.pixelId || ''),
      installed: row.installed === true,
      updatedAt: String(row.updatedAt || ''),
    };
  }).filter((row) => row.host);
}

function serializeRemoteSites(value, moneyPage) {
  const rows = Array.isArray(value) ? value : [];
  return JSON.stringify(parseRemoteSites(JSON.stringify(rows), moneyPage));
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, PUT, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      },
    });
  }

  if (method === 'GET') {
    const enabled = await getSetting(env, 'CLOAKER_ENABLED');
    const moneyPage = await getSetting(env, 'CLOAKER_MONEY_PAGE');
    const safePageHtml = await getSetting(env, 'CLOAKER_SAFE_PAGE_HTML');
    const remoteSites = parseRemoteSites(await getSetting(env, 'CLOAKER_REMOTE_SITES'), moneyPage || DEFAULT_MONEY_PAGE);
    const remoteHost = cleanHost(url.searchParams.get('remote_site') || url.searchParams.get('site'));
    if (remoteHost) {
      const site = remoteSites.find((row) => row.host === remoteHost) || null;
      return json({
        ok: !!site,
        cache_seconds: 60,
        site: site ? {
          host: site.host,
          enabled: site.enabled,
          mode: site.mode,
          targetUrl: site.targetUrl,
          metaPixelId: site.metaPixelId,
          updatedAt: site.updatedAt,
        } : { host: remoteHost, enabled: false, mode: 'redirect', targetUrl: null, metaPixelId: '' },
      });
    }
    const out = {
      enabled: enabled === 'true',
      moneyPage: moneyPage || DEFAULT_MONEY_PAGE,
      safePageHtml: safePageHtml || null,
      remoteSites,
    };
    if (await authed(request, env)) out.quickTokens = await listQuickTokens(env);
    return json(out);
  }

  if (method === 'PUT') {
    if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (body.enabled !== undefined) await setSetting(env, 'CLOAKER_ENABLED', body.enabled ? 'true' : 'false');
    if (body.moneyPage !== undefined) await setSetting(env, 'CLOAKER_MONEY_PAGE', String(body.moneyPage));
    if (body.safePageHtml !== undefined) await setSetting(env, 'CLOAKER_SAFE_PAGE_HTML', String(body.safePageHtml));
    if (body.remoteSites !== undefined) {
      const moneyPage = body.moneyPage !== undefined ? String(body.moneyPage) : (await getSetting(env, 'CLOAKER_MONEY_PAGE')) || DEFAULT_MONEY_PAGE;
      await setSetting(env, 'CLOAKER_REMOTE_SITES', serializeRemoteSites(body.remoteSites, moneyPage));
    }
    if (body.quickTokens !== undefined) await replaceQuickTokens(env, body.quickTokens);
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}
