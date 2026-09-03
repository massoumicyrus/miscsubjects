-- R2 object inventory asks must use R2_LIST, not directory listing.
UPDATE directory
SET content = replace(
  content,
  '- object invocation protocol tree / OIP tree / API CLI MCP docs / machine-native API tree → [OIP_TREE][/OIP_TREE]',
  '- object invocation protocol tree / OIP tree / API CLI MCP docs / machine-native API tree → [OIP_TREE][/OIP_TREE]' || char(10) ||
  '- R2 object list / bucket objects / what objects exist in R2 → [R2_LIST][/R2_LIST], then summarize returned keys/count or say the bucket is empty. Do not call DIR_LIST for R2 object inventory.'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, 'R2 object list / bucket objects / what objects exist in R2') = 0
  AND instr(content, '- object invocation protocol tree / OIP tree / API CLI MCP docs / machine-native API tree → [OIP_TREE][/OIP_TREE]') > 0;
