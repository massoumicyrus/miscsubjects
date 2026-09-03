import { DIR_SCHEMA } from '../_lib/dir_schema.js';

// GET /api/map — the whole build ontology in one call. Every capability is REST; this is
// the index. Routes are the framework layer (maintained here — Pages can't introspect its
// own routes at runtime); bindings are checked live; counts + feeds point at the live data.
// Any client/LLM: GET /api/map, then GET the feeds below, and it can operate the entire build.

const ROUTES = [
  { group: 'kernel', route: 'POST /api/dispatch', note: 'run any directory row {key,body,actor?}' },
  { group: 'kernel', route: 'POST /api/turn', note: 'inbound message -> ROUTER' },
  { group: 'kernel', route: 'POST /blooio', note: 'iMessage webhook (Blooio)' },
  { group: 'kernel', route: 'GET|POST /api/mcp', note: 'directory exposed as MCP tools' },
  { group: 'directory', route: 'GET /api/directory[?type=agent|http|fn|flow]', note: 'list rows + schema' },
  { group: 'directory', route: 'POST /api/directory {key,type,...}', note: 'create a row' },
  { group: 'directory', route: 'GET|PUT|PATCH|DELETE /api/directory/:key', note: 'read/update/patch/delete one row (+ _rest, _schema)' },
  { group: 'directory', route: 'GET /api/directory/categories | /api/directory/search', note: 'taxonomy + search' },
  { group: 'assets', route: 'GET /api/inventory[?kind=file,r2,kv,directory,page,article]', note: 'every file/object with read/edit/delete' },
  { group: 'assets', route: 'GET|PUT|DELETE /api/file/*', note: 'repo files (reads/writes/commits to GitHub main)' },
  { group: 'assets', route: 'GET|PUT|DELETE /api/r2/*', note: 'R2 objects' },
  { group: 'assets', route: 'GET|PUT|DELETE /api/kv', note: 'KV pairs' },
  { group: 'assets', route: 'GET|PUT|PATCH|DELETE /api/short/:id', note: 'short links' },
  { group: 'assets', route: 'GET|POST /api/store/*', note: 'storage worker (bound, reference sprawl)' },
  { group: 'assets', route: 'ANY /api/settings/:key', note: 'settings rows' },
  { group: 'content', route: 'ANY /api/articles/* | /api/content/* | /api/pages/*', note: 'content CRUD' },
  { group: 'content', route: 'GET|POST /api/presets | /api/relationships | /api/plan | /api/panel | /api/studio', note: '' },
  { group: 'content', route: 'GET /api/models | ANY /api/providers/* | ANY /api/runs/* /api/run/*', note: '' },
  { group: 'agents', route: 'POST /api/council | /api/proactive | /grok/audit', note: 'multi-model agents' },
  { group: 'agents', route: 'ANY /api/durable/*', note: 'durable resident agents (AgentDO)' },
  { group: 'handoff', route: 'GET /api/model-lane | GET /api/relay?social=1', note: 'public model execution lane and public proof chain; unified backend handoff is owner-only' },
  { group: 'ingest', route: 'POST /api/cc_log | /api/grok_log | /api/kimi_log | /api/agent_log | /api/agent_ledger_sync | /api/agent_audit | /api/cc_audit | /api/event_log_ingest | /api/snapshot_ingest | /api/deliver', note: 'turn-log + ledger ingest + delivery' },
  { group: 'site', route: 'GET /', note: 'homepage (public/index.html)' },
  { group: 'site', route: 'GET /:slug', note: 'dynamic page (pages table)' },
  { group: 'site', route: 'GET /a/:slug', note: 'article' },
  { group: 'site', route: 'GET /content/:slug | GET /s/:slug | GET /img/*', note: 'content / short link / R2 image' },
  { group: 'admin', route: 'GET /admin/*', note: 'HTML cockpit: directory, ledger, manual, map, assets, content, pages, trace, run, cc, sync-sheets, bind-secrets' },
];

// Names checked for presence only — values are never returned.
const BINDING_NAMES = ['DB', 'LEDGER', 'KV', 'R2', 'AI', 'DIRECTORY_DO', 'TASKS', 'STORE', 'GITHUB_TOKEN', 'TERMINAL_KEY', 'STORE_KEY', 'CLOUDFLARE_API_TOKEN'];

function json(o, s) { return new Response(JSON.stringify(o, null, 2), { status: s || 200, headers: { 'content-type': 'application/json' } }); }

export async function onRequestGet(context) {
  const { env } = context;
  const bindings = {};
  for (const b of BINDING_NAMES) bindings[b] = !!(env[b] != null && env[b] !== '');
  let directoryCount = null;
  try { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM directory').first(); directoryCount = r && r.n; } catch (e) { /* DB optional */ }
  return json({
    build: 'miscsubjects',
    ts: new Date().toISOString(),
    note: 'Whole-build ontology. Every capability is REST. GET this, then GET the feeds, and the entire build is operable.',
    feeds: {
      directory: 'GET /api/directory  — the invocation table (D1); rows carry add/edit schema',
      inventory: 'GET /api/inventory  — every file/object with read/edit/delete URL+method',
      dispatch: 'POST /api/dispatch {key,body}  — run any directory row',
    },
    directory_schema: DIR_SCHEMA,
    routes: ROUTES,
    bindings,
    counts: { directory: directoryCount },
  });
}
