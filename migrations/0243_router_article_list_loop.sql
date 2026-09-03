-- Article listing must not leak [LOOP] as the final visible answer.
UPDATE directory
SET content = replace(
  content,
  '- list / count articles → [ARTICLES]list[/ARTICLES]',
  '- list / count articles → [ARTICLES]list[/ARTICLES], then reply with a compact list of titles/slugs/URLs from that result. Never answer this intent with [LOOP] alone; if the list is large, include the first 10 plus total/count from the tool result.'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, '- list / count articles → [ARTICLES]list[/ARTICLES]') > 0;
