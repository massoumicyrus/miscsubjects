export const ENVIRONMENT_SCHEMA = 'miscsubjects/environment-object/1';

export const OBJECT_SCHEMES = new Set([
  'environment', 'page', 'route', 'directory', 'prompt', 'model', 'sheet',
  'source', 'law', 'skill', 'store', 'ledger', 'external', 'article', 'receipt',
]);

export const RELATIONSHIP_TYPES = new Set([
  'part_of', 'projects', 'implemented_by', 'exposes', 'reads', 'writes', 'invokes',
  'governed_by', 'inherits_rules_from', 'overrides_rule', 'comparable_to',
  'alternative_to', 'depends_on', 'produces', 'recorded_by', 'supersedes',
]);

const UNKNOWN = Object.freeze({ status: 'unknown' });

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch { return fallback; }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableDescriptorJson(value) {
  return JSON.stringify(stableValue(normalizeEnvironmentDescriptor(value)));
}

// The content hash covers what the descriptor SAYS, never where or how often it was stored:
// `hash` (self-reference), `revision` (a counter) and `directory_key` (storage address) are
// excluded, so the same contract yields the same hash in a migration seed, a POST, a PATCH and
// a re-read of the row. A gate recomputes this from the stored row and refuses a drift.
export function descriptorContentJson(value) {
  const d = normalizeEnvironmentDescriptor(value);
  const { hash, revision, directory_key, ...content } = d;
  return JSON.stringify(stableValue(content));
}

export async function hashEnvironmentDescriptor(value) {
  const bytes = new TextEncoder().encode(descriptorContentJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function firstDocLine(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.replace(/^\s*#+\s*/, '').trim())
    .find(Boolean) || '';
}

export function parseObjectRef(value) {
  const ref = String(value || '').trim();
  const match = ref.match(/^([a-z][a-z0-9+.-]*):\/\/(.+)$/);
  if (!match || !OBJECT_SCHEMES.has(match[1])) return null;
  const address = match[2].replace(/^\/+|\/+$/g, '');
  if (!address || /[\s?#]/.test(address) || address.includes('@')) return null;
  return { ref: `${match[1]}://${address}`, scheme: match[1], address };
}

export function normalizeEnvironmentDescriptor(value) {
  const d = object(value);
  return {
    schema_version: ENVIRONMENT_SCHEMA,
    ref: String(d.ref || ''),
    kind: String(d.kind || parseObjectRef(d.ref)?.scheme || 'object'),
    title: String(d.title || d.name || d.ref || ''),
    summary: String(d.summary || ''),
    status: String(d.status || 'active'),
    parent_ref: d.parent_ref ? String(d.parent_ref) : null,
    source: Object.keys(object(d.source)).length ? object(d.source) : { status: 'unknown' },
    schema: Object.keys(object(d.schema)).length ? object(d.schema) : { ...UNKNOWN },
    operations: array(d.operations),
    relationships: array(d.relationships),
    governance: Object.keys(object(d.governance)).length ? object(d.governance) : { ...UNKNOWN },
    comparables: Array.isArray(d.comparables) ? d.comparables : { ...UNKNOWN },
    representations: Object.keys(object(d.representations)).length ? object(d.representations) : { status: 'unknown' },
    revision: Number(d.revision || 1),
    hash: d.hash ? String(d.hash) : null,
    directory_key: d.directory_key ? String(d.directory_key) : null,
  };
}

export function validateEnvironmentDescriptor(value) {
  const d = normalizeEnvironmentDescriptor(value);
  const errors = [];
  if (!parseObjectRef(d.ref)) errors.push('ref must be a canonical object reference');
  if (!d.kind) errors.push('kind is required');
  if (d.parent_ref && !parseObjectRef(d.parent_ref)) errors.push('parent_ref must be canonical');
  for (const rel of d.relationships) {
    if (!RELATIONSHIP_TYPES.has(String(rel?.type || ''))) {
      errors.push(`relationship type ${String(rel?.type || '<missing>')} is not allowed; related_to is intentionally refused`);
    }
    if (!parseObjectRef(rel?.target_ref)) errors.push('relationship target_ref must be canonical');
  }
  const comparables = Array.isArray(d.comparables) ? d.comparables : [];
  for (const comparable of comparables) {
    if (!parseObjectRef(comparable?.target_ref)) errors.push('comparable target_ref must be canonical');
    if (!array(comparable?.dimensions).length) errors.push('comparable dimensions are required');
    if (!String(comparable?.basis || '').trim()) errors.push('comparable basis is required');
    if (!Array.isArray(comparable?.similarities)) errors.push('comparable similarities are required');
    if (!Array.isArray(comparable?.differences)) errors.push('comparable differences are required');
    if (!array(comparable?.sources).length && comparable?.status !== 'unverified') {
      errors.push('comparable sources are required unless status is unverified');
    }
  }
  return { ok: errors.length === 0, errors, descriptor: d };
}

export function descriptorFromDirectoryRow(row) {
  const extra = parseJson(row?.descriptor_json, {});
  const kind = String(extra.kind || row?.object_kind || (row?.type === 'agent' ? 'agent' : 'capability'));
  const fallbackRef = `${kind === 'capability' ? 'directory' : kind}://${String(row?.key || '').toLowerCase()}`;
  const normalized = normalizeEnvironmentDescriptor({
    ...extra,
    ref: extra.ref || fallbackRef,
    kind,
    title: extra.title || String(row?.key || ''),
    summary: extra.summary || firstDocLine(row?.content),
    status: extra.status || (Number(row?.enabled ?? 1) ? 'active' : 'disabled'),
    operations: extra.operations || [],
    revision: Number(row?.descriptor_rev || 1),
    hash: row?.descriptor_hash || null,
    directory_key: row?.key || null,
  });
  return normalized;
}

export async function loadEnvironmentCatalog(env, { includeDisabled = false } = {}) {
  if (!env?.DB) return [];
  let rows = [];
  try {
    const result = await env.DB.prepare('SELECT * FROM directory ORDER BY IFNULL(planner_rank,100), key').all();
    rows = result?.results || [];
  } catch {
    const result = await env.DB.prepare('SELECT * FROM directory ORDER BY key').all();
    rows = result?.results || [];
  }
  return rows
    .filter((row) => includeDisabled || Number(row.enabled ?? 1) !== 0)
    .map(descriptorFromDirectoryRow)
    .filter((descriptor) => parseObjectRef(descriptor.ref));
}

export function environmentCatalogMap(catalog) {
  return new Map((Array.isArray(catalog) ? catalog : []).map((descriptor) => [descriptor.ref, descriptor]));
}
