#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];
let examined = 0;
const check = (ok, what) => { examined += 1; if (!ok) failures.push(what); };

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); }
catch (e) { console.error(JSON.stringify({ ok: false, law: 'ENVIRONMENT_CONTRACT_LAW', unread: 'node:sqlite unavailable: ' + e.message })); process.exit(2); }

// D1-shaped adapter over SQLite: the handlers see prepare().bind().first()/all()/run().
function d1(db) {
  return {
    prepare(sql) {
      let stmt;
      try { stmt = db.prepare(sql); } catch (e) { return { bind() { return this; }, async first() { throw e; }, async all() { throw e; }, async run() { throw e; } }; }
      let binds = [];
      return {
        bind(...b) { binds = b.map((v) => (v === undefined ? null : v)); return this; },
        async first() { return stmt.get(...binds) || null; },
        async all() { return { results: stmt.all(...binds) }; },
        async run() { const r = stmt.run(...binds); return { success: true, meta: { changes: r.changes } }; },
      };
    },
  };
}

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE directory (
    key TEXT PRIMARY KEY, type TEXT NOT NULL, target TEXT, auth TEXT, content TEXT, updated_at TEXT NOT NULL,
    category TEXT, allowed_categories TEXT, seq INTEGER, enabled INTEGER DEFAULT 1, planner_visible INTEGER DEFAULT 1,
    planner_rank INTEGER DEFAULT 100, input_schema TEXT, examples TEXT, includes TEXT, sensitive INTEGER DEFAULT 0,
    runner TEXT, created_at TEXT, price_usd REAL, meter_unit TEXT
  );
  CREATE TABLE directory_versions (key TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL, actor TEXT, ts TEXT NOT NULL, PRIMARY KEY (key, version));
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO directory (key,type,target,auth,content,updated_at) VALUES ('ADD','fn','','','# WHAT: Add two numbers.','2026-09-01T00:00:00Z');
`);
try { db.exec(readFileSync(join(ROOT, 'migrations/0373_environment_descriptors.sql'), 'utf8')); }
catch (e) { console.error(JSON.stringify({ ok: false, law: 'ENVIRONMENT_CONTRACT_LAW', unread: 'migration 0373 did not apply to a fresh database: ' + e.message })); process.exit(2); }

const env = { DB: d1(db), TERMINAL_KEY: 'gate-terminal-key' };
const ORIGIN = 'https://miscsubjects.com';
const { onRequestGet: environment } = await import(join(ROOT, 'functions/api/environment/[[path]].js'));
const { onRequestPatch: directoryPatch, onRequestGet: directoryGet } = await import(join(ROOT, 'functions/api/directory/[key].js'));
const { descriptorFromDirectoryRow, hashEnvironmentDescriptor } = await import(join(ROOT, 'functions/_lib/environment_descriptor.js'));
const { normalizeView, runView } = await import(join(ROOT, 'functions/_lib/sheet_views.js'));
const { mcpResourcesFromCatalog, readMcpResource, MANUAL_RESOURCE_URI } = await import(join(ROOT, 'functions/api/mcp.js'));
const { shellHtml } = await import(join(ROOT, 'functions/admin/_layout.js'));
const { injectObjectContext } = await import(join(ROOT, 'functions/_lib/object_context.js'));

const get = (path, query = '') => environment({ env, params: { path: path ? path.split('/') : [] }, request: new Request(`${ORIGIN}/api/environment${path ? '/' + path : ''}${query}`) });
const SHEETS = 'page://admin/sheets';
const Q = encodeURIComponent(SHEETS);

// 1. The root and the manual.
{
  const root = await get('');
  const body = await root.json();
  check(root.status === 200 && body.schema === 'miscsubjects/environment/1', 'root: expected 200 with schema miscsubjects/environment/1, got ' + root.status + ' ' + body.schema);
  check(body.object_count >= 7, 'root: seeded catalog should hold at least 7 objects, got ' + body.object_count);
  const manual = await get('', '?format=markdown');
  const text = await manual.text();
  check(manual.status === 200 && manual.headers.get('content-type').startsWith('text/markdown'), 'manual: expected 200 text/markdown, got ' + manual.status);
  check(/Ledger/.test(text), 'manual: does not name the Ledger as history and evidence');
  check(text.includes('/api/environment/governance') && text.includes('/api/environment/comparables'), 'manual: does not teach the governance and comparables resolvers');
  check(/`page`: \d+/.test(text) && /`law`: \d+/.test(text), 'manual: object family counts are not generated from the catalog');
  check(text.includes('Directory = nouns. Ledger = verbs. Everything else = views.'), 'manual: does not state the three primitives');
  check(text.includes('### `directory://catalog`') && text.includes('### `ledger://events`') && text.includes('### `page://admin/sheets`'), 'manual: declared operations of the directory, the ledger and the sheets page are not generated into the manual');
  check(text.includes('POST https://miscsubjects.com/api/sheets/{id}/values:append') && text.includes('expected_descriptor_rev'), 'manual: the sheet webhook address or the compare-and-set edit field is missing');
  check(!/sh\.[A-Za-z0-9_-]{8,}\.|TERMINAL_KEY=|Bearer [A-Za-z0-9]{20,}/.test(text), 'manual: a credential-shaped string appears in the public manual');
  for (const ref of ['directory://catalog', 'ledger://events']) {
    const obj = await (await get('objects', '?ref=' + encodeURIComponent(ref))).json();
    check(obj.ref === ref && obj.operations.length >= 5 && obj.governance.effective.length >= 1, 'environment: primitive ' + ref + ' does not resolve with operations and effective rules');
  }
}

