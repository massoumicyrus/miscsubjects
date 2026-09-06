import { dispatch } from './dispatch.js';
import { logEvent } from '../_lib/event_log.js';
import { projectionRows } from '../_lib/projection_manifest.js';
import { environmentCatalogMap, loadEnvironmentCatalog } from '../_lib/environment_descriptor.js';
import { resolveEffectiveGovernance } from '../_lib/governance_resolver.js';
import { resolveComparables } from '../_lib/environment_comparables.js';
import { environmentManualMarkdown } from '../_lib/environment_manual.js';

// MCP Streamable-HTTP server fronting the directory. Every enabled + planner-visible
// directory row is exposed as an MCP tool; tools/call routes through /api/dispatch, so
// the watcher (sensitive=1 → watch_rules) and the LEDGER apply unchanged. This is the
// outward surface: Claude Code / Cursor / grok-cli / OpenHands / any MCP client calls
// the same 262-row directory under the same policy and the same audit log.
// Auth: Authorization: Bearer <MCP_TOKEN>  (or header x-mcp-token: <MCP_TOKEN>).

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'miscsubjects-directory', version: '1.0.0' };

function firstDocLine(content) {
  const out = [];
  for (const ln of String(content || '').split('\n')) {
    if (/^\s*#/.test(ln)) out.push(ln.replace(/^\s*#\s?/, ''));
    else break;
  }
  return out.join(' ').trim();
}

function tokenOk(request, env) {
  if (!env.MCP_TOKEN) return false;
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const xtok = request.headers.get('x-mcp-token') || '';
  return bearer === env.MCP_TOKEN || xtok === env.MCP_TOKEN;
}

// MCP clients require every tool's root input schema to be an object. Directory
// rows predate that protocol constraint and may contain positional {args:[...]},
// array-root, or scalar-root schemas. Preserve those contracts while wrapping
// them in a valid object so one legacy row cannot invalidate the whole catalog.
// Moonshot/Kimi validate every tool schema strictly and reject the WHOLE tool
// list on the first violation: a `required` key missing from `properties`, or a
// property node with no `type`. Claude Code tolerates both, so 815 heterogeneous
// directory rows accumulated schemas that break stricter clients. coerceMoonshot
// recursively repairs any node so one legacy row cannot invalidate the catalog.
// Moonshot only tolerates a small keyword set; combinators (anyOf/oneOf/allOf)
// and a type on the same node are rejected. The runtime ignores the schema
// entirely (tools/call pipes args as strings), so the schema is purely
// descriptive — we flatten combinators to a representative branch and keep only
// the whitelisted keywords, which makes any legacy row unconditionally valid.
const MOONSHOT_KEYS = new Set(['type', 'description', 'enum', 'properties', 'items', 'required', 'default']);
function coerceMoonshot(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return { type: 'string' };
  let src = node;
  const comb = node.anyOf || node.oneOf || node.allOf;
  if (Array.isArray(comb) && comb.length) {
    const pick = comb.find(s => s && typeof s === 'object' && s.type && s.type !== 'null')
      || comb.find(s => s && typeof s === 'object') || {};
    src = { ...node, ...pick };
    delete src.anyOf; delete src.oneOf; delete src.allOf;
  }
  const out = {};
  for (const k of Object.keys(src)) if (MOONSHOT_KEYS.has(k)) out[k] = src[k];
  if (out.properties && typeof out.properties === 'object' && !Array.isArray(out.properties)) {
    const p = {};
    for (const [k, v] of Object.entries(out.properties)) p[k] = coerceMoonshot(v);
    out.properties = p;
  } else if ('properties' in out) delete out.properties;
  if (out.items && typeof out.items === 'object' && !Array.isArray(out.items)) out.items = coerceMoonshot(out.items);
  else if ('items' in out) delete out.items;
  if (Array.isArray(out.required)) {
    if (!out.properties) out.properties = {};
    for (const raw of out.required) {
      const name = String(raw || '').trim();
      if (name && !Object.prototype.hasOwnProperty.call(out.properties, name)) out.properties[name] = { type: 'string' };
    }
  }
  if (!out.type) {
    if (out.properties) out.type = 'object';
    else if (out.items) out.type = 'array';
    else if (Array.isArray(out.enum) && out.enum.length) out.type = typeof out.enum[0] === 'number' ? 'number' : 'string';
    else out.type = 'string';
  }
  return out;
}

export function normalizeInputSchema(schema) {
  if (schema && typeof schema === 'object' && !Array.isArray(schema) && schema.type === 'object') {
    return coerceMoonshot(schema);
  }

  if (schema && typeof schema === 'object' && !Array.isArray(schema) && Array.isArray(schema.args)) {
    const properties = {};
    for (const rawName of schema.args) {
      const name = String(rawName || '').trim();
      if (name && !Object.prototype.hasOwnProperty.call(properties, name)) properties[name] = { type: 'string' };
    }
    return { type: 'object', properties };
  }

  if (schema && typeof schema === 'object' && !Array.isArray(schema) && schema.type === 'array') {
    const items = Array.isArray(schema.items) ? schema.items : [];
    if (items.length) {
      const properties = {};
      items.forEach((item, index) => { properties['arg' + (index + 1)] = coerceMoonshot(item); });
      return { type: 'object', properties };
    }
  }

  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    return { type: 'object', properties: { body: coerceMoonshot(schema) } };
  }

  return {
    type: 'object',
    properties: {
      body: {
        type: 'string',
        description: 'Pipe-delimited args, e.g. "arg1|arg2". Single arg: the value itself. No args: empty string.',
      },
    },
  };
}


