-- Migration 0053 — fix MCP rows to the REAL xAI grok CLI syntax.
-- `grok mcp --help` on the Mac shows: add <NAME> --command <cmd> --args <a..> --url <u>;
-- the probe subcommand is `doctor <NAME>` (there is no `test`). The prove-build-alive run
-- exposed the old rows calling `grok mcp add npx ...` (unexpected arg) and `grok mcp test`
-- (unrecognized). These wire MCP absorption to the actual CLI.

UPDATE directory SET
  target = 'POST https://agent.cannibal.capital/exec',
  content = '# Register an MCP server with the grok CLI. Args: name|command|args (args space-separated, optional). Example: [MCP_ADD]fetch|npx|-y @modelcontextprotocol/server-fetch[/MCP_ADD]. Follow with MCP_DOCTOR to verify connectivity.
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp add $1 --command $2 --args $3+ 2>&1"],"timeout":120000}',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'MCP_ADD';

UPDATE directory SET
  target = 'POST https://agent.cannibal.capital/exec',
  content = '# Diagnose a registered MCP server (connectivity + its tools). Arg: name. Real subcommand is `grok mcp doctor` (there is no `test`). Each tool it reports becomes one ADD_ROW (MCP_<server>_<tool>).
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp doctor $1 2>&1"],"timeout":120000}',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'MCP_TEST';

-- MCP_PROBE flow: the old SCOUT step body carried pipes/parens that broke the flow's
-- key:body parser. Simplify to register → doctor → hand the doctor output to SCOUT.
UPDATE directory SET
  content = '# Wire an MCP server end-to-end. Args: name|command|args. Registers it, runs doctor, hands the tool list to SCOUT to ADD_ROW one row per tool.
MCP_ADD:$1|$2|$3+ > MCP_TEST:$1 > SCOUT:Here is grok mcp doctor output for the MCP server named $1. For each tool it exposes, ADD_ROW a row keyed MCP_$1_<tool> that invokes it, then report what you added in REPLY. Output follows. $PREV',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE key = 'MCP_PROBE';

-- Rename references: add an MCP_DOCTOR alias pointing at the same handler so the doctor
-- verb is discoverable by name too.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES ('MCP_DOCTOR', 'http', 'POST https://agent.cannibal.capital/exec', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# Alias of MCP_TEST: diagnose a registered MCP server. Arg: name → `grok mcp doctor <name>`.
{"cmd":"sh","args":["-lc","~/.grok/bin/grok mcp doctor $1 2>&1"],"timeout":120000}',
'mcp', 55, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(key) DO UPDATE SET target=excluded.target, auth=excluded.auth, content=excluded.content, updated_at=excluded.updated_at;