// 2. Governance resolves with paths, revisions and hashes; nothing unresolved or in conflict.
{
  const r = await get('governance', `?ref=${Q}`);
  const g = await r.json();
  check(r.status === 200, 'governance: HTTP ' + r.status);
  const eff = (g.effective || []).map((x) => x.rule_ref);
  check(eff.includes('law://sheets/S01'), 'governance: direct rule law://sheets/S01 missing from effective');
  check(eff.includes('law://design/D08'), 'governance: inherited rule law://design/D08 (from page://admin) missing from effective');
  check(eff.includes('law://work/W01'), 'governance: environment-wide rule law://work/W01 (from environment://miscsubjects) missing from effective');
  const d08 = (g.inherited || []).find((x) => x.rule_ref === 'law://design/D08');
  check(!!d08 && JSON.stringify(d08.applies_because) === JSON.stringify(['page://admin/sheets part_of page://admin', 'page://admin governed_by law://design/D08']), 'governance: D08 applies_because path is not the part_of chain: ' + JSON.stringify(d08?.applies_because));
  check((g.effective || []).every((x) => x.rule_revision >= 1 && /^sha256:[a-f0-9]{64}$/.test(String(x.rule_hash))), 'governance: an effective rule lacks its revision or content hash');
  check((g.unresolved || []).length === 0 && (g.conflicts || []).length === 0, 'governance: unresolved=' + JSON.stringify(g.unresolved) + ' conflicts=' + JSON.stringify(g.conflicts));
  const missing = await get('governance', '?ref=' + encodeURIComponent('page://admin/nowhere'));
  check(missing.status === 404, 'governance: an unregistered ref must answer 404, got ' + missing.status);
}

// 3. Comparables state dimensions, basis, differences, sources and status.
{
  const r = await get('comparables', `?ref=${Q}`);
  const c = await r.json();
  const edge = (c.comparables || [])[0];
  check(r.status === 200 && !!edge, 'comparables: no comparable resolved for page://admin/sheets');
  check(!!edge && edge.dimensions.includes('programmability') && edge.differences.length > 0 && edge.similarities.length > 0 && edge.sources.length > 0 && edge.status === 'verified', 'comparables: edge lacks dimensions/differences/similarities/sources/status: ' + JSON.stringify(edge));
  check(!!edge && edge.target.kind === 'external_system', 'comparables: the target external://google/sheets is not itself a registered object');
  const filtered = await (await get('comparables', `?ref=${Q}&dimension=nonexistent`)).json();
  check((filtered.comparables || []).length === 0, 'comparables: a dimension filter that matches nothing must return no comparables');
}

