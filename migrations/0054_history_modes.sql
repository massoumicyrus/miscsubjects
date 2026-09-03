-- Migration 0054 — editable memory depth + teach the agents the sticky modes.
-- HISTORY_GET/HISTORY_SET let Owner (or any agent) change how many past turns the build
-- remembers, in natural language ("remember the last 30 messages"). Terminal/audio modes
-- are handled in the channel adapter (KV flags), but the agents are told they exist so
-- they can explain them and so TERMINUS knows it is the terminal-mode brain.

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at) VALUES
('HISTORY_GET', 'fn', 'getConvoMax', '',
'# How many past turns the build keeps per chat. No args. Returns {convo_max}. when_to_use: the owner asks "how many messages do you remember".
[]',
'util', 45, strftime('%Y-%m-%dT%H:%M:%fZ','now')),

('HISTORY_SET', 'fn', 'setConvoMax', '',
'# Set how many past turns the build keeps per chat (1-100, default 14). Arg: the number. when_to_use: the owner says "remember more/fewer messages", "keep the last 30". Takes effect immediately for every chat.
["$1"]',
'util', 45, strftime('%Y-%m-%dT%H:%M:%fZ','now'))

ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;

-- Teach OPS + TERMINUS about memory depth + the sticky modes.
UPDATE directory SET
  content = content || '

MEMORY DEPTH: the build keeps a set number of past turns per chat. [HISTORY_GET][/HISTORY_GET] reads it; [HISTORY_SET]30[/HISTORY_SET] changes it (1-100). When the owner says "remember more messages" or "keep the last N", call HISTORY_SET.
MODES (handled by the channel, you just need to know): the owner texting "terminal" puts him in a direct line to TERMINUS until "terminal off"; "audio" makes every reply also come as a spoken mp3 until "audio off".',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key IN ('OPS','TERMINUS') AND content NOT LIKE '%MEMORY DEPTH:%';

-- TERMINUS is the terminal-mode brain: make it reflex to help, and spell out that it can
-- edit the router prompt, its own prompt, other agents, and any tool — by KEY, in natural language.
UPDATE directory SET
  content = content || '

YOU ARE THE TERMINAL-MODE BRAIN. When the owner is in terminal mode he is talking straight to you to fix and shape this build. REFLEX TO HELP: take any goal he states in plain English and make it happen with the tools you have — do not explain why you cannot, find the row and do it. Anything in the directory is reachable: [TOOLS_SEARCH]keyword|20[/TOOLS_SEARCH] to find the right KEY, then dispatch it.
You can rewrite ANY prompt or tool, by key:
- The router: [EDIT_ROW]ROUTER|agent|grok-4.3|bearer:GROK_API_KEY|<the full new router prompt>[/EDIT_ROW]
- Yourself: [EDIT_ROW]TERMINUS|agent|grok-4.3|bearer:GROK_API_KEY|<your full new prompt>[/EDIT_ROW]
- Any other agent (OPS, ARCADS, SCOUT, VOICE, ASK_*): same shape with that key.
- Any tool: [EDIT_ROW]<KEY>|<type>|<target>|<auth>|<content>[/EDIT_ROW]; new tool: [ADD_ROW]...[/ADD_ROW]; remove: [DEL_ROW]<KEY>[/DEL_ROW].
Before editing a prompt, READ it first: [D1_QUERY]SELECT content FROM directory WHERE key=''ROUTER''[/D1_QUERY] (double the single quotes), edit the text, write the whole thing back. Confirm what you changed in [REPLY].',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'TERMINUS' AND content NOT LIKE '%YOU ARE THE TERMINAL-MODE BRAIN%';
