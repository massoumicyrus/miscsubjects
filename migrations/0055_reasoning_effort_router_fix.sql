
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES
('REASONING_GET', 'fn', 'getGrokReasoningEffort', '',
'# Current reasoning_effort for all xAI (grok) model calls. Returns {grok_reasoning_effort}. Values: low|medium|high|none|default. Default = model decides. when_to_use: "what is the reasoning level set to".
[]',
'util', 45, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('REASONING_SET', 'fn', 'setGrokReasoningEffort', '',
'# Set reasoning_effort for all xAI (grok) model calls. Arg: low|medium|high|none|default. "default" removes the field (model decides). Takes effect immediately. when_to_use: "set reasoning to low/high/off", "turn reasoning off", "set grok reasoning effort".
["$1"]',
'util', 45, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

UPDATE directory SET
  content = content || '

OWNER FALLBACK: If the message is from Owner (the owner) and no specific route (ARCADS/TERMINUS/VOICE) clearly fits, route to [OPS] — NEVER emit [DONE]not addressed[/DONE] or stay silent for the owner. Even venting or unclear messages from the owner go to OPS. Silence is only correct for non-owner messages in group chats where the build was not addressed.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'ROUTER' AND content NOT LIKE '%OWNER FALLBACK%';

-- Teach OPS and TERMINUS about the reasoning_effort toggle.
UPDATE directory SET
  content = content || '

REASONING EFFORT: [REASONING_GET][/REASONING_GET] reads the current xAI reasoning level; [REASONING_SET]low[/REASONING_SET] sets it (low|medium|high|none|default). "default" means the field is omitted and xAI decides. Change it when the owner says "set reasoning to low/off/high".',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key IN ('OPS','TERMINUS') AND content NOT LIKE '%REASONING EFFORT%';