// 4. Every stored descriptor hash equals the hash of its stored content.
for (const row of db.prepare('SELECT * FROM directory WHERE descriptor_json IS NOT NULL').all()) {
  const recomputed = await hashEnvironmentDescriptor(descriptorFromDirectoryRow(row));
  check(recomputed === row.descriptor_hash, `hash drift: ${row.key} stores ${row.descriptor_hash} but its descriptor_json hashes to ${recomputed}`);
}

// 5. A descriptor edit through the canonical directory path lands in the row, bumps the revision,
//    appends a version, and a stale revision is refused with nothing written.
{
  const before = db.prepare("SELECT descriptor_rev, descriptor_hash FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get();
  const current = JSON.parse(db.prepare("SELECT descriptor_json FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get().descriptor_json);
  current.governance = { direct: ['law://sheets/S01', 'law://design/D08'] };
  const patch = (body) => directoryPatch({ env, params: { key: 'PAGE_ADMIN_SHEETS' }, request: new Request(`${ORIGIN}/api/directory/PAGE_ADMIN_SHEETS`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY }, body: JSON.stringify(body) }) });
  const ok = await patch({ descriptor_json: current, expected_descriptor_rev: before.descriptor_rev });
  const okBody = await ok.json();
  const after = db.prepare("SELECT descriptor_rev, descriptor_hash, descriptor_json, object_kind FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get();
  check(ok.status === 200, 'directory PATCH with the current revision: HTTP ' + ok.status + ' ' + JSON.stringify(okBody));
  check(after.descriptor_rev === before.descriptor_rev + 1, `directory PATCH: row revision is ${after.descriptor_rev}, expected ${before.descriptor_rev + 1}`);
  check(after.descriptor_hash !== before.descriptor_hash && after.descriptor_hash === okBody.descriptor_hash, 'directory PATCH: the row hash is not the hash the response reported');
  check(after.descriptor_hash === await hashEnvironmentDescriptor(JSON.parse(after.descriptor_json)), 'directory PATCH: stored hash does not equal the hash of the stored descriptor');
  check(JSON.parse(after.descriptor_json).governance.direct.includes('law://design/D08'), 'directory PATCH: the edited governance did not land in the row');
  const version = db.prepare("SELECT version, descriptor_hash FROM directory_versions WHERE key='PAGE_ADMIN_SHEETS' ORDER BY version DESC LIMIT 1").get();
  check(!!version && version.descriptor_hash === after.descriptor_hash, 'directory PATCH: directory_versions did not receive the new descriptor hash: ' + JSON.stringify(version));
  const stale = await patch({ descriptor_json: { ...current, title: 'Overwrite attempt' }, expected_descriptor_rev: before.descriptor_rev });
  const staleBody = await stale.json();
  const unchanged = db.prepare("SELECT descriptor_rev, descriptor_hash FROM directory WHERE key='PAGE_ADMIN_SHEETS'").get();
  check(stale.status === 409 && staleBody.error === 'descriptor_revision_stale' && staleBody.current_descriptor_rev === after.descriptor_rev, 'directory PATCH stale: expected 409 descriptor_revision_stale naming the current revision, got ' + stale.status + ' ' + JSON.stringify(staleBody));
  check(unchanged.descriptor_rev === after.descriptor_rev && unchanged.descriptor_hash === after.descriptor_hash, 'directory PATCH stale: the row changed although the write was refused');
  const bad = await patch({ descriptor_json: { ref: 'page://admin/sheets', relationships: [{ type: 'related_to', target_ref: 'external://google/sheets' }] } });
  check(bad.status === 422 && (await bad.json()).error === 'environment_descriptor_refused', 'directory PATCH: related_to must be refused with environment_descriptor_refused');
  // The environment now reports the edit without any documentation being touched.
  const g = await (await get('governance', `?ref=${Q}`)).json();
  check((g.direct || []).some((x) => x.rule_ref === 'law://design/D08'), 'environment: the governance edit did not become a direct rule on the next read');
  const obj = await (await get('objects', `?ref=${Q}`)).json();
  check(obj.revision === after.descriptor_rev && obj.hash === after.descriptor_hash, 'environment: object revision/hash do not match the row after the edit');
  const dir = await (await directoryGet({ env, params: { key: 'PAGE_ADMIN_SHEETS' }, request: new Request(`${ORIGIN}/api/directory/PAGE_ADMIN_SHEETS`) })).json();
  check(dir._environment?.ref === SHEETS && dir._environment?.governance === `/api/environment/governance?ref=${Q}`, 'directory GET: the row does not point at its environment resolvers');
}

// 6. Sheets project the descriptor by JSON path with the generic engine.
{
  const view = normalizeView({ source: 'directory', columns: ['key', 'descriptor_json.ref', 'descriptor_json.governance.direct', 'descriptor_rev'], filters: [{ field: 'descriptor_json.ref', op: '=', value: SHEETS }] });
  const out = await runView(env, view);
  check(out.ok === true && out.rows.length === 1, 'sheets: a directory view filtered by descriptor ref returned ' + JSON.stringify(out.error || out.rows.length) + ' ' + (out.detail || ''));
  check(out.ok && out.rows[0][1] === SHEETS && out.rows[0][2].includes('law://design/D08'), 'sheets: projected cells do not carry the descriptor content: ' + JSON.stringify(out.rows[0]));
}

// 7. MCP resources are the same objects.
{
  const { loadEnvironmentCatalog } = await import(join(ROOT, 'functions/_lib/environment_descriptor.js'));
  const catalog = await loadEnvironmentCatalog(env);
  const resources = mcpResourcesFromCatalog(catalog);
  check(resources.some((r) => r.uri === MANUAL_RESOURCE_URI) && resources.some((r) => r.uri === SHEETS), 'mcp: resources lack the manual or page://admin/sheets');
  const read = readMcpResource(catalog, SHEETS);
  const body = read ? JSON.parse(read.contents[0].text) : null;
  check(!!body && body.governance.effective.some((x) => x.rule_ref === 'law://design/D08') && body.comparables.comparables.length === 1, 'mcp: resources/read for page://admin/sheets does not carry resolved governance and comparables');
}

// 8. The human page, as the middleware serves it, names the page's ref and links its resolvers.
{
  const served = injectObjectContext(shellHtml({ activeHref: '/admin/sheets', title: 'Sheets', body: '' }), '/admin/sheets');
  check(/<code[^>]*>page:\/\/admin\/sheets<\/code>/.test(served) && served.includes(`/api/environment/governance?ref=${Q}`) && served.includes(`/api/environment/comparables?ref=${Q}`), 'admin page: /admin/sheets as served does not resolve to page://admin/sheets with governance and comparables links');
  check(served.split('data-ms-object-context="1"').length === 2 && injectObjectContext(served, '/admin/sheets') === served, 'admin page: the object context is not injected exactly once');
  const mw = readFileSync(join(ROOT, 'functions/_middleware.js'), 'utf8');
  check(mw.includes('injectObjectContext(html, url.pathname)'), 'middleware: injectShareIfAdmin no longer calls injectObjectContext on admin HTML — the human path is gone');
}

// 9. Every sheet is an object: visibility defaults private, flips by PATCH, self payload names its
//    own links and webhook, the environment resolves sheet://<id> for public sheets and refuses to
//    describe private ones, and a sheet-scoped token operates that sheet only.
{
  db.exec(readFileSync(join(ROOT, 'migrations/0365_user_sheets.sql'), 'utf8'));
  db.exec(readFileSync(join(ROOT, 'migrations/0371_sheet_sort_order.sql'), 'utf8'));
  db.exec(readFileSync(join(ROOT, 'migrations/0374_sheet_visibility.sql'), 'utf8'));
  const { createSheet, patchSheet, getSheet } = await import(join(ROOT, 'functions/_lib/sheets_store.js'));
  const { sheetSelfPayload, sheetSelfMarkdown } = await import(join(ROOT, 'functions/_lib/sheet_self.js'));
  const { tokenAllowsSheet } = await import(join(ROOT, 'functions/_lib/admin_session.js'));
  const created = await createSheet(env, { title: 'Agents', rows: 1, cols: 3 }, 'gate');
  check(created.visibility === 'private', 'sheet: a new sheet is not private by default: ' + created.visibility);
  const ref = 'sheet://' + created.id;
  const priv = await get('objects', '?ref=' + encodeURIComponent(ref));
  check(priv.status === 403 && (await priv.json()).error === 'object_private', 'environment: a private sheet must answer 403 object_private, got ' + priv.status);
  const bad = await patchSheet(env, created.id, { visibility: 'everyone' });
  check(bad && bad.error === 'bad_visibility' && (await getSheet(env, created.id)).visibility === 'private', 'sheet: an unknown visibility must be refused without changing the row');
  const pub = await patchSheet(env, created.id, { visibility: 'public', col_meta: { view: { source: 'directory', columns: ['key', 'descriptor_json.ref'], filters: [{ field: 'object_kind', op: '=', value: 'page' }] } } });
  check(pub.visibility === 'public' && (await getSheet(env, created.id)).visibility === 'public', 'sheet: PATCH visibility public did not land in the row');
  const self = sheetSelfPayload(pub, { origin: ORIGIN, authority: 'public read' });
  check(self.ref === ref && self.links.human === `${ORIGIN}/sheet/${created.id}` && self.links.webhook === `${ORIGIN}/api/sheets/${created.id}/values:append`, 'sheet self: ref, human link or webhook address wrong: ' + JSON.stringify(self.links));
  check(self.operations.some((o) => o.id === 'append' && o.method === 'POST') && self.operations.some((o) => o.id === 'run_view') && self.kind === 'view_sheet', 'sheet self: operations do not include append and run_view for a view sheet');
  check(sheetSelfMarkdown(self).includes(self.links.webhook) && !/sh\.\d{10}\./.test(JSON.stringify(self)), 'sheet self markdown: missing webhook or carries a token');
  const obj = await get('objects', '?ref=' + encodeURIComponent(ref));
  const body = await obj.json();
  check(obj.status === 200 && body.ref === ref && body.parent_ref === 'page://admin/sheets', 'environment: a public sheet does not resolve as an object: ' + obj.status + ' ' + JSON.stringify(body).slice(0, 200));
  check((body.governance?.effective || []).map((r) => r.rule_ref).join(',') === 'law://sheets/S01,law://design/D08,law://work/W01', 'environment: a sheet does not inherit the sheets page rules: ' + JSON.stringify(body.governance?.effective?.map((r) => r.rule_ref)));
  const listed = await (await get('objects', '?kind=view_sheet')).json();
  check(listed.objects.some((o) => o.ref === ref), 'environment: the public sheet is not listed under kind=view_sheet');
  check(tokenAllowsSheet({ scope: 'sheet', sheetId: created.id }, created.id) && !tokenAllowsSheet({ scope: 'sheet', sheetId: created.id }, 'sh_other') && tokenAllowsSheet({ scope: 'act' }, created.id) && !tokenAllowsSheet({ scope: 'row', rowKey: 'X' }, created.id), 'token: sheet scope does not bound to exactly one sheet');
  const manual = await (await get('', '?format=markdown')).text();
  check(manual.includes('## Every sheet is an object with its own link') && manual.includes('scope=sheet:<id>'), 'manual: does not teach sheet links, visibility and sheet-scoped tokens');
}

// 10. Every row carries its invocation and test record; the state is written by recording a run,
//     the sheet engine projects it, and the manual teaches =INVOKE.
{
  db.exec(readFileSync(join(ROOT, 'migrations/0375_directory_invocation.sql'), 'utf8'));
  const { buildInvocation, recordTest, testPlan, verdict, STATE } = await import(join(ROOT, 'functions/_lib/invocation_record.js'));
  const row = db.prepare("SELECT * FROM directory WHERE key='ADD'").get();
  check(row.test_state === STATE.untested, 'invocation: a fresh row is not 🟡 untested: ' + row.test_state);
  const inv = buildInvocation(row, { origin: ORIGIN });
  check(inv.url === ORIGIN + '/api/dispatch' && inv.headers['x-terminal-key'] === '$TERMINAL_KEY' && inv.body.key === 'ADD', 'invocation: wrapper is not the dispatch call with the owner key as its vault variable');
  const { realInvocation } = await import(join(ROOT, 'functions/_lib/invocation_record.js'));
  const real = realInvocation({ key: 'ROUTER', type: 'agent', content: '' }, JSON.stringify({ url: 'https://api.x.ai/v1/chat/completions', method: 'POST', headers: { authorization: '<REDACTED>' }, body: { model: 'grok-4.3', messages: [] } }));
  check(real.url === 'https://api.x.ai/v1/chat/completions' && real.headers.authorization === 'Bearer $GROK_API_KEY' && real.body.model === 'grok-4.3' && /"authorization: Bearer \$GROK_API_KEY"/.test(real.curl), 'invocation: the real outbound request is not reconstructed with its vault variable: ' + JSON.stringify(real).slice(0, 200));
  check(testPlan({ key: 'EMAIL_SEND', type: 'fn', content: '' }).runnable === false && testPlan(row).runnable === true, 'invocation: outward rows must be skipped and arg-free rows runnable');
  const v = verdict('ERR:nope'); check(v.ok === false, 'invocation: ERR result must be broken');
  await recordTest(env, 'ADD', { invocation: inv, transport: { http: 200, ok: true, ms: 3 }, response: '5', state: STATE.works });
  const after = db.prepare("SELECT test_state, last_response, invocation FROM directory WHERE key='ADD'").get();
  check(after.test_state === STATE.works && after.last_response === '5' && JSON.parse(after.invocation).body.key === 'ADD', 'invocation: recordTest did not land the five columns on the row');
  const view = normalizeView({ source: 'directory', columns: ['test_state', 'key', 'invocation.body.key', 'last_status.ok', 'last_response'], filters: [{ field: 'test_state', op: 'contains', value: 'works' }] });
  const out = await runView(env, view);
  check(out.ok && out.rows.length === 1 && out.rows[0][0] === STATE.works && out.rows[0][2] === 'ADD' && out.rows[0][3] === '1', 'sheets: a directory view does not project the test columns by JSON path: ' + JSON.stringify(out.rows) + ' ' + (out.detail || ''));
  const manual = await (await get('', '?format=markdown')).text();
  check(manual.includes('=INVOKE(A2,"status")') && manual.includes('/api/directory/<KEY>/test'), 'manual: does not teach =INVOKE and the per-row test route');
  const formula = readFileSync(join(ROOT, 'functions/_lib/sheet_formula.js'), 'utf8');
  check(formula.includes("case 'INVOKE':"), 'formula: INVOKE is not a sheet function');
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, law: 'ENVIRONMENT_CONTRACT_LAW', examined, failed: failures.length, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'ENVIRONMENT_CONTRACT_LAW', examined, checked: 'migration 0373 on a fresh database; environment root/manual/governance/comparables; descriptor hash recomputation; PATCH effect + stale refusal + version row; sheet JSON-path projection; MCP resources; admin shell object context; sheets as objects (visibility, self payload, sheet:// resolution, sheet-scoped token); invocation record columns + =INVOKE' }));
