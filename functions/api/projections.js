import { compileProjectionManifest } from '../_lib/projection_manifest.js';

function asMarkdown(manifest) {
  const labels = {
    discovery: 'Discovery',
    contract: 'Contract',
    mcp: 'MCP',
    docs: 'Docs',
    skill: 'Skill',
    cli: 'CLI',
  };
  const rows = Object.entries(manifest.projections)
    .map(([name, projection]) => `| ${labels[name] || name} | ${projection.count} | \`${projection.sha256}\` | ${projection.policy} |`)
    .join('\n');
  return `# Catalogue projection manifest

- Catalogue snapshot: \`${manifest.catalogue_snapshot_sha256}\`
- Catalogue rows: ${manifest.catalogue_row_count}
- Projection policy: \`${manifest.projection_policy_sha256}\`
- Generated: ${manifest.generated_at}

| Projection | Rows | SHA-256 | Inclusion policy |
| --- | ---: | --- | --- |
${rows}

Every projection in this report was compiled from the catalogue snapshot named above.
Per-row inclusion decisions and contract hashes are available from the JSON representation.
`;
}

export async function onRequestGet({ env, request }) {
  const result = await env.DB.prepare(
    'SELECT key, type, category, target, content, input_schema, auth, runner, ' +
    'IFNULL(enabled,1) AS enabled, IFNULL(planner_visible,1) AS planner_visible, ' +
    'IFNULL(planner_rank,100) AS planner_rank, IFNULL(sensitive,0) AS sensitive ' +
    'FROM directory',
  ).all();
  const manifest = await compileProjectionManifest(result.results || []);
  const markdown = new URL(request?.url || 'https://miscsubjects.com/api/projections').searchParams.get('format') === 'markdown';
  return new Response(markdown ? asMarkdown(manifest) : JSON.stringify(manifest, null, 2), {
    headers: {
      'content-type': markdown ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
