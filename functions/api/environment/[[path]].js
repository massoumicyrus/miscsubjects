import {
  ENVIRONMENT_SCHEMA,
  environmentCatalogMap,
  loadEnvironmentCatalog,
} from '../../_lib/environment_descriptor.js';
import { resolveEffectiveGovernance } from '../../_lib/governance_resolver.js';
import { resolveComparables } from '../../_lib/environment_comparables.js';
import { environmentManualMarkdown } from '../../_lib/environment_manual.js';
import { getSheet, listSheets } from '../../_lib/sheets_store.js';
import { sheetDescriptor } from '../../_lib/sheet_self.js';

function parts(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw || '').split('/').filter(Boolean);
}

function response(body, status = 200, contentType = 'application/json; charset=utf-8') {
  return new Response(contentType.startsWith('application/json') ? JSON.stringify(body, null, 2) : String(body), {
    status,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function catalogHash(catalog) {
  return sha256(JSON.stringify(catalog.map((item) => [item.ref, item.revision, item.hash]).sort()));
}

function objectResult(catalog, ref) {
  const object = environmentCatalogMap(catalog).get(ref);
  if (!object) return null;
  return {
    ...object,
    governance: resolveEffectiveGovernance(catalog, ref),
    comparables: resolveComparables(catalog, ref),
  };
}

// SHEETS ARE OBJECTS TOO. sheet://<id> is resolved from user_sheets on demand — the sheet row is
// the store, its descriptor is generated, nothing is copied into the directory. A private sheet
// is acknowledged (it exists) but not described on this public route; its own /api/sheets/<id>/self
// answers to authority. Returns null when no such sheet, { private: true } when it is private.
async function sheetObject(env, catalog, ref, origin) {
  const id = ref.slice('sheet://'.length);
  if (!id || !env?.DB) return null;
  let sheet = null;
  try { sheet = await getSheet(env, id); } catch { return null; }
  if (!sheet) return null;
  if (sheet.visibility !== 'public') return { private: true, ref, self: `${origin}/api/sheets/${encodeURIComponent(id)}/self` };
  const descriptor = sheetDescriptor(sheet, { origin });
  const withSheet = [...catalog, descriptor];
  return { ...descriptor, governance: resolveEffectiveGovernance(withSheet, ref), comparables: resolveComparables(withSheet, ref) };
}

async function publicSheetDescriptors(env, origin) {
  if (!env?.DB) return [];
  try {
    const rows = await listSheets(env);
    const out = [];
    for (const row of rows) {
      if (row.visibility !== 'public') continue;
      const sheet = await getSheet(env, row.id);
      if (sheet) out.push(sheetDescriptor(sheet, { origin }));
    }
    return out;
  } catch { return []; }
}

function listObjects(catalog, url) {
  const kind = String(url.searchParams.get('kind') || '').trim();
  const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
  const parentRef = String(url.searchParams.get('parent_ref') || '').trim();
  const objects = catalog.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (parentRef && item.parent_ref !== parentRef) return false;
    if (query && !`${item.ref} ${item.title} ${item.summary}`.toLowerCase().includes(query)) return false;
    return true;
  });
  return { schema: 'miscsubjects/environment-object-list/1', count: objects.length, objects };
}

function jsonSchema(origin) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${origin}/api/environment/schema.json`,
    title: 'miscsubjects environment object',
    type: 'object',
    required: ['ref', 'kind', 'operations', 'relationships', 'governance', 'comparables'],
    properties: {
      ref: { type: 'string', pattern: '^[a-z][a-z0-9+.-]*://.+' },
      kind: { type: 'string' },
      parent_ref: { type: ['string', 'null'] },
      source: { type: 'object' },
      schema: { type: 'object' },
      operations: { type: 'array', items: { type: 'object' } },
      relationships: { type: 'array', items: { type: 'object' } },
      governance: { type: 'object' },
      comparables: { oneOf: [{ type: 'array' }, { type: 'object' }] },
      representations: { type: 'object' },
      revision: { type: 'integer', minimum: 1 },
      hash: { type: ['string', 'null'] },
    },
  };
}

function openApi(catalog, origin) {
  const paths = {};
  for (const object of catalog) {
    for (const operation of object.operations || []) {
      if (!operation?.href || !operation?.method) continue;
      let parsed;
      try { parsed = new URL(operation.href, origin); } catch { continue; }
      if (parsed.origin !== origin || !parsed.pathname.startsWith('/api/')) continue;
      const method = String(operation.method).toLowerCase();
      paths[parsed.pathname] ||= {};
      paths[parsed.pathname][method] = {
        operationId: operation.id || `${method}_${object.directory_key || object.kind}`,
        summary: operation.summary || object.summary || object.title,
        tags: [object.kind],
        'x-environment-ref': object.ref,
        responses: { 200: { description: 'Operation-specific response; follow returned receipt references for evidence.' } },
      };
    }
  }
  return {
    openapi: '3.1.0',
    info: { title: 'miscsubjects live environment', version: '1' },
    servers: [{ url: origin }],
    paths,
  };
}

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const path = parts(params?.path);
  const action = path[0] || '';
  const origin = url.origin;
  const catalog = await loadEnvironmentCatalog(env);

  if (!action) {
    if (String(url.searchParams.get('format') || '').match(/^(markdown|md|text)$/i)) {
      return response(environmentManualMarkdown(catalog, { origin }), 200, 'text/markdown; charset=utf-8');
    }
    return response({
      schema: 'miscsubjects/environment/1',
      object_schema: ENVIRONMENT_SCHEMA,
      canonical_ref: 'environment://miscsubjects',
      catalog_hash: await catalogHash(catalog),
      object_count: catalog.length,
      manual: `${origin}/api/environment?format=markdown`,
      discovery: {
        objects: `${origin}/api/environment/objects?kind=<kind>&q=<words>`,
        describe: `${origin}/api/environment/objects?ref=<canonical-ref>`,
        governance: `${origin}/api/environment/governance?ref=<canonical-ref>`,
        comparables: `${origin}/api/environment/comparables?ref=<canonical-ref>&dimension=<dimension>`,
        openapi: `${origin}/api/environment/openapi.json`,
        schema: `${origin}/api/environment/schema.json`,
        changes: `${origin}/api/environment/changes?after=<ISO-8601>`,
      },
      sources_of_truth: {
        directory: 'current object contracts and relationships',
        ledger: 'history, invocation evidence, effects, failures, and revisions',
      },
      evidence_rule: 'Only effect_verified evidence against current relevant revisions may be described as working.',
    });
  }

  if (action === 'objects') {
    const ref = String(url.searchParams.get('ref') || '').trim();
    const kind = String(url.searchParams.get('kind') || '').trim();
    if (!ref) {
      // Public sheets join the listing as objects of kind sheet / view_sheet.
      const sheets = (!kind || kind === 'sheet' || kind === 'view_sheet') ? await publicSheetDescriptors(env, origin) : [];
      return response(listObjects([...catalog, ...sheets], url));
    }
    if (ref.startsWith('sheet://')) {
      const found = await sheetObject(env, catalog, ref, origin);
      if (!found) return response({ error: 'object_not_registered', ref, note: 'no sheet with that id' }, 404);
      if (found.private) return response({ error: 'object_private', ref, note: 'the sheet exists and is private; its self payload answers to authority', self: found.self }, 403);
      return response(found);
    }
    const object = objectResult(catalog, ref);
    return object ? response(object) : response({ error: 'object_not_registered', ref }, 404);
  }

  if (action === 'governance') {
    const ref = String(url.searchParams.get('ref') || '').trim();
    if (!ref) return response({ error: 'ref_required', usage: '/api/environment/governance?ref=<canonical-ref>' }, 400);
    if (ref.startsWith('sheet://')) {
      const found = await sheetObject(env, catalog, ref, origin);
      if (!found) return response({ error: 'object_not_registered', ref }, 404);
      if (found.private) return response({ error: 'object_private', ref, self: found.self }, 403);
      return response(found.governance);
    }
    const result = resolveEffectiveGovernance(catalog, ref);
    return response(result, result.unresolved.some((item) => item.reason === 'target_not_registered') ? 404 : 200);
  }

  if (action === 'comparables') {
    const ref = String(url.searchParams.get('ref') || '').trim();
    if (!ref) return response({ error: 'ref_required', usage: '/api/environment/comparables?ref=<canonical-ref>' }, 400);
    const result = resolveComparables(catalog, ref, { dimension: String(url.searchParams.get('dimension') || '').trim() || null });
    return response(result, result.unresolved.some((item) => item.reason === 'target_not_registered') ? 404 : 200);
  }

  if (action === 'schema.json' || (action === 'schema' && path[1] === 'json')) return response(jsonSchema(origin));
  if (action === 'openapi.json' || (action === 'openapi' && path[1] === 'json')) return response(openApi(catalog, origin));

  if (action === 'changes') {
    const after = String(url.searchParams.get('after') || '1970-01-01T00:00:00.000Z');
    if (!env?.LEDGER) return response({ schema: 'miscsubjects/environment-changes/1', after, count: 0, changes: [], status: 'ledger_unbound' });
    try {
      const result = await env.LEDGER.prepare(
        "SELECT id,ts,key,actor,action,status,trace_id,response_preview FROM events WHERE ts>? AND (source='environment' OR key LIKE 'DIR_%' OR key LIKE 'ENVIRONMENT_%') ORDER BY ts ASC LIMIT 500"
      ).bind(after).all();
      return response({ schema: 'miscsubjects/environment-changes/1', after, count: (result.results || []).length, changes: result.results || [] });
    } catch (error) {
      return response({ error: 'changes_unavailable', detail: String(error?.message || error) }, 503);
    }
  }

  return response({ error: 'unknown_environment_route', action, manual: `${origin}/api/environment?format=markdown` }, 404);
}
