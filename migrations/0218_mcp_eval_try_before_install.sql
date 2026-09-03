-- OIP try-before-install: tap an object to see what an MCP/integration does, run a safe
-- read-only trial, get a receipt, and a connect/skip recommendation.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, sensitive, runner, updated_at) VALUES
('MCP_EVAL', 'fn', 'mcpEval', '', '# WHAT: Try an integration before installing it. Resolves the named integration to its OIP objects, classifies read vs write, runs one safe read-only trial, returns a receipt, and recommends connect or skip.
# WHEN_TO_USE: "should I get the Stripe MCP", "what can the GitHub integration do", "try X before I connect it".
# ARGS: $1 = integration name (stripe|github|context7|drive|slack|notion); $2 = optional mode "live" to run a live read-only trial for financial integrations.
# EX: [MCP_EVAL]github[/MCP_EVAL]', 'mcp', NULL, 1, 5, 1, 0, 'edge', datetime('now')),
('TRY_STRIPE_MCP', 'fn', 'tryStripeMcp', '', '# WHAT: Try the Stripe integration before connecting it. Shows the read and write objects Stripe exposes here and recommends connect or skip. Financial: the live read-only account check runs only in mode "live".
# WHEN_TO_USE: "should I get Stripe MCP", "what would Stripe let an agent do".
# ARGS: $1 = optional mode "live"
# EX: [TRY_STRIPE_MCP][/TRY_STRIPE_MCP]', 'mcp', NULL, 1, 5, 1, 0, 'edge', datetime('now')),
('TRY_GITHUB_MCP', 'fn', 'tryGithubMcp', '', '# WHAT: Try the GitHub integration before connecting it. Runs a safe read-only trial (list issues) and returns a receipt.
# WHEN_TO_USE: "should I get GitHub MCP", "what would GitHub let an agent do".
# ARGS: none
# EX: [TRY_GITHUB_MCP][/TRY_GITHUB_MCP]', 'mcp', NULL, 1, 5, 1, 0, 'edge', datetime('now'));
