const TEST_ID_PATTERN = /^__|^TEST_ROW$|^TEST_ALL$|^AUDIT_TEST_ROW$|DUMMY|SCRATCH/i;
const PROJECTION_NAMES = ['discovery', 'contract', 'mcp', 'docs', 'skill', 'cli'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeCatalogueRows(input) {
  return (Array.isArray(input) ? input : Object.values(input || {}))
    .filter((row) => row && row.key)
    .map((row) => ({
      key: String(row.key),
      type: row.type == null ? null : String(row.type),
      category: row.category == null ? null : String(row.category),
      target: row.target == null ? null : String(row.target),
      content: row.content == null ? '' : String(row.content),
      input_schema: row.input_schema == null ? null : String(row.input_schema),
      enabled: Number(row.enabled ?? 1) === 1 ? 1 : 0,
      planner_visible: Number(row.planner_visible ?? 1) === 1 ? 1 : 0,
      planner_rank: Number(row.planner_rank ?? 100),
      sensitive: Number(row.sensitive ?? 0) === 1 ? 1 : 0,
      runner: row.runner == null ? null : String(row.runner),
      auth: row.auth == null ? null : String(row.auth),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function projectionDecision(row, projection) {
  if (!PROJECTION_NAMES.includes(projection)) throw new Error(`unknown projection: ${projection}`);
  if (Number(row.enabled ?? 1) !== 1) return { included: false, reason: 'enabled=0' };
  if (TEST_ID_PATTERN.test(String(row.key || ''))) return { included: false, reason: 'scratch/test row' };
  if ((projection === 'mcp' || projection === 'skill') && Number(row.planner_visible ?? 1) !== 1) {
    return { included: false, reason: 'planner_visible=0' };
  }
  return { included: true, reason: 'included by policy' };
}

export function projectionRows(input, projection) {
  const rows = normalizeCatalogueRows(input).filter((row) => projectionDecision(row, projection).included);
  if (projection === 'mcp' || projection === 'skill') {
    rows.sort((a, b) => a.planner_rank - b.planner_rank || a.key.localeCompare(b.key));
  }
  return rows;
}

export async function compileProjectionManifest(input) {
  const catalogue = normalizeCatalogueRows(input);
  const projections = {};
  for (const name of PROJECTION_NAMES) {
    const selected = projectionRows(catalogue, name);
    projections[name] = {
      policy: name === 'mcp' || name === 'skill'
        ? 'enabled non-scratch rows where planner_visible=1'
        : 'enabled non-scratch rows',
      count: selected.length,
      ids: selected.map((row) => row.key),
      sha256: await sha256(selected),
    };
  }
  const rowManifest = {};
  for (const row of catalogue) {
    rowManifest[row.key] = {
      contract_sha256: await sha256(row),
      projections: Object.fromEntries(PROJECTION_NAMES.map((name) => [name, projectionDecision(row, name)])),
    };
  }
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    catalogue_snapshot_sha256: await sha256(catalogue),
    catalogue_row_count: catalogue.length,
    projection_policy_sha256: await sha256(
      Object.fromEntries(PROJECTION_NAMES.map((name) => [name, projections[name].policy])),
    ),
    projections,
    rows: rowManifest,
  };
}
