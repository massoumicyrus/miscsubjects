// Shared prompt blocks — directory rows with target=prompt_block, composed via includes column.

export async function loadPromptBlockMap(env) {
  const map = {};
  try {
    const r = await env.DB.prepare(
      "SELECT key, content FROM directory WHERE target = 'prompt_block' OR category LIKE 'block_%'"
    ).all();
    for (const row of r.results || []) {
      if (row.key && row.content) map[row.key] = String(row.content);
    }
  } catch {}
  return map;
}

export function parseIncludes(row) {
  const fromCol = String(row?.includes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromCol.length) return fromCol;
  // Legacy: first line `@includes BLOCK_A,BLOCK_B`
  const m = String(row?.content || '').match(/^@includes\s+([^\n]+)/i);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).filter(Boolean);
}

export function assembleAgentPrompt(row, blockMap, snapshotBlock) {
  const includes = parseIncludes(row);
  const parts = [];
  if (snapshotBlock) parts.push(snapshotBlock);
  for (const key of includes) {
    const block = blockMap[key];
    if (block) parts.push(`=== ${key} ===\n${block}\n`);
  }
  let body = String(row?.content || '');
  body = body.replace(/^@includes\s+[^\n]+\n?/i, '');
  parts.push(body);
  return parts.filter(Boolean).join('\n');
}