// The argument order a row declares for itself. x-arg-order is written by the schema generator;
// `required` is the fallback for a hand-written schema that lists its arguments in order. An empty
// answer means "no declared order", and the caller keeps the payload's own key order.
async function argOrderFor(env, key) {
  try {
    const row = await env.DB.prepare('SELECT input_schema FROM directory WHERE key = ?').bind(String(key)).first();
    if (!row?.input_schema) return [];
    const schema = JSON.parse(row.input_schema);
    if (Array.isArray(schema['x-arg-order'])) return schema['x-arg-order'].map(String);
    if (Array.isArray(schema.required)) return schema.required.map(String);
    if (schema.properties && typeof schema.properties === 'object') return Object.keys(schema.properties);
  } catch { /* an unreadable schema is not a reason to refuse the call */ }
  return [];
}

export function mcpToolsFromRows(rows) {
  const tools = [];
  for (const row of projectionRows(rows, 'mcp')) {
    let schema = null;
    if (row.input_schema) { try { schema = JSON.parse(row.input_schema); } catch {} }
    schema = normalizeInputSchema(schema);
    const doc = firstDocLine(row.content);
    tools.push({
      name: row.key,
      description: (doc ? doc + ' ' : '') + `[${row.type}${row.category ? ' · ' + row.category : ''}]`,
      inputSchema: schema,
    });
  }
  return tools;
}

async function listTools(env) {
  const r = await env.DB.prepare(
    'SELECT key, type, category, content, input_schema, ' +
    'IFNULL(enabled,1) AS enabled, IFNULL(planner_visible,1) AS planner_visible, ' +
    'IFNULL(planner_rank,100) AS planner_rank ' +
    'FROM directory ORDER BY IFNULL(planner_rank,100), key'
  ).all();
  return mcpToolsFromRows(r.results || []);
}

// RESOURCES are the same directory descriptors the environment API serves, published through
// MCP's resource lane so a coding agent discovers an object's contract, resolved rules and
// comparables through the protocol it already speaks. Tools execute; resources describe. The
// server stores no description of its own: every field below is compiled from the catalog.
export const MANUAL_RESOURCE_URI = 'environment://miscsubjects/manual';
const ORIGIN = 'https://miscsubjects.com';

export function mcpResourcesFromCatalog(catalog) {
  const resources = [{
    uri: MANUAL_RESOURCE_URI,
    name: 'environment manual',
    description: 'One-link model-readable manual for the live environment, generated from directory descriptors.',
    mimeType: 'text/markdown',
  }];
  for (const object of catalog || []) {
    if (!object?.ref) continue;
    resources.push({
      uri: object.ref,
      name: object.title || object.ref,
      description: [object.summary, `[${object.kind}]`, object.hash ? `rev ${object.revision} ${object.hash}` : null].filter(Boolean).join(' '),
      mimeType: 'application/json',
    });
  }
  return resources;
}

