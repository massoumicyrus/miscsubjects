-- Keyword directory searches must be bounded; full DIR_LIST is too large for ROUTER turns.
UPDATE directory
SET content = replace(
  content,
  '[TOOLS_IN]category|limit[/TOOLS_IN] lists tools in a category. For keyword search use [DIR_LIST][/DIR_LIST] then filter, or [WORLD_MAP][/WORLD_MAP] for categories. TOOLS_SEARCH does not exist — never emit it.',
  '[TOOLS_IN]category|limit[/TOOLS_IN] lists tools in a category. For keyword search use [D1_QUERY]SELECT key,type,target,category FROM directory WHERE lower(key) LIKE ''%stripe%'' OR lower(content) LIKE ''%stripe%'' OR lower(category) LIKE ''%stripe%'' ORDER BY key LIMIT 20[/D1_QUERY], replacing stripe with the lowercase search word. Do not use DIR_LIST for keyword search. TOOLS_SEARCH does not exist — never emit it.'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, 'For keyword search use [DIR_LIST][/DIR_LIST] then filter') > 0;
