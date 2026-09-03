-- 0095_world_map_toolkit.sql — world-map representation for a coding model + agent-editable
-- runtime limits + a TOOLKIT agent that loads the map and can run the full atomic toolkit.
-- Revert: DELETE FROM directory WHERE key IN ('WORLD_MAP','SET_TOOL_LOOPS','SET_MEMORY_WINDOW','GET_AGENT_LIMITS','TOOLKIT');

INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank) VALUES
('WORLD_MAP','fn','worldMap','',
'# WHAT: the ontological world map of every tool this build has + when to use which. No arg = overview (category counts + when-to-use guide + how-to-call). Arg = drill one category and list its tools.
# WHEN_TO_USE: a model needs to understand what it has access to before acting.
# ARGS: $1 = optional category name (e.g. cli, wrangler, google_api, kv, d1, r2).
# EX: [WORLD_MAP][/WORLD_MAP]  then  [WORLD_MAP]wrangler[/WORLD_MAP]
["$1"]','2026-06-14T22:45:00Z','meta',NULL,NULL,1,1,3),

('SET_TOOL_LOOPS','fn','setAgentLimits','',
'# WHAT: set how many tool loops the agent may run per turn (1-40). Agent-editable runtime knob.
# WHEN_TO_USE: a long job needs more loops, or a tight job wants fewer.
# ARGS: $1 = integer 1-40.
# EX: [SET_TOOL_LOOPS]20[/SET_TOOL_LOOPS]
["$1",""]','2026-06-14T22:45:00Z','meta',NULL,NULL,1,1,3),

('SET_MEMORY_WINDOW','fn','setAgentLimits','',
'# WHAT: set how many prior conversation turns the agent remembers. Agent-editable runtime knob.
# WHEN_TO_USE: need more/less conversation history loaded into context.
# ARGS: $1 = integer (0 = no history).
# EX: [SET_MEMORY_WINDOW]6[/SET_MEMORY_WINDOW]
["","$1"]','2026-06-14T22:45:00Z','meta',NULL,NULL,1,1,3),

('GET_AGENT_LIMITS','fn','getAgentLimits','',
'# WHAT: read the current tool-loop cap + memory window.
# WHEN_TO_USE: check current runtime limits.
# ARGS: none.
# EX: [GET_AGENT_LIMITS][/GET_AGENT_LIMITS]
[]','2026-06-14T22:45:00Z','meta',NULL,NULL,1,1,3),

('TOOLKIT','agent','grok-4.3','bearer:GROK_API_KEY',
'{{SHARED}}

K1: IDENTITY — You are TOOLKIT, a coding agent on the miscsubjects build with the full atomic toolkit: any Mac shell command, the named CLIs (wrangler/gh/npm/clasp), the Cloudflare REST API, the Google Workspace API, and the build registry itself. Target model is swappable (grok/gpt/gemini) — you are one of several.
K2: WORLD MAP — At the start of a job, load your map: [WORLD_MAP][/WORLD_MAP] for the overview (category counts + a when-to-use-which guide + the call contract). Drill a category with [WORLD_MAP]<category>[/WORLD_MAP]. NEVER guess a tool key — run [WORLD_MAP] or [TOOLS_SEARCH]<keyword>|20[/TOOLS_SEARCH] first.
K3: SHELL IS UNIVERSAL — you can run ANY Mac command via [LOCAL_EXEC]<command>[/LOCAL_EXEC]; cat, ls, grep, sed, curl, git, cp, rm, tail, wc, find all work inside it. Heavy CLIs also have named rows (WRANGLER_*, GH_*, NPM_*, CLASP_*) and the Cloudflare REST is [CF]<op>|<account_id>[/CF].
K4: CONTROL YOUR RUNTIME — tool-loop budget: [SET_TOOL_LOOPS]<1-40>[/SET_TOOL_LOOPS]; conversation memory depth: [SET_MEMORY_WINDOW]<n>[/SET_MEMORY_WINDOW]; check both: [GET_AGENT_LIMITS][/GET_AGENT_LIMITS].
K5: DISPATCH — call any tool as [KEY]arg1|arg2[/KEY]; single-arg rows take the whole body. Verify before claiming success (S6). Your tools:
{{TOOLS}}','2026-06-14T22:45:00Z','agent','*',NULL,1,0,100);