export function readMcpResource(catalog, uri, origin = ORIGIN) {
  const ref = String(uri || '').trim();
  if (ref === MANUAL_RESOURCE_URI) {
    return { contents: [{ uri: ref, mimeType: 'text/markdown', text: environmentManualMarkdown(catalog, { origin }) }] };
  }
  const object = environmentCatalogMap(catalog).get(ref);
  if (!object) return null;
  const body = {
    ...object,
    governance: resolveEffectiveGovernance(catalog, ref),
    comparables: resolveComparables(catalog, ref),
    representations: { ...(object.representations || {}), json: `${origin}/api/environment/objects?ref=${encodeURIComponent(ref)}`, manual: `${origin}/api/environment?format=markdown` },
  };
  return { contents: [{ uri: ref, mimeType: 'application/json', text: JSON.stringify(body, null, 2) }] };
}

function rpcResult(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
const J = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!tokenOk(request, env)) {
    return J({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'unauthorized: send Authorization: Bearer <MCP_TOKEN>' } }, 401);
  }
  let msg;
  try { msg = await request.json(); }
  catch { return J(rpcError(null, -32700, 'parse error'), 400); }

  const method = msg && msg.method;
  const id = msg && (msg.id != null ? msg.id : null);

  // Notifications carry no id and expect no body.
  if (method && method.startsWith('notifications/')) return new Response(null, { status: 202 });

  if (method === 'initialize') {
    return J(rpcResult(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } }, serverInfo: SERVER_INFO }));
  }
  if (method === 'ping') return J(rpcResult(id, {}));
  if (method === 'tools/list') return J(rpcResult(id, { tools: await listTools(env) }));
  if (method === 'resources/list') return J(rpcResult(id, { resources: mcpResourcesFromCatalog(await loadEnvironmentCatalog(env)) }));
  if (method === 'resources/templates/list') return J(rpcResult(id, { resourceTemplates: [] }));
  if (method === 'resources/read') {
    const uri = msg.params && msg.params.uri;
    if (!uri) return J(rpcError(id, -32602, 'resources/read requires params.uri'));
    const found = readMcpResource(await loadEnvironmentCatalog(env), uri);
    if (!found) return J(rpcError(id, -32002, 'resource not registered: ' + uri + ' — list resources or read ' + MANUAL_RESOURCE_URI));
    return J(rpcResult(id, found));
  }
  if (method === 'tools/call') {
    const name = msg.params && msg.params.name;
    const args = (msg.params && msg.params.arguments) || {};
    if (!name) return J(rpcError(id, -32602, 'tools/call requires params.name'));
    // ORDER BY THE CONTRACT, NOT BY THE PAYLOAD.
    // Named arguments are joined with | and position is meaning, so taking them in whatever order
    // the client happened to serialise them silently sends the right values to the wrong slots.
    // The row's own schema declares the order in x-arg-order; a client that omits an argument
    // still holds its place, because dropping it would shift every argument after it.
    let body;
    if (typeof args.body === 'string') body = args.body;
    else if (args.body != null) body = String(args.body);
    else if (Object.keys(args).length) {
      const order = await argOrderFor(env, name);
      const keys = order.length ? order.filter((k) => k in args).length === 0 ? Object.keys(args) : order : Object.keys(args);
      body = keys.map((k) => (args[k] == null ? '' : String(args[k]))).join('|');
    } else body = '';
    let out;
    try { out = await dispatch(env, name, body); }
    catch (e) { out = { result: 'ERR:mcp:dispatch:' + (e && e.message || String(e)) }; }
    const text = out && out.result != null ? String(out.result) : '';
    const isError = text.startsWith('ERR:');
    try {
      await logEvent(env, { source: 'mcp', key: name, action: 'tools/call', direction: 'IN', route: '/api/mcp', trace_id: (out && out.trace) || null, request: body, response: text, status: isError ? 500 : 200 });
    } catch {}
    return J(rpcResult(id, { content: [{ type: 'text', text }], isError }));
  }
  return J(rpcError(id, -32601, 'method not found: ' + method));
}

// GET is a human/health descriptor; the MCP protocol itself runs over POST here.
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!tokenOk(request, env)) return J({ error: 'unauthorized' }, 401);
  const tools = await listTools(env);
  const resources = mcpResourcesFromCatalog(await loadEnvironmentCatalog(env));
  return J({ server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION, transport: 'streamable-http (POST JSON-RPC 2.0)', endpoint: 'https://miscsubjects.com/api/mcp', tool_count: tools.length, resource_count: resources.length, manual: MANUAL_RESOURCE_URI });
}
