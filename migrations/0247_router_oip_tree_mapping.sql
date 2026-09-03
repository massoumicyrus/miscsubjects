-- OIP tree and API/CLI/MCP doc-tree asks must route to the OIP_TREE row.
UPDATE directory
SET content = replace(
  content,
  '- If he asks "architecture as an AI OS", he means THIS build, not xAI/Grok internals. Answer: iMessage/Blooio input; ROUTER as kernel; directory as syscall table; D1/KV/R2 as state/storage; Cloudflare Pages as runtime; Mac bridge as local device/terminal; ledger as audit log; [REPLY] as output.',
  '- If he asks "architecture as an AI OS", he means THIS build, not xAI/Grok internals. Answer: iMessage/Blooio input; ROUTER as kernel; directory as syscall table; D1/KV/R2 as state/storage; Cloudflare Pages as runtime; Mac bridge as local device/terminal; ledger as audit log; [REPLY] as output.' || char(10) ||
  '- object invocation protocol tree / OIP tree / API CLI MCP docs / machine-native API tree → [OIP_TREE][/OIP_TREE]'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, 'object invocation protocol tree / OIP tree / API CLI MCP docs / machine-native API tree') = 0
  AND instr(content, '- If he asks "architecture as an AI OS"') > 0;
